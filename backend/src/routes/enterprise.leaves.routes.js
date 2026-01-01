/**
 * Enterprise Leave Management Routes
 * Production-ready endpoints for big IT companies
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const db = require('../config/db');
const axios = require('axios');

// AI Engine URL
const AI_ENGINE_URL = process.env.LEAVE_AI_URL || 'http://localhost:8001';

// ============================================================
// LEAVE REQUEST MANAGEMENT
// ============================================================

/**
 * Submit a new leave request with full validation
 */
router.post('/submit', authenticateToken, async (req, res) => {
    try {
        const {
            leave_type,
            start_date,
            end_date,
            is_half_day = false,
            half_day_type = null,
            reason = '',
            emergency_contact = null,
            handover_to = null,
            attachments = []
        } = req.body;

        const emp_id = req.user?.emp_id || req.user?.employeeId;
        if (!emp_id) {
            return res.status(400).json({ success: false, error: 'Employee ID required' });
        }

        // Get employee details (using country_code directly if available)
        const employee = await db.getOne(
            'SELECT * FROM employees WHERE emp_id = ?',
            [emp_id]
        );

        if (!employee) {
            return res.status(404).json({ success: false, error: 'Employee not found' });
        }

        const country_code = employee.country_code || 'IN';

        // Calculate working days via AI engine
        let workingDays;
        try {
            const calcResponse = await axios.post(`${AI_ENGINE_URL}/calculate-working-days`, {
                country_code,
                start_date,
                end_date,
                is_half_day
            });
            workingDays = calcResponse.data;
        } catch (e) {
            // Fallback calculation
            const start = new Date(start_date);
            const end = new Date(end_date);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            workingDays = { working_days: is_half_day ? days - 0.5 : days, total_days: days };
        }

        // Generate request ID
        const request_id = `LR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // =====================================================
        // GET AI MODE CONFIGURATION
        // =====================================================
        let aiMode = 'automatic';
        let normalModeAutoApproveTypes = ['sick_leave'];
        try {
            const modeConfig = await db.getOne(
                "SELECT config_value FROM ai_system_config WHERE config_key = 'leave_ai_mode'"
            );
            aiMode = modeConfig?.config_value || 'automatic';

            const autoApproveTypesConfig = await db.getOne(
                "SELECT config_value FROM ai_system_config WHERE config_key = 'normal_mode_auto_approve_types'"
            );
            if (autoApproveTypesConfig?.config_value) {
                normalModeAutoApproveTypes = JSON.parse(autoApproveTypesConfig.config_value);
            }
        } catch (configError) {
            console.warn('Could not fetch AI mode config, using default:', configError.message);
        }

        // Analyze with AI engine
        let aiAnalysis;
        let aiEngineAvailable = false;
        try {
            const analysisResponse = await axios.post(`${AI_ENGINE_URL}/analyze`, {
                request_id,
                emp_id,
                country_code,
                leave_type,
                start_date,
                end_date,
                total_days: workingDays.total_days,
                working_days: workingDays.working_days,
                is_half_day,
                half_day_type,
                reason,
                attachments,
                handover_to
            }, { timeout: 5000 });
            aiAnalysis = analysisResponse.data;
            aiEngineAvailable = true;
        } catch (e) {
            console.error('AI Analysis error:', e.message);
            // Fallback when AI engine is offline
            const isSickLeave = leave_type === 'sick_leave';
            const isShortLeave = workingDays.working_days <= 3;
            
            // In automatic mode: auto-approve short leaves (<= 3 days)
            // In normal mode: only sick_leave auto-approves
            let shouldAutoApprove = false;
            if (aiMode === 'automatic') {
                shouldAutoApprove = isShortLeave; // Auto-approve short leaves in automatic mode
            } else {
                shouldAutoApprove = isSickLeave && isShortLeave; // Only sick leave in normal mode
            }
            
            aiAnalysis = {
                recommendation: shouldAutoApprove ? 'approve' : 'review',
                confidence: shouldAutoApprove ? 0.8 : 0.5,
                can_auto_approve: shouldAutoApprove,
                approval_chain: { levels: [{ level: 1, role: 'manager' }] },
                ai_engine_offline: true
            };
        }

        // =====================================================
        // DETERMINE STATUS BASED ON AI MODE
        // =====================================================
        let initialStatus = 'pending';
        let currentApprovalLevel = 1;
        let processingNotes = '';
        let hrAssignedAt = null;
        
        if (aiMode === 'automatic') {
            // AUTOMATIC MODE: AI handles all leave types
            if (aiAnalysis.can_auto_approve && aiAnalysis.recommendation === 'approve') {
                initialStatus = 'approved';
                processingNotes = 'Auto-approved by AI in automatic mode';
            } else if (aiAnalysis.recommendation === 'reject' && aiAnalysis.constraints?.critical_failures?.length > 0) {
                initialStatus = 'pending_hr';
                processingNotes = 'Flagged for HR review due to policy violations';
            } else {
                initialStatus = 'pending';
                processingNotes = `AI recommendation: ${aiAnalysis.recommendation}. Awaiting approval.`;
            }
        } else {
            // NORMAL MODE: AI only auto-approves specific leave types (default: sick_leave)
            const canAIHandle = normalModeAutoApproveTypes.includes(leave_type);
            
            if (canAIHandle) {
                // This leave type can be auto-processed by AI in normal mode
                if (aiAnalysis.can_auto_approve && aiAnalysis.recommendation === 'approve') {
                    initialStatus = 'approved';
                    processingNotes = `Auto-approved by AI in normal mode (${leave_type} is auto-approve eligible)`;
                } else if (aiAnalysis.recommendation === 'escalate' || aiAnalysis.recommendation === 'review') {
                    // Even sick leave can be escalated if rules don't match
                    initialStatus = 'pending';
                    hrAssignedAt = new Date();
                    processingNotes = `AI could not auto-approve ${leave_type}. Escalated to HR for review.`;
                } else {
                    initialStatus = 'pending';
                    hrAssignedAt = new Date();
                    processingNotes = `${leave_type} requires HR review in normal mode`;
                }
            } else {
                // This leave type goes directly to HR in normal mode
                initialStatus = 'pending';
                hrAssignedAt = new Date();
                processingNotes = `Normal mode active: ${leave_type} assigned to HR for review. Employee can set priority after 7 hours if no HR response.`;
            }
        }

        // Insert leave request (using columns that exist in the table)
        await db.execute(`
            INSERT INTO leave_requests (
                request_id, emp_id, leave_type, start_date, end_date,
                total_days, status, reason, constraint_engine_decision,
                ai_mode_at_submission, hr_assigned_at, processing_notes,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            request_id, emp_id, leave_type, start_date, end_date,
            workingDays.working_days, initialStatus, reason,
            JSON.stringify({ recommendation: aiAnalysis.recommendation, confidence: aiAnalysis.confidence }),
            aiMode, hrAssignedAt, processingNotes
        ]);

        // Log to audit
        await logAudit({
            entity_type: 'leave_request',
            entity_id: request_id,
            action: 'create',
            user_id: emp_id,
            new_values: { leave_type, start_date, end_date, status: initialStatus },
            ip_address: req.ip
        });

        // If auto-approved, update balance
        if (initialStatus === 'approved') {
            await updateLeaveBalance(emp_id, leave_type, workingDays.working_days);
            await logAudit({
                entity_type: 'leave_request',
                entity_id: request_id,
                action: 'approve',
                user_id: 'AI_ENGINE',
                change_reason: 'Auto-approved by AI engine'
            });
        }

        // Queue notifications
        await queueNotification({
            recipient_id: emp_id,
            notification_type: initialStatus === 'approved' ? 'leave_approved' : 'leave_submitted',
            reference_type: 'leave_request',
            reference_id: request_id,
            data: {
                employee_name: employee.full_name,
                leave_type,
                start_date,
                end_date,
                working_days: workingDays.working_days
            }
        });

        // Notify HR if assigned in normal mode
        if (aiMode === 'normal' && hrAssignedAt && initialStatus === 'pending') {
            try {
                await db.execute(`
                    INSERT INTO hr_notification_queue 
                    (notification_type, request_id, recipient_role, priority_level, title, message, data)
                    VALUES ('pending_review', ?, 'hr', 'normal', ?, ?, ?)
                `, [
                    request_id,
                    `New Leave Request: ${employee.full_name} - ${leave_type}`,
                    `${employee.full_name} has submitted a ${leave_type} request for ${workingDays.working_days} day(s).`,
                    JSON.stringify({
                        employeeName: employee.full_name,
                        leaveType: leave_type,
                        startDate: start_date,
                        endDate: end_date,
                        totalDays: workingDays.working_days,
                        reason
                    })
                ]);
            } catch (notifyError) {
                console.warn('Could not create HR notification:', notifyError.message);
            }
        }

        // Build response message based on mode
        let responseMessage;
        if (initialStatus === 'approved') {
            responseMessage = 'Leave request auto-approved!';
        } else if (aiMode === 'normal') {
            responseMessage = `Leave request submitted. Your ${leave_type} request has been sent to HR for review. If you don't receive a response within 7 hours, you can set a priority badge.`;
        } else {
            responseMessage = 'Leave request submitted for approval';
        }

        res.json({
            success: true,
            request_id,
            status: initialStatus,
            working_days: workingDays.working_days,
            ai_mode: aiMode,
            processing_notes: processingNotes,
            ai_analysis: {
                recommendation: aiAnalysis.recommendation,
                confidence: aiAnalysis.confidence,
                warnings: aiAnalysis.constraints?.warnings?.length || 0,
                critical_issues: aiAnalysis.constraints?.critical_failures?.length || 0
            },
            approval_chain: aiAnalysis.approval_chain,
            priority_badge_info: aiMode === 'normal' && initialStatus === 'pending' ? {
                canSetPriorityAfterHours: 7,
                description: 'If HR does not respond within 7 hours, you can set a priority badge (Yellow for non-urgent, Red for emergency)'
            } : null,
            message: responseMessage
        });

    } catch (error) {
        console.error('Submit leave error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get detailed leave analysis without submitting
 */
router.post('/preview', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.user?.emp_id || req.user?.employeeId;
        const { leave_type, start_date, end_date, is_half_day = false } = req.body;

        // Get employee details
        const employee = await db.getOne(
            'SELECT e.*, c.country_code FROM employees e LEFT JOIN countries c ON e.country = c.country_name WHERE e.emp_id = ?',
            [emp_id]
        );

        const country_code = employee?.country_code || 'IN';

        // Get full AI analysis
        const analysisResponse = await axios.post(`${AI_ENGINE_URL}/analyze`, {
            emp_id,
            country_code,
            leave_type,
            start_date,
            end_date,
            is_half_day,
            preview_only: true
        });

        res.json({
            success: true,
            preview: true,
            ...analysisResponse.data
        });

    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all leave requests with filters
 */
router.get('/all', authenticateToken, async (req, res) => {
    try {
        const { status, department, leave_type, start_date, end_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT lr.*, 
                   e.full_name as employee_name,
                   e.department,
                   e.email as employee_email
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND lr.status = ?';
            params.push(status);
        }
        if (department) {
            query += ' AND e.department = ?';
            params.push(department);
        }
        if (leave_type) {
            query += ' AND lr.leave_type = ?';
            params.push(leave_type);
        }
        if (start_date) {
            query += ' AND lr.start_date >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND lr.end_date <= ?';
            params.push(end_date);
        }

        query += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const leaves = await db.query(query, params);

        // Get total count
        const countResult = await db.getOne(
            'SELECT COUNT(*) as total FROM leave_requests',
            []
        );

        res.json({
            success: true,
            leaves,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult?.total || 0,
                pages: Math.ceil((countResult?.total || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Get all leaves error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get my leave requests
 */
router.get('/my-leaves', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.user?.emp_id || req.user?.employeeId || req.user?.id;
        const { year = new Date().getFullYear() } = req.query;

        const leaves = await db.query(`
            SELECT * FROM leave_requests 
            WHERE emp_id = ? AND YEAR(start_date) = ?
            ORDER BY created_at DESC
        `, [emp_id, year]);

        res.json({ success: true, leaves: leaves || [] });

    } catch (error) {
        console.error('Get my leaves error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update leave status (approve/reject)
 */
router.put('/:requestId/status', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, comments } = req.body;
        const approver_id = req.user?.id || req.user?.emp_id;
        const approver_name = req.user?.name || 'HR';
        const approver_role = req.user?.role || 'hr';

        const validStatuses = ['approved', 'rejected', 'Approved', 'Rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const normalizedStatus = status.toLowerCase();

        // Get current request
        const request = await db.getOne(
            'SELECT * FROM leave_requests WHERE request_id = ?',
            [requestId]
        );

        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        // Update request
        await db.execute(`
            UPDATE leave_requests 
            SET status = ?, 
                approved_by = ?,
                approval_date = NOW()
            WHERE request_id = ?
        `, [normalizedStatus, `${approver_role.toUpperCase()}:${approver_name}`, requestId]);

        // If approved, update balance
        if (normalizedStatus === 'approved') {
            await updateLeaveBalance(request.emp_id, request.leave_type, request.total_days);
        }

        // Log approval workflow
        await db.execute(`
            INSERT INTO approval_workflow_log 
            (request_id, approval_level, approver_id, approver_role, action, comments, action_at)
            VALUES (?, 1, ?, ?, ?, ?, NOW())
        `, [requestId, approver_id, approver_role, normalizedStatus, comments || null]);

        // Log audit
        await logAudit({
            entity_type: 'leave_request',
            entity_id: requestId,
            action: normalizedStatus === 'approved' ? 'approve' : 'reject',
            user_id: approver_id,
            user_role: approver_role,
            old_values: { status: request.status },
            new_values: { status: normalizedStatus },
            change_reason: comments
        });

        // Queue notification to employee
        await queueNotification({
            recipient_id: request.emp_id,
            notification_type: normalizedStatus === 'approved' ? 'leave_approved' : 'leave_rejected',
            reference_type: 'leave_request',
            reference_id: requestId,
            data: {
                leave_type: request.leave_type,
                start_date: request.start_date,
                end_date: request.end_date,
                approved_by: approver_name,
                rejection_reason: comments
            }
        });

        res.json({
            success: true,
            message: `Leave ${normalizedStatus} successfully`,
            request_id: requestId,
            new_status: normalizedStatus
        });

    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Cancel a leave request
 */
router.put('/:requestId/cancel', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { reason } = req.body;
        const emp_id = req.user?.emp_id || req.user?.employeeId;

        const request = await db.getOne(
            'SELECT * FROM leave_requests WHERE request_id = ? AND emp_id = ?',
            [requestId, emp_id]
        );

        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found or not authorized' });
        }

        if (request.status === 'rejected' || request.status === 'cancelled') {
            return res.status(400).json({ success: false, error: 'Cannot cancel this request' });
        }

        const previousStatus = request.status;

        await db.execute(`
            UPDATE leave_requests 
            SET status = 'cancelled', cancelled_at = NOW()
            WHERE request_id = ?
        `, [requestId]);

        // If was approved, restore balance
        if (previousStatus === 'approved') {
            await restoreLeaveBalance(emp_id, request.leave_type, request.total_days);
        }

        // Log audit
        await logAudit({
            entity_type: 'leave_request',
            entity_id: requestId,
            action: 'cancel',
            user_id: emp_id,
            old_values: { status: previousStatus },
            new_values: { status: 'cancelled' },
            change_reason: reason
        });

        res.json({ success: true, message: 'Leave request cancelled' });

    } catch (error) {
        console.error('Cancel leave error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// LEAVE BALANCE MANAGEMENT
// ============================================================

/**
 * Get leave balances for employee
 */
router.get('/balance/:empId?', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.params.empId || req.user?.emp_id || req.user?.employeeId;
        const year = req.query.year || new Date().getFullYear();

        // Try v2 balances first
        let balances = await db.query(`
            SELECT * FROM leave_balances_v2 
            WHERE emp_id = ? AND year = ?
        `, [emp_id, year]);

        // Fallback to original table
        if (!balances || balances.length === 0) {
            balances = await db.query(`
                SELECT emp_id, leave_type, 
                       annual_quota as annual_entitlement,
                       0 as carried_forward,
                       used_so_far as used_days,
                       0 as pending_days,
                       (annual_quota - used_so_far) as available_balance
                FROM leave_balances 
                WHERE emp_id = ?
            `, [emp_id]);
        }

        res.json({ success: true, year, balances: balances || [] });

    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Initialize leave balances for a new employee
 */
router.post('/balance/initialize', authenticateToken, async (req, res) => {
    try {
        const { emp_id, country_code = 'IN', year = new Date().getFullYear() } = req.body;

        // Get country policies
        const policies = await db.query(`
            SELECT * FROM country_leave_policies 
            WHERE country_code = ?
            AND CURDATE() BETWEEN effective_from AND effective_to
        `, [country_code]);

        if (!policies || policies.length === 0) {
            return res.status(404).json({ success: false, error: 'No policies found for country' });
        }

        // Create balances for each leave type
        for (const policy of policies) {
            await db.execute(`
                INSERT IGNORE INTO leave_balances_v2 
                (emp_id, country_code, leave_type, year, annual_entitlement)
                VALUES (?, ?, ?, ?, ?)
            `, [emp_id, country_code, policy.leave_type, year, policy.annual_entitlement]);
        }

        res.json({ success: true, message: 'Leave balances initialized', count: policies.length });

    } catch (error) {
        console.error('Initialize balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// COMP-OFF MANAGEMENT
// ============================================================

/**
 * Request comp-off for extra work
 */
router.post('/comp-off/request', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.user?.emp_id || req.user?.employeeId;
        const {
            work_date,
            work_type, // 'weekend', 'holiday', 'overtime'
            hours_worked,
            project_code,
            task_description
        } = req.body;

        // Get employee country for expiry calculation
        const employee = await db.getOne(
            'SELECT country FROM employees WHERE emp_id = ?',
            [emp_id]
        );
        const country_code = employee?.country_code || 'IN';

        // Get comp-off policy
        const policy = await db.getOne(`
            SELECT * FROM country_leave_policies 
            WHERE country_code = ? AND leave_type = 'comp_off'
            AND CURDATE() BETWEEN effective_from AND effective_to
        `, [country_code]);

        // Calculate days earned (typically 0.5 for < 6 hours, 1 for full day)
        const days_earned = hours_worked >= 8 ? 1 : 0.5;

        // Calculate expiry date (from policy or default 90 days)
        const expiryMonths = policy?.carry_forward_expiry_months || 3;
        const expires_at = new Date();
        expires_at.setMonth(expires_at.getMonth() + expiryMonths);

        await db.execute(`
            INSERT INTO comp_off_records 
            (emp_id, country_code, work_date, work_type, hours_worked, days_earned, expires_at, project_code, task_description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [emp_id, country_code, work_date, work_type, hours_worked, days_earned, expires_at, project_code, task_description]);

        res.json({
            success: true,
            message: 'Comp-off request submitted',
            days_earned,
            expires_at: expires_at.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Comp-off request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get comp-off balance
 */
router.get('/comp-off/balance/:empId?', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.params.empId || req.user?.emp_id || req.user?.employeeId;

        const compOffs = await db.query(`
            SELECT * FROM comp_off_records 
            WHERE emp_id = ? AND approval_status = 'approved' AND expires_at >= CURDATE()
            ORDER BY expires_at ASC
        `, [emp_id]);

        const totalAvailable = compOffs.reduce((sum, co) => sum + (co.days_remaining || 0), 0);

        // Get expiring soon (within 30 days)
        const expiringSoon = compOffs.filter(co => {
            const expiryDate = new Date(co.expires_at);
            const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 30;
        });

        res.json({
            success: true,
            total_available: totalAvailable,
            comp_offs: compOffs,
            expiring_soon: expiringSoon,
            expiring_days: expiringSoon.reduce((sum, co) => sum + (co.days_remaining || 0), 0)
        });

    } catch (error) {
        console.error('Comp-off balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Approve comp-off request (manager)
 */
router.put('/comp-off/:compOffId/approve', authenticateToken, async (req, res) => {
    try {
        const { compOffId } = req.params;
        const approver_id = req.user?.id || req.user?.emp_id;

        await db.execute(`
            UPDATE comp_off_records 
            SET approval_status = 'approved', approved_by = ?, approved_at = NOW()
            WHERE comp_off_id = ?
        `, [approver_id, compOffId]);

        res.json({ success: true, message: 'Comp-off approved' });

    } catch (error) {
        console.error('Approve comp-off error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// LEAVE ENCASHMENT
// ============================================================

/**
 * Request leave encashment
 */
router.post('/encashment/request', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.user?.emp_id || req.user?.employeeId;
        const { leave_type, days_requested } = req.body;

        // Get employee and balance
        const employee = await db.getOne(
            'SELECT e.*, c.country_code, c.currency_code FROM employees e LEFT JOIN countries c ON e.country = c.country_name WHERE e.emp_id = ?',
            [emp_id]
        );

        const country_code = employee?.country_code || 'IN';

        // Check policy allows encashment
        const policy = await db.getOne(`
            SELECT * FROM country_leave_policies 
            WHERE country_code = ? AND leave_type = ?
            AND CURDATE() BETWEEN effective_from AND effective_to
        `, [country_code, leave_type]);

        if (!policy?.encashment_allowed) {
            return res.status(400).json({ success: false, error: 'Encashment not allowed for this leave type' });
        }

        if (days_requested > policy.encashment_max_days) {
            return res.status(400).json({
                success: false,
                error: `Maximum ${policy.encashment_max_days} days can be encashed`
            });
        }

        // Get balance
        const balance = await db.getOne(`
            SELECT available_balance FROM leave_balances_v2 
            WHERE emp_id = ? AND leave_type = ? AND year = YEAR(CURDATE())
        `, [emp_id, leave_type]);

        if (!balance || balance.available_balance < days_requested) {
            return res.status(400).json({ success: false, error: 'Insufficient leave balance' });
        }

        // Calculate encashment value (simplified - in production, get from payroll)
        const daily_rate = employee.salary ? employee.salary / 22 : 0;
        const gross_amount = daily_rate * days_requested;
        const tax_rate = { 'IN': 0.30, 'US': 0.22, 'UK': 0.20, 'DE': 0.42 }[country_code] || 0.25;
        const tax_deduction = gross_amount * tax_rate;
        const net_amount = gross_amount - tax_deduction;

        // Create encashment request
        const result = await db.execute(`
            INSERT INTO leave_encashment_requests 
            (emp_id, country_code, leave_type, days_requested, daily_rate, gross_amount, tax_deduction, net_amount, currency_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [emp_id, country_code, leave_type, days_requested, daily_rate, gross_amount, tax_deduction, net_amount, employee.currency_code || 'USD']);

        res.json({
            success: true,
            message: 'Encashment request submitted',
            encashment_id: result.insertId,
            calculation: {
                days: days_requested,
                daily_rate: Math.round(daily_rate * 100) / 100,
                gross_amount: Math.round(gross_amount * 100) / 100,
                tax_deduction: Math.round(tax_deduction * 100) / 100,
                net_amount: Math.round(net_amount * 100) / 100,
                currency: employee.currency_code || 'USD'
            }
        });

    } catch (error) {
        console.error('Encashment request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get encashment requests
 */
router.get('/encashment/requests/:empId?', authenticateToken, async (req, res) => {
    try {
        const emp_id = req.params.empId || req.user?.emp_id || req.user?.employeeId;

        const requests = await db.query(`
            SELECT * FROM leave_encashment_requests 
            WHERE emp_id = ?
            ORDER BY requested_at DESC
        `, [emp_id]);

        res.json({ success: true, requests: requests || [] });

    } catch (error) {
        console.error('Get encashment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PUBLIC HOLIDAYS
// ============================================================

/**
 * Get public holidays for a country and year
 */
router.get('/holidays/:countryCode/:year', authenticateToken, async (req, res) => {
    try {
        const { countryCode, year } = req.params;

        const holidays = await db.query(`
            SELECT holiday_date, holiday_name, is_national, is_optional, state_province
            FROM public_holidays 
            WHERE country_code = ? AND YEAR(holiday_date) = ?
            ORDER BY holiday_date
        `, [countryCode.toUpperCase(), year]);

        res.json({
            success: true,
            country_code: countryCode.toUpperCase(),
            year: parseInt(year),
            holidays: holidays || [],
            total: holidays?.length || 0
        });

    } catch (error) {
        console.error('Get holidays error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add a public holiday (admin only)
 */
router.post('/holidays', authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'hr') {
            return res.status(403).json({ success: false, error: 'Admin or HR access required' });
        }

        const { country_code, holiday_date, holiday_name, is_national = true, is_optional = false, state_province = null } = req.body;

        await db.execute(`
            INSERT INTO public_holidays 
            (country_code, holiday_date, holiday_name, is_national, is_optional, state_province)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [country_code.toUpperCase(), holiday_date, holiday_name, is_national, is_optional, state_province]);

        res.json({ success: true, message: 'Holiday added successfully' });

    } catch (error) {
        console.error('Add holiday error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// COUNTRY POLICIES
// ============================================================

/**
 * Get leave policies for a country
 */
router.get('/policies/:countryCode', authenticateToken, async (req, res) => {
    try {
        const { countryCode } = req.params;

        const policies = await db.query(`
            SELECT * FROM country_leave_policies 
            WHERE country_code = ?
            AND CURDATE() BETWEEN effective_from AND effective_to
        `, [countryCode.toUpperCase()]);

        res.json({
            success: true,
            country_code: countryCode.toUpperCase(),
            policies: policies || []
        });

    } catch (error) {
        console.error('Get policies error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// TEAM CALENDAR
// ============================================================

/**
 * Get team leave calendar
 */
router.get('/team-calendar/:teamId', authenticateToken, async (req, res) => {
    try {
        const { teamId } = req.params;
        const { start_date, end_date } = req.query;

        const leaves = await db.query(`
            SELECT lr.*, e.full_name as employee_name, e.position
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            JOIN team_members tm ON e.emp_id = tm.emp_id
            WHERE tm.team_id = ?
            AND lr.status IN ('approved', 'pending')
            AND lr.start_date <= ? AND lr.end_date >= ?
            ORDER BY lr.start_date
        `, [teamId, end_date || '2099-12-31', start_date || '2000-01-01']);

        res.json({ success: true, team_id: teamId, leaves: leaves || [] });

    } catch (error) {
        console.error('Team calendar error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// STATISTICS & REPORTS
// ============================================================

/**
 * Get leave statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await db.getOne(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN YEARWEEK(created_at) = YEARWEEK(CURDATE()) THEN 1 ELSE 0 END) as this_week
            FROM leave_requests
            WHERE YEAR(created_at) = YEAR(CURDATE())
        `);

        const byType = await db.query(`
            SELECT leave_type, COUNT(*) as count, SUM(total_days) as total_days
            FROM leave_requests
            WHERE YEAR(created_at) = YEAR(CURDATE())
            GROUP BY leave_type
        `);

        res.json({
            success: true,
            stats: stats || {},
            by_type: byType || []
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// AUDIT LOG
// ============================================================

/**
 * Get audit log for a request
 */
router.get('/audit/:requestId', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;

        const logs = await db.query(`
            SELECT * FROM leave_audit_log 
            WHERE entity_type = 'leave_request' AND entity_id = ?
            ORDER BY created_at DESC
        `, [requestId]);

        const approvalLogs = await db.query(`
            SELECT * FROM approval_workflow_log 
            WHERE request_id = ?
            ORDER BY action_at ASC
        `, [requestId]);

        res.json({
            success: true,
            audit_logs: logs || [],
            approval_workflow: approvalLogs || []
        });

    } catch (error) {
        console.error('Audit log error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function updateLeaveBalance(emp_id, leave_type, days) {
    try {
        // Try v2 first
        const result = await db.execute(`
            UPDATE leave_balances_v2 
            SET used_days = used_days + ?
            WHERE emp_id = ? AND leave_type = ? AND year = YEAR(CURDATE())
        `, [days, emp_id, leave_type]);

        // Fallback to original
        if (result.affectedRows === 0) {
            await db.execute(`
                UPDATE leave_balances 
                SET used_so_far = used_so_far + ?
                WHERE emp_id = ? AND leave_type = ?
            `, [days, emp_id, leave_type]);
        }
    } catch (error) {
        console.error('Update balance error:', error);
    }
}

async function restoreLeaveBalance(emp_id, leave_type, days) {
    try {
        await db.execute(`
            UPDATE leave_balances_v2 
            SET used_days = used_days - ?
            WHERE emp_id = ? AND leave_type = ? AND year = YEAR(CURDATE())
        `, [days, emp_id, leave_type]);

        await db.execute(`
            UPDATE leave_balances 
            SET used_so_far = used_so_far - ?
            WHERE emp_id = ? AND leave_type = ?
        `, [days, emp_id, leave_type]);
    } catch (error) {
        console.error('Restore balance error:', error);
    }
}

async function logAudit(data) {
    try {
        await db.execute(`
            INSERT INTO leave_audit_log 
            (entity_type, entity_id, action, user_id, user_role, old_values, new_values, change_reason, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.entity_type,
            data.entity_id,
            data.action,
            data.user_id,
            data.user_role || null,
            data.old_values ? JSON.stringify(data.old_values) : null,
            data.new_values ? JSON.stringify(data.new_values) : null,
            data.change_reason || null,
            data.ip_address || null
        ]);
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

async function queueNotification(data) {
    try {
        await db.execute(`
            INSERT INTO notification_queue 
            (recipient_id, notification_type, reference_type, reference_id, subject, body_text)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            data.recipient_id,
            data.notification_type,
            data.reference_type,
            data.reference_id,
            `Leave ${data.notification_type.replace('leave_', '')}`,
            JSON.stringify(data.data)
        ]);
    } catch (error) {
        console.error('Queue notification error:', error);
    }
}

module.exports = router;
