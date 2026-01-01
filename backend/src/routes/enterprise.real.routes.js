/**
 * ENTERPRISE LEAVE MANAGEMENT - COMPLETE REAL IMPLEMENTATION
 * With Pusher, Google Calendar, Gmail API, Bulk Operations
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const Pusher = require('pusher');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// ============================================================
// PUSHER CONFIGURATION - REAL
// ============================================================
const pusher = new Pusher({
    appId: "2095719",
    key: "b6c8ed8a35f95339f71c",
    secret: "8a62e6b69e9bac088b77",
    cluster: "ap2",
    useTLS: true
});

// ============================================================
// GOOGLE OAUTH CONFIGURATION - REAL
// ============================================================
const GOOGLE_CLIENT_ID = '354227009682-eq7k9c4raa91gotpsrco06tph22uaeca.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const GOOGLE_REDIRECT_URI = 'http://localhost:5173/auth/google/callback';

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

// ============================================================
// GMAIL TRANSPORTER - REAL
// ============================================================
let gmailTransporter = null;

async function initGmailTransporter(refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const accessToken = await oauth2Client.getAccessToken();
    
    gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: 'hr@techcorp.com',
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            refreshToken: refreshToken,
            accessToken: accessToken.token
        }
    });
}

// ============================================================
// REAL-TIME NOTIFICATION SERVICE
// ============================================================
class NotificationService {
    static async sendPusherNotification(channel, event, data) {
        try {
            await pusher.trigger(channel, event, data);
            
            // Log notification
            await db.execute(`
                INSERT INTO notification_log 
                (notification_type, channel, event_name, message, payload, status, sent_at, related_entity_type, related_entity_id)
                VALUES ('pusher', ?, ?, ?, ?, 'sent', NOW(), ?, ?)
            `, [channel, event, data.message || '', JSON.stringify(data), data.entity_type || null, data.entity_id || null]);
            
            console.log(`[PUSHER] Sent to ${channel}: ${event}`);
            return true;
        } catch (error) {
            console.error('[PUSHER ERROR]', error);
            return false;
        }
    }

    static async sendEmailNotification(to, subject, html, relatedEntity = {}) {
        try {
            if (!gmailTransporter) {
                console.log('[EMAIL] Gmail transporter not initialized');
                return false;
            }

            const result = await gmailTransporter.sendMail({
                from: 'HR Department <hr@techcorp.com>',
                to: to,
                subject: subject,
                html: html
            });

            // Log notification
            await db.execute(`
                INSERT INTO notification_log 
                (notification_type, channel, event_name, recipient_email, subject, message, status, sent_at, related_entity_type, related_entity_id)
                VALUES ('email', 'gmail', 'email_sent', ?, ?, ?, 'sent', NOW(), ?, ?)
            `, [to, subject, html, relatedEntity.type || null, relatedEntity.id || null]);

            console.log(`[EMAIL] Sent to ${to}: ${subject}`);
            return true;
        } catch (error) {
            console.error('[EMAIL ERROR]', error);
            return false;
        }
    }

    static async notifyLeaveRequest(requestId, action) {
        const [request] = await db.execute(`
            SELECT lr.*, e.full_name, e.email, e.pusher_channel,
                   m.full_name as manager_name, m.email as manager_email, m.pusher_channel as manager_channel
            FROM leave_requests_enterprise lr
            JOIN employees e ON lr.emp_id = e.emp_id
            LEFT JOIN employees m ON lr.current_approver = m.emp_id
            WHERE lr.request_id = ?
        `, [requestId]);

        if (!request.length) return;

        const req = request[0];
        const data = {
            request_id: requestId,
            action: action,
            employee_name: req.full_name,
            leave_type: req.leave_type,
            start_date: req.start_date,
            end_date: req.end_date,
            total_days: req.total_days,
            status: req.status,
            timestamp: new Date().toISOString(),
            entity_type: 'leave_request',
            entity_id: requestId
        };

        // Notify based on action
        switch (action) {
            case 'submitted':
                // Notify employee
                await this.sendPusherNotification(req.pusher_channel, 'leave-submitted', {
                    ...data,
                    message: `Your leave request for ${req.total_days} days has been submitted`
                });
                // Notify manager
                if (req.manager_channel) {
                    await this.sendPusherNotification(req.manager_channel, 'leave-pending-approval', {
                        ...data,
                        message: `${req.full_name} has submitted a leave request for ${req.total_days} days`
                    });
                }
                // Notify HR channel
                await this.sendPusherNotification('hr-notifications', 'new-leave-request', data);
                break;

            case 'approved':
                await this.sendPusherNotification(req.pusher_channel, 'leave-approved', {
                    ...data,
                    message: `Your leave request has been approved!`
                });
                await this.sendPusherNotification('hr-notifications', 'leave-approved', data);
                break;

            case 'rejected':
                await this.sendPusherNotification(req.pusher_channel, 'leave-rejected', {
                    ...data,
                    message: `Your leave request has been rejected`
                });
                await this.sendPusherNotification('hr-notifications', 'leave-rejected', data);
                break;

            case 'escalated':
                await this.sendPusherNotification(req.manager_channel, 'leave-escalated', {
                    ...data,
                    message: `Leave request escalated due to SLA breach`
                });
                await this.sendPusherNotification('hr-notifications', 'sla-breach', data);
                break;
        }
    }

    static async broadcastHRUpdate(event, data) {
        await this.sendPusherNotification('hr-dashboard', event, data);
    }
}

// ============================================================
// GOOGLE CALENDAR SERVICE - REAL
// ============================================================
class GoogleCalendarService {
    static async createLeaveEvent(empId, requestId, leaveDetails) {
        try {
            // Get employee's Google tokens
            const [tokens] = await db.execute(`
                SELECT access_token, refresh_token FROM oauth_tokens
                WHERE emp_id = ? AND provider = 'google'
            `, [empId]);

            if (!tokens.length) {
                console.log(`[CALENDAR] No Google tokens for ${empId}`);
                return null;
            }

            oauth2Client.setCredentials({
                access_token: tokens[0].access_token,
                refresh_token: tokens[0].refresh_token
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
                summary: `Leave: ${leaveDetails.leave_type.replace('_', ' ').toUpperCase()}`,
                description: `Leave Request: ${requestId}\nReason: ${leaveDetails.reason}\nStatus: ${leaveDetails.status}`,
                start: {
                    date: leaveDetails.start_date.toISOString().split('T')[0],
                    timeZone: 'Asia/Kolkata'
                },
                end: {
                    date: new Date(leaveDetails.end_date.getTime() + 86400000).toISOString().split('T')[0],
                    timeZone: 'Asia/Kolkata'
                },
                colorId: leaveDetails.status === 'approved' ? '10' : '5', // Green for approved, Yellow for pending
                transparency: 'opaque',
                visibility: 'private'
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event
            });

            // Update request with calendar event ID
            await db.execute(`
                UPDATE leave_requests_enterprise 
                SET google_event_id = ?, calendar_synced = TRUE
                WHERE request_id = ?
            `, [response.data.id, requestId]);

            console.log(`[CALENDAR] Created event ${response.data.id} for ${requestId}`);
            return response.data.id;

        } catch (error) {
            console.error('[CALENDAR ERROR]', error.message);
            await db.execute(`
                UPDATE leave_requests_enterprise 
                SET calendar_sync_error = ?
                WHERE request_id = ?
            `, [error.message, requestId]);
            return null;
        }
    }

    static async updateLeaveEvent(empId, eventId, updates) {
        try {
            const [tokens] = await db.execute(`
                SELECT access_token, refresh_token FROM oauth_tokens
                WHERE emp_id = ? AND provider = 'google'
            `, [empId]);

            if (!tokens.length) return false;

            oauth2Client.setCredentials({
                access_token: tokens[0].access_token,
                refresh_token: tokens[0].refresh_token
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            await calendar.events.patch({
                calendarId: 'primary',
                eventId: eventId,
                resource: updates
            });

            return true;
        } catch (error) {
            console.error('[CALENDAR UPDATE ERROR]', error.message);
            return false;
        }
    }

    static async deleteLeaveEvent(empId, eventId) {
        try {
            const [tokens] = await db.execute(`
                SELECT access_token, refresh_token FROM oauth_tokens
                WHERE emp_id = ? AND provider = 'google'
            `, [empId]);

            if (!tokens.length) return false;

            oauth2Client.setCredentials({
                access_token: tokens[0].access_token,
                refresh_token: tokens[0].refresh_token
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId
            });

            return true;
        } catch (error) {
            console.error('[CALENDAR DELETE ERROR]', error.message);
            return false;
        }
    }
}

// ============================================================
// AUDIT SERVICE
// ============================================================
class AuditService {
    static async log(entityType, entityId, action, actor, oldValues, newValues, changeSummary) {
        await db.execute(`
            INSERT INTO audit_trail 
            (entity_type, entity_id, action, actor_emp_id, actor_role, old_values, new_values, change_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            entityType,
            entityId,
            action,
            actor.emp_id || null,
            actor.role || null,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            changeSummary
        ]);
    }
}

// ============================================================
// ROUTES - GOOGLE OAUTH SSO
// ============================================================
router.get('/auth/google', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.send'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    res.json({ authUrl: url });
});

router.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user info
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();

        // Find or create employee
        const [employee] = await db.execute(`
            SELECT emp_id FROM employees WHERE email = ?
        `, [data.email]);

        if (employee.length) {
            const empId = employee[0].emp_id;

            // Store tokens
            await db.execute(`
                INSERT INTO oauth_tokens (emp_id, provider, access_token, refresh_token, expires_at, scope)
                VALUES (?, 'google', ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), ?)
                ON DUPLICATE KEY UPDATE 
                    access_token = VALUES(access_token),
                    refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
                    expires_at = VALUES(expires_at)
            `, [empId, tokens.access_token, tokens.refresh_token, tokens.scope]);

            // Update employee
            await db.execute(`
                UPDATE employees 
                SET google_id = ?, profile_photo_url = ?, last_login = NOW()
                WHERE emp_id = ?
            `, [data.id, data.picture, empId]);

            res.redirect(`/app/pages/dashboard.html?login=success&emp_id=${empId}`);
        } else {
            res.redirect('/app/pages/login.html?error=employee_not_found');
        }
    } catch (error) {
        console.error('[GOOGLE AUTH ERROR]', error);
        res.redirect('/app/pages/login.html?error=auth_failed');
    }
});

// ============================================================
// ROUTES - LEAVE REQUESTS
// ============================================================

// Submit new leave request
router.post('/leave/submit', async (req, res) => {
    const { emp_id, leave_type, start_date, end_date, reason, is_half_day, half_day_type } = req.body;

    try {
        // Get employee details
        const empResult = await db.query(`
            SELECT e.*, m.emp_id as manager_id, m.full_name as manager_name
            FROM employees e
            LEFT JOIN employees m ON e.manager_id = m.emp_id
            WHERE e.emp_id = ?
        `, [emp_id]);

        if (!empResult || empResult.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const emp = empResult[0];
        const requestId = `LR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Calculate working days
        const start = new Date(start_date);
        const end = new Date(end_date);
        const totalDays = is_half_day ? 0.5 : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        // Get approval hierarchy
        const level1Approver = emp.manager_id || null;
        
        // Determine approval levels needed
        let level2Required = totalDays >= 5;
        let level3Required = totalDays >= 10;

        // Get level 2 approver (manager's manager)
        let level2Approver = null;
        if (level2Required && level1Approver) {
            const mgr = await db.query(`SELECT manager_id FROM employees WHERE emp_id = ?`, [level1Approver]);
            level2Approver = mgr[0]?.manager_id || null;
        }

        // Insert leave request
        await db.query(`
            INSERT INTO leave_requests_enterprise 
            (request_id, emp_id, country_code, leave_type, start_date, end_date, total_days, working_days,
             is_half_day, half_day_type, reason, status, current_approver, current_level,
             level1_approver, level1_status, level2_approver, level2_status, level3_approver, level3_status,
             sla_deadline)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 1, ?, 'pending', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 48 HOUR))
        `, [
            requestId, emp_id, emp.country_code || 'IN', leave_type, start_date, end_date, totalDays, totalDays,
            is_half_day ? 1 : 0, half_day_type || null, reason,
            level1Approver, level1Approver,
            level2Approver, level2Required ? 'pending' : 'not_required',
            null, level3Required ? 'pending' : 'not_required'
        ]);

        // Send real-time notifications
        await NotificationService.notifyLeaveRequest(requestId, 'submitted');

        // Audit log
        await AuditService.log('leave_request', requestId, 'create', { emp_id }, null, 
            { leave_type, start_date, end_date, total_days: totalDays }, 
            `Leave request submitted for ${totalDays} days`);

        res.json({
            success: true,
            request_id: requestId,
            message: 'Leave request submitted successfully',
            approver: level1Approver
        });

    } catch (error) {
        console.error('[LEAVE SUBMIT ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Approve/Reject leave request
router.put('/leave/:requestId/action', async (req, res) => {
    const { requestId } = req.params;
    const { action, comments, approver_id } = req.body;

    try {
        // Get current request
        const requests = await db.query(`
            SELECT * FROM leave_requests_enterprise WHERE request_id = ?
        `, [requestId]);

        if (!requests || requests.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = requests[0];
        const oldStatus = request.status;

        if (action === 'approve') {
            const currentLevel = request.current_level;
            
            // Update current level approval
            await db.query(`
                UPDATE leave_requests_enterprise 
                SET level${currentLevel}_status = 'approved',
                    level${currentLevel}_action_at = NOW(),
                    level${currentLevel}_comments = ?
                WHERE request_id = ?
            `, [comments, requestId]);

            // Check if more approvals needed
            let nextLevel = null;
            if (currentLevel === 1 && request.level2_status === 'pending') {
                nextLevel = 2;
            } else if (currentLevel === 2 && request.level3_status === 'pending') {
                nextLevel = 3;
            }

            if (nextLevel) {
                // Move to next level
                const nextApprover = request[`level${nextLevel}_approver`];
                await db.query(`
                    UPDATE leave_requests_enterprise 
                    SET current_level = ?, current_approver = ?, sla_deadline = DATE_ADD(NOW(), INTERVAL 48 HOUR)
                    WHERE request_id = ?
                `, [nextLevel, nextApprover, requestId]);

                await NotificationService.sendPusherNotification(`user-${nextApprover}`, 'leave-pending-approval', {
                    request_id: requestId,
                    message: 'New leave request awaiting your approval',
                    level: nextLevel
                });
                
                res.json({ 
                    success: true, 
                    message: `Leave approved at level ${currentLevel}, moved to level ${nextLevel}`,
                    new_status: 'pending_next_level'
                });
            } else {
                // Fully approved
                await db.query(`
                    UPDATE leave_requests_enterprise 
                    SET status = 'approved'
                    WHERE request_id = ?
                `, [requestId]);

                // Deduct from leave balance
                await db.query(`
                    UPDATE leave_balances_v2 
                    SET used_days = used_days + ?
                    WHERE emp_id = ? AND leave_type = ? AND year = YEAR(NOW())
                `, [request.total_days, request.emp_id, request.leave_type]);

                // Create Google Calendar event
                try {
                    await GoogleCalendarService.createLeaveEvent(request.emp_id, requestId, request);
                } catch (calError) {
                    console.log('[CALENDAR] Calendar sync skipped:', calError.message);
                }

                await NotificationService.notifyLeaveRequest(requestId, 'approved');
                
                res.json({ 
                    success: true, 
                    message: 'Leave request fully approved',
                    new_status: 'approved'
                });
            }

        } else if (action === 'reject') {
            await db.query(`
                UPDATE leave_requests_enterprise 
                SET status = 'rejected',
                    level${request.current_level}_status = 'rejected',
                    level${request.current_level}_action_at = NOW(),
                    level${request.current_level}_comments = ?
                WHERE request_id = ?
            `, [comments, requestId]);

            await NotificationService.notifyLeaveRequest(requestId, 'rejected');
            
            res.json({ 
                success: true, 
                message: 'Leave request rejected',
                new_status: 'rejected'
            });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }

        // Audit log
        await AuditService.log('leave_request', requestId, action, { emp_id: approver_id },
            { status: oldStatus }, { status: action === 'approve' ? 'approved' : 'rejected' },
            `Leave request ${action}ed at level ${request.current_level}`);

        // Broadcast HR update
        await NotificationService.broadcastHRUpdate('leave-status-changed', {
            request_id: requestId,
            action: action
        });

    } catch (error) {
        console.error('[LEAVE ACTION ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// BULK OPERATIONS - APPROVE 50+ LEAVES
// ============================================================
router.post('/leave/bulk-action', async (req, res) => {
    const { request_ids, action, comments, approver_id } = req.body;

    if (!request_ids || request_ids.length === 0) {
        return res.status(400).json({ error: 'No request IDs provided' });
    }

    const operationId = `BULK-${Date.now()}`;
    const results = { success: [], failed: [] };

    try {
        // Create bulk operation log
        await db.query(`
            INSERT INTO bulk_operations_log 
            (operation_id, operation_type, initiated_by, total_records, affected_ids, status)
            VALUES (?, ?, ?, ?, ?, 'processing')
        `, [operationId, `bulk_${action}`, approver_id, request_ids.length, JSON.stringify(request_ids)]);

        // Process each request
        for (const requestId of request_ids) {
            try {
                const requests = await db.query(`
                    SELECT * FROM leave_requests_enterprise WHERE request_id = ? AND status = 'pending'
                `, [requestId]);

                if (!requests || requests.length === 0) {
                    results.failed.push({ id: requestId, error: 'Not found or not pending' });
                    continue;
                }

                const request = requests[0];

                if (action === 'approve') {
                    // Fast approve - skip to final status
                    await db.query(`
                        UPDATE leave_requests_enterprise 
                        SET status = 'approved',
                            level1_status = 'approved',
                            level1_action_at = NOW(),
                            level1_comments = ?,
                            level2_status = CASE WHEN level2_status = 'pending' THEN 'approved' ELSE level2_status END,
                            level3_status = CASE WHEN level3_status = 'pending' THEN 'approved' ELSE level3_status END
                        WHERE request_id = ?
                    `, [comments || 'Bulk approved', requestId]);

                    // Update balance
                    await db.query(`
                        UPDATE leave_balances_v2 
                        SET used_days = used_days + ?
                        WHERE emp_id = ? AND leave_type = ? AND year = YEAR(NOW())
                    `, [request.total_days, request.emp_id, request.leave_type]);

                    // Queue calendar event (async)
                    GoogleCalendarService.createLeaveEvent(request.emp_id, requestId, request).catch(console.error);

                } else if (action === 'reject') {
                    await db.query(`
                        UPDATE leave_requests_enterprise 
                        SET status = 'rejected',
                            level1_status = 'rejected',
                            level1_action_at = NOW(),
                            level1_comments = ?
                        WHERE request_id = ?
                    `, [comments || 'Bulk rejected', requestId]);
                }

                results.success.push(requestId);

                // Send notification (batched)
                NotificationService.notifyLeaveRequest(requestId, action === 'approve' ? 'approved' : 'rejected')
                    .catch(console.error);

            } catch (err) {
                results.failed.push({ id: requestId, error: err.message });
            }
        }

        // Update bulk operation log
        await db.query(`
            UPDATE bulk_operations_log 
            SET successful_records = ?, failed_records = ?, results = ?, 
                status = ?, completed_at = NOW()
            WHERE operation_id = ?
        `, [
            results.success.length,
            results.failed.length,
            JSON.stringify(results),
            results.failed.length === 0 ? 'completed' : 'partial',
            operationId
        ]);

        // Audit log
        await AuditService.log('bulk_operation', operationId, 'bulk_action', { emp_id: approver_id },
            null, { action, count: request_ids.length, success: results.success.length },
            `Bulk ${action}: ${results.success.length}/${request_ids.length} successful`);

        // Broadcast HR dashboard update
        await NotificationService.broadcastHRUpdate('bulk-action-complete', {
            operation_id: operationId,
            action: action,
            total: request_ids.length,
            success: results.success.length,
            failed: results.failed.length
        });

        res.json({
            success: true,
            operation_id: operationId,
            total: request_ids.length,
            successful: results.success.length,
            failed: results.failed.length,
            results: results
        });

    } catch (error) {
        console.error('[BULK ACTION ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// HR ANALYTICS DASHBOARD
// ============================================================
router.get('/analytics/dashboard', async (req, res) => {
    try {
        // Pending requests count
        const pending = await db.execute(`
            SELECT COUNT(*) as count FROM leave_requests_enterprise WHERE status = 'pending'
        `);

        // This month stats
        const monthStats = await db.execute(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(total_days) as total_days_requested
            FROM leave_requests_enterprise 
            WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
        `);

        // By leave type
        const byLeaveType = await db.execute(`
            SELECT leave_type, COUNT(*) as count, SUM(total_days) as total_days
            FROM leave_requests_enterprise 
            WHERE MONTH(created_at) = MONTH(NOW())
            GROUP BY leave_type
        `);

        // By department
        const byDepartment = await db.execute(`
            SELECT e.department, COUNT(*) as count, SUM(lr.total_days) as total_days
            FROM leave_requests_enterprise lr
            JOIN employees e ON lr.emp_id = e.emp_id
            WHERE MONTH(lr.created_at) = MONTH(NOW())
            GROUP BY e.department
        `);

        // SLA breaches
        const slaBreaches = await db.execute(`
            SELECT COUNT(*) as count 
            FROM leave_requests_enterprise 
            WHERE sla_breached = 1 AND status = 'pending'
        `);

        // Daily trend (last 30 days)
        const dailyTrend = await db.execute(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM leave_requests_enterprise
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date
        `);

        // Pending by approver
        const pendingByApprover = await db.execute(`
            SELECT e.full_name as approver_name, e.emp_id, COUNT(*) as pending_count
            FROM leave_requests_enterprise lr
            JOIN employees e ON lr.current_approver = e.emp_id
            WHERE lr.status = 'pending'
            GROUP BY lr.current_approver
            ORDER BY pending_count DESC
            LIMIT 10
        `);

        // Approval time stats
        const approvalTime = await db.execute(`
            SELECT 
                AVG(TIMESTAMPDIFF(HOUR, created_at, level1_action_at)) as avg_hours_level1,
                MIN(TIMESTAMPDIFF(HOUR, created_at, level1_action_at)) as min_hours,
                MAX(TIMESTAMPDIFF(HOUR, created_at, level1_action_at)) as max_hours
            FROM leave_requests_enterprise 
            WHERE level1_action_at IS NOT NULL
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        res.json({
            summary: {
                pending_requests: pending[0]?.count || 0,
                month_total: monthStats[0]?.total_requests || 0,
                month_approved: monthStats[0]?.approved || 0,
                month_rejected: monthStats[0]?.rejected || 0,
                month_pending: monthStats[0]?.pending || 0,
                total_days_requested: monthStats[0]?.total_days_requested || 0,
                sla_breaches: slaBreaches[0]?.count || 0
            },
            by_leave_type: byLeaveType || [],
            by_department: byDepartment || [],
            daily_trend: dailyTrend || [],
            pending_by_approver: pendingByApprover || [],
            approval_metrics: approvalTime[0] || {}
        });

    } catch (error) {
        console.error('[ANALYTICS ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all pending requests (HR view)
router.get('/leave/pending', async (req, res) => {
    const { page = 1, limit = 50, department, country_code, leave_type } = req.query;
    const offset = (page - 1) * parseInt(limit);

    try {
        let whereClause = "WHERE lr.status = 'pending'";
        const params = [];

        if (department) {
            whereClause += " AND e.department = ?";
            params.push(department);
        }
        if (country_code) {
            whereClause += " AND lr.country_code = ?";
            params.push(country_code);
        }
        if (leave_type) {
            whereClause += " AND lr.leave_type = ?";
            params.push(leave_type);
        }

        const requests = await db.query(`
            SELECT lr.*, e.full_name, e.email, e.department, e.position,
                   m.full_name as approver_name, m.email as approver_email,
                   TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) as hours_pending,
                   lr.sla_deadline < NOW() as is_sla_breached
            FROM leave_requests_enterprise lr
            JOIN employees e ON lr.emp_id = e.emp_id
            LEFT JOIN employees m ON lr.current_approver = m.emp_id
            ${whereClause}
            ORDER BY lr.sla_breached DESC, lr.created_at ASC
            LIMIT ${parseInt(limit)} OFFSET ${offset}
        `);

        const countResult = await db.query(`
            SELECT COUNT(*) as total
            FROM leave_requests_enterprise lr
            JOIN employees e ON lr.emp_id = e.emp_id
            ${whereClause}
        `);

        res.json({
            requests: requests || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0]?.total || 0,
                pages: Math.ceil((countResult[0]?.total || 0) / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('[PENDING REQUESTS ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// AUDIT REPORTS
// ============================================================
router.get('/audit/report', async (req, res) => {
    const { entity_type, start_date, end_date, action, actor_emp_id, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * parseInt(limit);

    try {
        let whereClause = "WHERE 1=1";

        if (entity_type) {
            whereClause += ` AND entity_type = '${entity_type}'`;
        }
        if (start_date) {
            whereClause += ` AND timestamp >= '${start_date}'`;
        }
        if (end_date) {
            whereClause += ` AND timestamp <= '${end_date}'`;
        }
        if (action) {
            whereClause += ` AND action = '${action}'`;
        }
        if (actor_emp_id) {
            whereClause += ` AND actor_emp_id = '${actor_emp_id}'`;
        }

        const audit = await db.query(`
            SELECT a.*, e.full_name as actor_name
            FROM audit_trail a
            LEFT JOIN employees e ON a.actor_emp_id = e.emp_id
            ${whereClause}
            ORDER BY timestamp DESC
            LIMIT ${parseInt(limit)} OFFSET ${offset}
        `);

        const countResult = await db.query(`
            SELECT COUNT(*) as total FROM audit_trail ${whereClause}
        `);

        res.json({
            audit_logs: audit || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0]?.total || 0
            }
        });

    } catch (error) {
        console.error('[AUDIT REPORT ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// EMPLOYEE HIERARCHY
// ============================================================
router.get('/hierarchy/:empId', async (req, res) => {
    const { empId } = req.params;

    try {
        // Get employee info
        const emp = await db.query(`
            SELECT e.*, 
                   m.full_name as manager_name, m.position as manager_position,
                   m2.full_name as skip_manager_name
            FROM employees e
            LEFT JOIN employees m ON e.manager_id = m.emp_id
            LEFT JOIN employees m2 ON m.manager_id = m2.emp_id
            WHERE e.emp_id = ?
        `, [empId]);

        if (!emp || emp.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Build approvers chain
        const approvers = [];
        let currentManagerId = emp[0].manager_id;
        let level = 0;
        
        while (currentManagerId && level < 5) {
            const manager = await db.query(`
                SELECT emp_id, full_name, position, email, department, manager_id
                FROM employees WHERE emp_id = ?
            `, [currentManagerId]);
            
            if (manager && manager.length > 0) {
                approvers.push({
                    emp_id: manager[0].emp_id,
                    name: manager[0].full_name,
                    position: manager[0].position,
                    email: manager[0].email,
                    department: manager[0].department
                });
                currentManagerId = manager[0].manager_id;
                level++;
            } else {
                break;
            }
        }

        // Get direct reports
        const directReports = await db.query(`
            SELECT emp_id, full_name, position, email
            FROM employees WHERE manager_id = ?
        `, [empId]);

        // Get team members (same manager)
        const teamMembers = await db.query(`
            SELECT emp_id, full_name, position, email
            FROM employees 
            WHERE manager_id = ?
            AND emp_id != ?
        `, [emp[0].manager_id, empId]);

        res.json({
            employee: emp[0],
            approvers: approvers,
            direct_reports: directReports || [],
            team_members: teamMembers || []
        });

    } catch (error) {
        console.error('[HIERARCHY ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// SLA ESCALATION CRON JOB
// ============================================================
const runSLAEscalation = async () => {
    console.log('[CRON] Running SLA escalation check...');
    
    try {
        // Find breached SLAs - db.execute returns array directly, not wrapped
        const breached = await db.execute(`
            SELECT lr.*, e.full_name, e.email,
                   m.full_name as approver_name, m.email as approver_email
            FROM leave_requests_enterprise lr
            JOIN employees e ON lr.emp_id = e.emp_id
            LEFT JOIN employees m ON lr.current_approver = m.emp_id
            WHERE lr.status = 'pending' 
            AND lr.sla_deadline < NOW()
            AND lr.sla_breached = 0
        `);

        // Safely handle result - may be undefined if table doesn't exist
        const breachedList = Array.isArray(breached) ? breached : [];
        console.log(`[CRON] Found ${breachedList.length} SLA breaches`);

        for (const request of breachedList) {
            // Mark as breached
            await db.execute(`
                UPDATE leave_requests_enterprise 
                SET sla_breached = 1, escalation_count = escalation_count + 1, last_escalation_at = NOW()
                WHERE request_id = ?
            `, [request.request_id]);

            // Get next level approver
            const hierarchyResult = await db.execute(`
                SELECT * FROM approval_hierarchy WHERE emp_id = ? AND is_active = 1
            `, [request.emp_id]);
            const hierarchy = Array.isArray(hierarchyResult) ? hierarchyResult : [];

            let newApprover = null;
            if (hierarchy.length > 0) {
                const h = hierarchy[0];
                if (request.current_level === 1 && h.level2_approver) {
                    newApprover = h.level2_approver;
                } else if (request.current_level === 2 && h.level3_approver) {
                    newApprover = h.level3_approver;
                } else {
                    newApprover = h.hr_partner;
                }
            }

            if (newApprover) {
                // Log escalation
                await db.execute(`
                    INSERT INTO sla_escalation_log 
                    (request_id, escalation_level, from_approver, to_approver, reason, sla_hours_breached)
                    VALUES (?, ?, ?, ?, 'sla_breach', TIMESTAMPDIFF(HOUR, ?, NOW()))
                `, [request.request_id, request.current_level + 1, request.current_approver, newApprover, request.sla_deadline]);

                // Update request
                await db.execute(`
                    UPDATE leave_requests_enterprise 
                    SET current_approver = ?, current_level = current_level + 1,
                        sla_deadline = DATE_ADD(NOW(), INTERVAL 24 HOUR)
                    WHERE request_id = ?
                `, [newApprover, request.request_id]);

                // Notify
                await NotificationService.notifyLeaveRequest(request.request_id, 'escalated');
            }
        }

    } catch (error) {
        console.error('[CRON SLA ERROR]', error);
    }
};

// Schedule SLA check every 15 minutes
cron.schedule('*/15 * * * *', runSLAEscalation);

// ============================================================
// LEAVE ACCRUAL CRON JOB
// ============================================================
const runLeaveAccrual = async () => {
    const today = new Date();
    const isFirstOfMonth = today.getDate() === 1;
    
    if (!isFirstOfMonth) return;
    
    console.log('[CRON] Running monthly leave accrual...');
    
    try {
        // Get monthly accrual policies
        const policiesResult = await db.execute(`
            SELECT * FROM country_leave_policies 
            WHERE accrual_type = 'monthly' AND effective_to >= CURDATE()
        `);
        const policies = Array.isArray(policiesResult) ? policiesResult : [];

        for (const policy of policies) {
            const monthlyAccrual = policy.annual_entitlement / 12;

            // Get all active employees for this country
            const employeesResult = await db.execute(`
                SELECT emp_id FROM employees 
                WHERE country_code = ? AND is_active = 1
            `, [policy.country_code]);
            const employees = Array.isArray(employeesResult) ? employeesResult : [];

            for (const emp of employees) {
                // Update balance
                await db.execute(`
                    UPDATE leave_balances_v2 
                    SET accrued_to_date = accrued_to_date + ?, last_accrual_date = CURDATE()
                    WHERE emp_id = ? AND leave_type = ? AND year = YEAR(NOW())
                `, [monthlyAccrual, emp.emp_id, policy.leave_type]);

                // Log accrual
                await db.execute(`
                    INSERT INTO leave_accrual_log 
                    (emp_id, country_code, leave_type, accrual_date, accrual_period, days_accrued, days_before, days_after)
                    SELECT ?, ?, ?, CURDATE(), 'monthly', ?, accrued_to_date - ?, accrued_to_date
                    FROM leave_balances_v2 
                    WHERE emp_id = ? AND leave_type = ? AND year = YEAR(NOW())
                `, [emp.emp_id, policy.country_code, policy.leave_type, monthlyAccrual, monthlyAccrual, emp.emp_id, policy.leave_type]);
            }
        }

        console.log(`[CRON] Accrual complete for ${policies.length} policies`);

    } catch (error) {
        console.error('[CRON ACCRUAL ERROR]', error.message);
    }
};

// Schedule accrual on 1st of every month at 1 AM
cron.schedule('0 1 1 * *', runLeaveAccrual);

// ============================================================
// MANUAL TRIGGERS FOR TESTING
// ============================================================
router.post('/cron/sla-check', async (req, res) => {
    await runSLAEscalation();
    res.json({ success: true, message: 'SLA check executed' });
});

router.post('/cron/accrual', async (req, res) => {
    await runLeaveAccrual();
    res.json({ success: true, message: 'Accrual executed' });
});

// Test Pusher
router.post('/test/pusher', async (req, res) => {
    const { channel, event, message } = req.body;
    const result = await NotificationService.sendPusherNotification(
        channel || 'hr-notifications',
        event || 'test-event',
        { message: message || 'Test notification from server', timestamp: new Date().toISOString() }
    );
    res.json({ success: result });
});

module.exports = router;
