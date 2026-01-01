/**
 * AI Leave Mode Management Routes
 * 
 * Handles:
 * - AI mode toggle (Automatic <-> Normal)
 * - Priority badge system
 * - HR notifications and escalations
 * - Time-based processing scheduler
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const db = require('../config/db');
const axios = require('axios');
const nodemailer = require('nodemailer');

// AI Engine URL
const AI_ENGINE_URL = process.env.LEAVE_AI_URL || 'http://localhost:8001';

// Email transporter (configure with your SMTP settings)
let emailTransporter = null;
try {
    emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
} catch (e) {
    console.warn('Email transporter not configured:', e.message);
}

// ============================================================
// AI MODE MANAGEMENT
// ============================================================

/**
 * Get current AI mode configuration
 */
router.get('/mode', authenticateToken, async (req, res) => {
    try {
        const config = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'leave_ai_mode'"
        );
        
        const allConfig = await db.query(
            "SELECT config_key, config_value, description, updated_at FROM ai_system_config"
        );

        res.json({
            success: true,
            mode: config?.config_value || 'automatic',
            config: allConfig.reduce((acc, row) => {
                acc[row.config_key] = {
                    value: row.config_value,
                    description: row.description,
                    updatedAt: row.updated_at
                };
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Get AI mode error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Toggle AI mode (Admin only)
 * Automatic: AI handles all leave types based on rules
 * Normal: AI only auto-approves sick leave, all others go to HR
 */
router.post('/mode/toggle', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { mode, reason } = req.body;
        const validModes = ['automatic', 'normal'];
        
        if (!validModes.includes(mode)) {
            return res.status(400).json({ 
                success: false, 
                error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
            });
        }

        // Get current mode
        const currentConfig = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'leave_ai_mode'"
        );
        const previousMode = currentConfig?.config_value || 'automatic';

        // Update mode
        await db.execute(
            `INSERT INTO ai_system_config (config_key, config_value, description, updated_by)
             VALUES ('leave_ai_mode', ?, 'AI Leave Processing Mode', ?)
             ON DUPLICATE KEY UPDATE config_value = ?, updated_by = ?, updated_at = NOW()`,
            [mode, req.user.id, mode, req.user.id]
        );

        // Log the change
        await db.execute(
            `INSERT INTO ai_mode_audit_log (previous_mode, new_mode, changed_by, changed_by_name, change_reason, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                previousMode, 
                mode, 
                req.user.id, 
                req.user.name || req.user.email,
                reason || 'Admin toggle',
                req.ip,
                req.headers['user-agent']?.substring(0, 500)
            ]
        );

        res.json({
            success: true,
            previousMode,
            currentMode: mode,
            message: `AI Leave mode changed from ${previousMode} to ${mode}`,
            description: mode === 'automatic' 
                ? 'AI will now process all leave types and auto-approve when rules match'
                : 'AI will only auto-approve sick leave. All other leave types will be routed to HR.'
        });
    } catch (error) {
        console.error('Toggle AI mode error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update AI system configuration
 */
router.put('/config', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { key, value } = req.body;
        
        const allowedKeys = [
            'hr_response_timeout_hours',
            'priority_escalation_timeout_hours',
            'enable_email_notifications',
            'enable_dashboard_notifications',
            'normal_mode_auto_approve_types'
        ];

        if (!allowedKeys.includes(key)) {
            return res.status(400).json({ 
                success: false, 
                error: `Invalid config key. Allowed: ${allowedKeys.join(', ')}` 
            });
        }

        await db.execute(
            `UPDATE ai_system_config SET config_value = ?, updated_by = ?, updated_at = NOW() 
             WHERE config_key = ?`,
            [typeof value === 'object' ? JSON.stringify(value) : value, req.user.id, key]
        );

        res.json({ success: true, message: `Configuration '${key}' updated successfully` });
    } catch (error) {
        console.error('Update config error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get AI mode change history
 */
router.get('/mode/history', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const history = await db.query(
            `SELECT * FROM ai_mode_audit_log ORDER BY created_at DESC LIMIT 50`
        );
        res.json({ success: true, history });
    } catch (error) {
        console.error('Get mode history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PRIORITY BADGE SYSTEM
// ============================================================

/**
 * Check if employee can set priority badge on their request
 */
router.get('/priority/eligible/:requestId', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const emp_id = req.user?.emp_id || req.user?.employeeId;

        const request = await db.getOne(
            `SELECT lr.*, lpb.priority_level, lpb.badge_set_at
             FROM leave_requests lr
             LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
             WHERE lr.request_id = ? AND lr.emp_id = ?`,
            [requestId, emp_id]
        );

        if (!request) {
            return res.status(404).json({ success: false, error: 'Leave request not found' });
        }

        // Get timeout configuration
        const timeoutConfig = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'hr_response_timeout_hours'"
        );
        const timeoutHours = parseInt(timeoutConfig?.config_value) || 7;

        const createdAt = new Date(request.created_at);
        const hoursPending = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        const isEligible = request.status === 'pending' && 
                         request.ai_mode_at_submission === 'normal' &&
                         !request.hr_viewed_at &&
                         hoursPending >= timeoutHours &&
                         (!request.priority_level || request.priority_level === 'none');

        res.json({
            success: true,
            requestId,
            isEligible,
            currentPriority: request.priority_level || 'none',
            hoursPending: Math.round(hoursPending * 10) / 10,
            timeoutHours,
            hoursUntilEligible: isEligible ? 0 : Math.max(0, timeoutHours - hoursPending),
            hrHasViewed: !!request.hr_viewed_at,
            message: isEligible 
                ? 'You can set a priority badge on this request'
                : request.priority_level && request.priority_level !== 'none'
                    ? `Priority already set to ${request.priority_level}`
                    : request.hr_viewed_at
                        ? 'HR has already viewed this request'
                        : `Priority badge will be available in ${Math.ceil(timeoutHours - hoursPending)} hours`
        });
    } catch (error) {
        console.error('Check priority eligibility error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Set priority badge on leave request
 */
router.post('/priority/set', authenticateToken, async (req, res) => {
    try {
        // Support both camelCase and snake_case from frontend
        const requestId = req.body.requestId || req.body.request_id;
        const priorityLevel = req.body.priorityLevel || req.body.priority_level;
        const reason = req.body.reason;
        const emp_id = req.user?.emp_id || req.user?.employeeId;

        if (!['yellow', 'red'].includes(priorityLevel)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Priority level must be "yellow" or "red"' 
            });
        }

        // Verify the request belongs to the user and is eligible
        const request = await db.getOne(
            `SELECT lr.*, e.full_name, e.email, e.department
             FROM leave_requests lr
             JOIN employees e ON lr.emp_id = e.emp_id
             WHERE lr.request_id = ? AND lr.emp_id = ?`,
            [requestId, emp_id]
        );

        if (!request) {
            return res.status(404).json({ success: false, error: 'Leave request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                error: 'Can only set priority on pending requests' 
            });
        }

        // Check timeout eligibility
        const timeoutConfig = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'hr_response_timeout_hours'"
        );
        const timeoutHours = parseInt(timeoutConfig?.config_value) || 7;
        const hoursPending = (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60);

        if (hoursPending < timeoutHours) {
            return res.status(400).json({ 
                success: false, 
                error: `You can set priority after ${Math.ceil(timeoutHours - hoursPending)} more hours` 
            });
        }

        // Insert or update priority badge
        await db.execute(
            `INSERT INTO leave_priority_badges (request_id, emp_id, priority_level, priority_reason, badge_set_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE priority_level = ?, priority_reason = ?, badge_set_at = NOW()`,
            [requestId, emp_id, priorityLevel, reason, priorityLevel, reason]
        );

        // Update leave request
        await db.execute(
            `UPDATE leave_requests SET can_set_priority = FALSE WHERE request_id = ?`,
            [requestId]
        );

        // Create HR notification
        await createHRNotification({
            notificationType: 'priority_request',
            requestId,
            priorityLevel: priorityLevel === 'red' ? 'urgent' : 'high',
            title: `${priorityLevel.toUpperCase()} Priority: ${request.full_name} - ${request.leave_type}`,
            message: `${request.full_name} has marked their leave request as ${priorityLevel} priority. Pending for ${Math.round(hoursPending)} hours.`,
            data: {
                employeeName: request.full_name,
                employeeEmail: request.email,
                department: request.department,
                leaveType: request.leave_type,
                startDate: request.start_date,
                endDate: request.end_date,
                totalDays: request.total_days,
                reason: request.reason,
                priorityReason: reason,
                hoursPending: Math.round(hoursPending)
            }
        });

        // Send email notification if enabled
        const emailEnabled = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'enable_email_notifications'"
        );
        if (emailEnabled?.config_value === 'true') {
            await sendPriorityNotificationEmail(request, priorityLevel, reason, hoursPending);
        }

        res.json({
            success: true,
            message: `Priority set to ${priorityLevel}. HR has been notified.`,
            priority: priorityLevel,
            description: priorityLevel === 'red' 
                ? 'Emergency response needed. If HR doesn\'t respond within 24 hours, the system will automatically process your request.'
                : 'Non-emergency. HR will be reminded to review your request.'
        });
    } catch (error) {
        console.error('Set priority error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get employee's leave requests with priority status
 */
router.get('/my-requests/priority-status', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.user?.emp_id || req.user?.employeeId;

        const requests = await db.query(
            `SELECT 
                lr.request_id,
                lr.leave_type,
                lr.start_date,
                lr.end_date,
                lr.total_days,
                lr.status,
                lr.created_at,
                lr.ai_mode_at_submission,
                lr.hr_viewed_at,
                lr.can_set_priority,
                IFNULL(lpb.priority_level, 'none') as priority_level,
                lpb.badge_set_at,
                lpb.priority_reason,
                TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) as hours_pending
             FROM leave_requests lr
             LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
             WHERE lr.emp_id = ?
             ORDER BY lr.created_at DESC
             LIMIT 20`,
            [emp_id]
        );

        // Get timeout config
        const timeoutConfig = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'hr_response_timeout_hours'"
        );
        const timeoutHours = parseInt(timeoutConfig?.config_value) || 7;

        const enrichedRequests = requests.map(r => ({
            ...r,
            canSetPriority: r.status === 'pending' && 
                           r.ai_mode_at_submission === 'normal' &&
                           !r.hr_viewed_at &&
                           r.hours_pending >= timeoutHours &&
                           (r.priority_level === 'none' || !r.priority_level),
            hoursUntilPriorityEligible: Math.max(0, timeoutHours - r.hours_pending)
        }));

        res.json({ success: true, requests: enrichedRequests });
    } catch (error) {
        console.error('Get priority status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// HR NOTIFICATION SYSTEM
// ============================================================

/**
 * Get HR notifications (for HR dashboard)
 */
router.get('/hr/notifications', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        const { unreadOnly = 'false', limit = 50 } = req.query;

        let query = `
            SELECT 
                hn.*,
                lr.leave_type,
                lr.start_date,
                lr.end_date,
                e.full_name as employee_name,
                e.department
            FROM hr_notification_queue hn
            LEFT JOIN leave_requests lr ON hn.request_id = lr.request_id
            LEFT JOIN employees e ON lr.emp_id = e.emp_id
            WHERE hn.is_dismissed = FALSE
        `;

        if (unreadOnly === 'true') {
            query += ' AND hn.is_read = FALSE';
        }

        query += ` ORDER BY 
            CASE hn.priority_level 
                WHEN 'urgent' THEN 1 
                WHEN 'high' THEN 2 
                ELSE 3 
            END,
            hn.created_at DESC
            LIMIT ?`;

        const notifications = await db.query(query, [parseInt(limit)]);

        // Get unread count
        const unreadCount = await db.getOne(
            'SELECT COUNT(*) as count FROM hr_notification_queue WHERE is_read = FALSE AND is_dismissed = FALSE'
        );

        res.json({
            success: true,
            notifications,
            unreadCount: unreadCount?.count || 0
        });
    } catch (error) {
        console.error('Get HR notifications error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Mark HR notification as read
 */
router.put('/hr/notifications/:id/read', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.execute(
            'UPDATE hr_notification_queue SET is_read = TRUE, read_at = NOW() WHERE id = ?',
            [id]
        );

        // Also update the leave request hr_viewed_at if this is a leave notification
        const notification = await db.getOne('SELECT request_id FROM hr_notification_queue WHERE id = ?', [id]);
        if (notification?.request_id) {
            await db.execute(
                'UPDATE leave_requests SET hr_viewed_at = NOW() WHERE request_id = ? AND hr_viewed_at IS NULL',
                [notification.request_id]
            );
        }

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Mark all HR notifications as read
 */
router.post('/hr/notifications/read-all', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        await db.execute(
            'UPDATE hr_notification_queue SET is_read = TRUE, read_at = NOW() WHERE is_read = FALSE'
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all pending leave requests for HR review
 */
router.get('/hr/pending-requests', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        const { status = 'pending', limit = 50 } = req.query;
        
        const requests = await db.query(`
            SELECT 
                lr.request_id,
                lr.emp_id,
                e.full_name as employee_name,
                e.email as employee_email,
                e.department,
                e.position,
                lr.leave_type,
                lr.start_date,
                lr.end_date,
                lr.total_days,
                lr.reason,
                lr.status,
                lr.created_at,
                lr.ai_mode_at_submission,
                lr.processing_notes,
                lr.hr_assigned_at,
                lr.hr_viewed_at,
                IFNULL(lpb.priority_level, 'none') as priority_level,
                lpb.priority_reason,
                lpb.badge_set_at,
                TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) as hours_pending,
                CASE 
                    WHEN lpb.priority_level = 'red' THEN 1
                    WHEN lpb.priority_level = 'yellow' THEN 2
                    ELSE 3
                END as priority_sort
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
            WHERE lr.status = ?
            ORDER BY priority_sort ASC, lr.created_at ASC
            LIMIT ?
        `, [status, parseInt(limit)]);

        const summary = {
            total: requests.length,
            withPriority: requests.filter(r => r.priority_level !== 'none').length,
            red: requests.filter(r => r.priority_level === 'red').length,
            yellow: requests.filter(r => r.priority_level === 'yellow').length,
            unviewed: requests.filter(r => !r.hr_viewed_at).length
        };

        res.json({ 
            success: true, 
            requests, 
            summary,
            canSetPriorityAfterHours: 7,
            autoEscalateAfterHours: 24
        });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Mark single notification as read (POST version for frontend compatibility)
 */
router.post('/hr/notifications/:id/read', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.execute(
            'UPDATE hr_notification_queue SET is_read = TRUE, read_at = NOW() WHERE id = ?',
            [id]
        );

        const notification = await db.getOne('SELECT request_id FROM hr_notification_queue WHERE id = ?', [id]);
        if (notification?.request_id) {
            await db.execute(
                'UPDATE leave_requests SET hr_viewed_at = NOW() WHERE request_id = ? AND hr_viewed_at IS NULL',
                [notification.request_id]
            );
        }

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Mark leave request as viewed by HR
 */
router.post('/hr/mark-viewed/:requestId', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        const { requestId } = req.params;

        await db.execute(
            'UPDATE leave_requests SET hr_viewed_at = NOW() WHERE request_id = ? AND hr_viewed_at IS NULL',
            [requestId]
        );

        res.json({ success: true, message: 'Request marked as viewed' });
    } catch (error) {
        console.error('Mark viewed error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Dismiss HR notification
 */
router.put('/hr/notifications/:id/dismiss', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.execute(
            'UPDATE hr_notification_queue SET is_dismissed = TRUE, dismissed_at = NOW() WHERE id = ?',
            [id]
        );

        res.json({ success: true, message: 'Notification dismissed' });
    } catch (error) {
        console.error('Dismiss notification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get pending priority requests for HR
 */
router.get('/hr/priority-requests', authenticateToken, authorize('hr', 'admin', 'hr_manager'), async (req, res) => {
    try {
        const requests = await db.query(`
            SELECT * FROM v_pending_priority_requests
            WHERE priority_level IN ('yellow', 'red')
            ORDER BY priority_sort_order, created_at ASC
        `);

        const summary = {
            total: requests.length,
            red: requests.filter(r => r.priority_level === 'red').length,
            yellow: requests.filter(r => r.priority_level === 'yellow').length
        };

        res.json({ success: true, requests, summary });
    } catch (error) {
        // View might not exist, fallback to direct query
        try {
            const requests = await db.query(`
                SELECT 
                    lr.request_id,
                    lr.emp_id,
                    e.full_name as employee_name,
                    e.email as employee_email,
                    e.department,
                    lr.leave_type,
                    lr.start_date,
                    lr.end_date,
                    lr.total_days,
                    lr.reason,
                    lr.status,
                    lr.created_at,
                    IFNULL(lpb.priority_level, 'none') as priority_level,
                    lpb.priority_reason,
                    lpb.badge_set_at,
                    TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) as hours_pending
                FROM leave_requests lr
                JOIN employees e ON lr.emp_id = e.emp_id
                LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
                WHERE lr.status = 'pending'
                AND lpb.priority_level IN ('yellow', 'red')
                ORDER BY 
                    CASE lpb.priority_level WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END,
                    lr.created_at ASC
            `);

            const summary = {
                total: requests.length,
                red: requests.filter(r => r.priority_level === 'red').length,
                yellow: requests.filter(r => r.priority_level === 'yellow').length
            };

            res.json({ success: true, requests, summary });
        } catch (innerError) {
            console.error('Get priority requests error:', innerError);
            res.status(500).json({ success: false, error: innerError.message });
        }
    }
});

// ============================================================
// ESCALATION SYSTEM
// ============================================================

/**
 * Process escalations (called by scheduler)
 */
router.post('/process-escalations', authenticateToken, authorize('admin', 'system'), async (req, res) => {
    try {
        const results = await processEscalations();
        res.json({ success: true, ...results });
    } catch (error) {
        console.error('Process escalations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get escalation history for a request
 */
router.get('/escalation-history/:requestId', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;

        const history = await db.query(
            `SELECT * FROM leave_escalation_history 
             WHERE request_id = ? 
             ORDER BY created_at DESC`,
            [requestId]
        );

        res.json({ success: true, history });
    } catch (error) {
        console.error('Get escalation history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create HR notification
 */
async function createHRNotification({ notificationType, requestId, priorityLevel, title, message, data, recipientRole = 'hr' }) {
    try {
        await db.execute(
            `INSERT INTO hr_notification_queue 
             (notification_type, request_id, recipient_role, priority_level, title, message, data)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [notificationType, requestId, recipientRole, priorityLevel, title, message, JSON.stringify(data)]
        );

        // Update badge notification timestamp
        await db.execute(
            `UPDATE leave_priority_badges SET hr_notified_at = NOW() WHERE request_id = ?`,
            [requestId]
        );
    } catch (error) {
        console.error('Create HR notification error:', error);
    }
}

/**
 * Send priority notification email
 */
async function sendPriorityNotificationEmail(request, priorityLevel, reason, hoursPending) {
    if (!emailTransporter) {
        console.warn('Email transporter not configured, skipping email');
        return;
    }

    try {
        // Get HR emails
        const hrUsers = await db.query(
            "SELECT email FROM users WHERE role IN ('hr', 'hr_manager') AND is_active = 1"
        );

        if (hrUsers.length === 0) {
            console.warn('No HR users found for email notification');
            return;
        }

        const subject = priorityLevel === 'red' 
            ? `🔴 URGENT: Priority Leave Request from ${request.full_name}`
            : `🟡 Priority Leave Request from ${request.full_name}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${priorityLevel === 'red' ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">${priorityLevel === 'red' ? '🔴 URGENT' : '🟡 PRIORITY'} Leave Request</h2>
                </div>
                <div style="padding: 20px; background: #f9fafb;">
                    <p><strong>Employee:</strong> ${request.full_name}</p>
                    <p><strong>Department:</strong> ${request.department}</p>
                    <p><strong>Leave Type:</strong> ${request.leave_type}</p>
                    <p><strong>Dates:</strong> ${request.start_date} to ${request.end_date}</p>
                    <p><strong>Days:</strong> ${request.total_days}</p>
                    <p><strong>Reason:</strong> ${request.reason}</p>
                    <p><strong>Priority Reason:</strong> ${reason || 'Not specified'}</p>
                    <p><strong>Pending:</strong> ${Math.round(hoursPending)} hours</p>
                    ${priorityLevel === 'red' ? `
                        <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; margin-top: 20px; border-radius: 8px;">
                            <p style="color: #dc2626; margin: 0;">
                                <strong>⚠️ This request requires immediate attention.</strong><br>
                                If not addressed within 24 hours, the system will automatically process it.
                            </p>
                        </div>
                    ` : ''}
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/app/pages/hr/leave-requests.html" 
                           style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                            Review Request
                        </a>
                    </div>
                </div>
            </div>
        `;

        await emailTransporter.sendMail({
            from: process.env.SMTP_FROM || 'hr-system@company.com',
            to: hrUsers.map(u => u.email).join(','),
            subject,
            html
        });

        // Update email sent timestamp
        await db.execute(
            `UPDATE leave_priority_badges SET hr_email_sent_at = NOW() WHERE request_id = ?`,
            [request.request_id]
        );

        console.log(`Priority email sent for request ${request.request_id}`);
    } catch (error) {
        console.error('Send priority email error:', error);
    }
}

/**
 * Process automatic escalations for timed-out requests
 */
async function processEscalations() {
    const processed = { escalated: 0, autoApproved: 0, errors: [] };

    try {
        // Get escalation timeout
        const timeoutConfig = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'priority_escalation_timeout_hours'"
        );
        const escalationTimeout = parseInt(timeoutConfig?.config_value) || 24;

        // Find red priority requests that haven't been viewed after timeout
        const redPriorityRequests = await db.query(`
            SELECT 
                lr.*,
                lpb.priority_level,
                lpb.badge_set_at,
                e.full_name,
                e.department,
                TIMESTAMPDIFF(HOUR, lpb.badge_set_at, NOW()) as hours_since_priority
            FROM leave_requests lr
            JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
            JOIN employees e ON lr.emp_id = e.emp_id
            WHERE lr.status = 'pending'
            AND lpb.priority_level = 'red'
            AND lr.hr_viewed_at IS NULL
            AND TIMESTAMPDIFF(HOUR, lpb.badge_set_at, NOW()) >= ?
            AND lr.request_id NOT IN (
                SELECT request_id FROM leave_escalation_history 
                WHERE escalated_to = 'ai_engine' AND is_resolved = FALSE
            )
        `, [escalationTimeout]);

        for (const request of redPriorityRequests) {
            try {
                // Re-analyze with AI engine (or use fallback)
                let analysis;
                let aiEngineAvailable = false;
                
                try {
                    const analysisResponse = await axios.post(`${AI_ENGINE_URL}/analyze`, {
                        request_id: request.request_id,
                        emp_id: request.emp_id,
                        country_code: 'IN', // Default, should get from employee
                        leave_type: request.leave_type,
                        start_date: request.start_date,
                        end_date: request.end_date,
                        total_days: request.total_days,
                        reason: request.reason,
                        force_escalation_check: true
                    }, { timeout: 5000 });
                    analysis = analysisResponse.data;
                    aiEngineAvailable = true;
                } catch (aiError) {
                    console.warn('AI engine offline for escalation, using fallback logic');
                    // Fallback: Auto-approve short leaves (<=3 days) with red priority after 24hr timeout
                    // This is a safety measure when AI is offline
                    const isShortLeave = request.total_days <= 3;
                    analysis = {
                        recommendation: isShortLeave ? 'approve' : 'escalate',
                        can_auto_approve: isShortLeave,
                        confidence: isShortLeave ? 0.7 : 0.3,
                        recommendation_reason: isShortLeave 
                            ? 'Emergency escalation: Short leave auto-approved due to HR timeout and red priority'
                            : 'Long leave requires manager approval'
                    };
                }

                // Log escalation
                await db.execute(
                    `INSERT INTO leave_escalation_history 
                     (request_id, escalation_level, escalated_from, escalated_to, escalation_reason, triggered_by, priority_level)
                     VALUES (?, ?, 'system', 'ai_engine', ?, 'timeout', 'red')`,
                    [
                        request.request_id,
                        (request.escalation_count || 0) + 1,
                        `HR did not respond within ${escalationTimeout} hours. AI re-evaluation triggered.`
                    ]
                );

                // If AI approves and rules match, auto-approve
                if (analysis.recommendation === 'approve' && analysis.can_auto_approve) {
                    await db.execute(
                        `UPDATE leave_requests SET status = 'approved', 
                         approved_by = 'AI_ENGINE_ESCALATION',
                         processing_notes = ?
                         WHERE request_id = ?`,
                        [`Auto-approved by AI after ${escalationTimeout}hr escalation timeout. Confidence: ${analysis.confidence}`, request.request_id]
                    );

                    // Mark escalation as resolved
                    await db.execute(
                        `UPDATE leave_escalation_history 
                         SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = 'AI_ENGINE', resolution_action = 'approved'
                         WHERE request_id = ? AND is_resolved = FALSE`,
                        [request.request_id]
                    );

                    processed.autoApproved++;
                } else {
                    // Escalate to manager
                    await db.execute(
                        `INSERT INTO leave_escalation_history 
                         (request_id, escalation_level, escalated_from, escalated_to, escalation_reason, triggered_by, priority_level)
                         VALUES (?, ?, 'ai_engine', 'manager', ?, 'policy', 'red')`,
                        [
                            request.request_id,
                            (request.escalation_count || 0) + 2,
                            `AI cannot auto-approve: ${analysis.recommendation_reason || 'Policy constraints'}. Escalated to manager.`
                        ]
                    );

                    // Update request
                    await db.execute(
                        `UPDATE leave_requests SET 
                         escalation_count = escalation_count + 1,
                         last_escalation_at = NOW(),
                         processing_notes = CONCAT(IFNULL(processing_notes, ''), ?)
                         WHERE request_id = ?`,
                        [`\n[${new Date().toISOString()}] Escalated to manager after AI review.`, request.request_id]
                    );

                    processed.escalated++;
                }

            } catch (error) {
                processed.errors.push({ requestId: request.request_id, error: error.message });
                console.error(`Escalation error for ${request.request_id}:`, error.message);
            }
        }

    } catch (error) {
        console.error('Process escalations error:', error);
        processed.errors.push({ general: error.message });
    }

    return processed;
}

/**
 * Check and update priority eligibility (run periodically)
 */
async function updatePriorityEligibility() {
    try {
        const timeoutConfig = await db.getOne(
            "SELECT config_value FROM ai_system_config WHERE config_key = 'hr_response_timeout_hours'"
        );
        const timeoutHours = parseInt(timeoutConfig?.config_value) || 7;

        // Update requests that are now eligible for priority badge
        await db.execute(`
            UPDATE leave_requests lr
            LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
            SET 
                lr.can_set_priority = TRUE,
                lr.priority_eligible_at = NOW()
            WHERE 
                lr.status = 'pending'
                AND lr.ai_mode_at_submission = 'normal'
                AND lr.hr_viewed_at IS NULL
                AND lr.can_set_priority = FALSE
                AND TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) >= ?
                AND (lpb.id IS NULL OR lpb.priority_level = 'none')
        `, [timeoutHours]);

        console.log('Priority eligibility check completed');
    } catch (error) {
        console.error('Update priority eligibility error:', error);
    }
}

// Export for scheduler
module.exports = router;
module.exports.processEscalations = processEscalations;
module.exports.updatePriorityEligibility = updatePriorityEligibility;
