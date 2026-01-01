/**
 * Leave System Scheduler Service
 * 
 * Handles time-based operations:
 * - Checking priority eligibility (after 7 hours)
 * - Processing escalations (after 24 hours for red badges)
 * - Sending reminder notifications
 */

const cron = require('node-cron');
const db = require('../config/db');
const axios = require('axios');
const nodemailer = require('nodemailer');

const AI_ENGINE_URL = process.env.LEAVE_AI_URL || 'http://localhost:8001';

// Email transporter
let emailTransporter = null;
try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
} catch (e) {
    console.warn('[Scheduler] Email transporter not configured');
}

class LeaveScheduler {
    constructor() {
        this.isRunning = false;
        this.jobs = [];
    }

    /**
     * Start all scheduled jobs
     */
    start() {
        if (this.isRunning) {
            console.log('[Scheduler] Already running');
            return;
        }

        console.log('[Scheduler] Starting leave system scheduler...');

        // Check priority eligibility every 30 minutes
        this.jobs.push(
            cron.schedule('*/30 * * * *', async () => {
                try {
                    console.log('[Scheduler] Running priority eligibility check...');
                    await this.checkPriorityEligibility();
                } catch (e) {
                    console.error('[Scheduler] Priority eligibility error:', e.message);
                }
            })
        );

        // Process escalations every hour
        this.jobs.push(
            cron.schedule('0 * * * *', async () => {
                try {
                    console.log('[Scheduler] Running escalation processor...');
                    await this.processEscalations();
                } catch (e) {
                    console.error('[Scheduler] Escalation processor error:', e.message);
                }
            })
        );

        // Send reminder emails every 2 hours during business hours (Mon-Fri 9-18)
        this.jobs.push(
            cron.schedule('0 */2 9-18 * * 1-5', async () => {
                try {
                    console.log('[Scheduler] Sending HR reminders...');
                    await this.sendHRReminders();
                } catch (e) {
                    console.error('[Scheduler] HR reminders error:', e.message);
                }
            })
        );

        // Clean up old notifications daily at midnight
        this.jobs.push(
            cron.schedule('0 0 * * *', async () => {
                try {
                    console.log('[Scheduler] Cleaning up old notifications...');
                    await this.cleanupOldNotifications();
                } catch (e) {
                    console.error('[Scheduler] Cleanup error:', e.message);
                }
            })
        );

        this.isRunning = true;
        console.log('[Scheduler] All jobs scheduled successfully');
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        this.isRunning = false;
        console.log('[Scheduler] All jobs stopped');
    }

    /**
     * Check and update priority eligibility for pending requests
     */
    async checkPriorityEligibility() {
        try {
            // Get timeout configuration
            const timeoutConfig = await db.getOne(
                "SELECT config_value FROM ai_system_config WHERE config_key = 'hr_response_timeout_hours'"
            );
            const timeoutHours = parseInt(timeoutConfig?.config_value) || 7;

            // Find requests that should now be eligible for priority badges
            const eligibleRequests = await db.query(`
                SELECT lr.request_id, lr.emp_id, lr.leave_type, lr.created_at,
                       e.full_name, e.email,
                       TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) as hours_pending
                FROM leave_requests lr
                JOIN employees e ON lr.emp_id = e.emp_id
                LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
                WHERE lr.status = 'pending'
                AND lr.ai_mode_at_submission = 'normal'
                AND lr.hr_viewed_at IS NULL
                AND lr.can_set_priority = FALSE
                AND TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) >= ?
                AND (lpb.id IS NULL OR lpb.priority_level = 'none')
            `, [timeoutHours]);

            let updatedCount = 0;
            for (const request of eligibleRequests) {
                // Update the request
                await db.execute(`
                    UPDATE leave_requests 
                    SET can_set_priority = TRUE, priority_eligible_at = NOW()
                    WHERE request_id = ?
                `, [request.request_id]);

                // Create notification for employee
                await db.execute(`
                    INSERT INTO hr_notification_queue 
                    (notification_type, request_id, recipient_emp_id, priority_level, title, message, data)
                    VALUES ('pending_review', ?, ?, 'normal', ?, ?, ?)
                `, [
                    request.request_id,
                    request.emp_id,
                    'You can now set a priority on your leave request',
                    `Your ${request.leave_type} request has been pending for ${request.hours_pending} hours. You can now set a priority badge to expedite review.`,
                    JSON.stringify({ requestId: request.request_id, hoursPending: request.hours_pending })
                ]);

                updatedCount++;
            }

            if (updatedCount > 0) {
                console.log(`[Scheduler] Updated priority eligibility for ${updatedCount} requests`);
            }

            return { updated: updatedCount };
        } catch (error) {
            console.error('[Scheduler] Priority eligibility check error:', error);
            return { error: error.message };
        }
    }

    /**
     * Process escalations for red priority requests after 24 hours
     */
    async processEscalations() {
        const results = { escalated: 0, autoApproved: 0, errors: [] };

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
                    e.country,
                    TIMESTAMPDIFF(HOUR, lpb.badge_set_at, NOW()) as hours_since_priority
                FROM leave_requests lr
                JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
                JOIN employees e ON lr.emp_id = e.emp_id
                WHERE lr.status = 'pending'
                AND lpb.priority_level = 'red'
                AND lr.hr_viewed_at IS NULL
                AND TIMESTAMPDIFF(HOUR, lpb.badge_set_at, NOW()) >= ?
                AND NOT EXISTS (
                    SELECT 1 FROM leave_escalation_history leh 
                    WHERE leh.request_id = lr.request_id 
                    AND leh.escalated_to = 'ai_engine'
                    AND leh.is_resolved = FALSE
                )
            `, [escalationTimeout]);

            for (const request of redPriorityRequests) {
                try {
                    console.log(`[Scheduler] Processing escalation for request ${request.request_id}`);

                    // Re-analyze with AI engine
                    let analysis;
                    try {
                        const analysisResponse = await axios.post(`${AI_ENGINE_URL}/analyze`, {
                            request_id: request.request_id,
                            emp_id: request.emp_id,
                            country_code: request.country_code || 'IN',
                            leave_type: request.leave_type,
                            start_date: request.start_date,
                            end_date: request.end_date,
                            total_days: request.total_days,
                            reason: request.reason,
                            force_escalation_check: true
                        });
                        analysis = analysisResponse.data;
                    } catch (aiError) {
                        console.warn(`[Scheduler] AI engine unavailable for ${request.request_id}:`, aiError.message);
                        // Default to escalate if AI is unavailable
                        analysis = { recommendation: 'escalate', can_auto_approve: false };
                    }

                    // Log escalation to AI engine
                    await db.execute(`
                        INSERT INTO leave_escalation_history 
                        (request_id, escalation_level, escalated_from, escalated_to, escalation_reason, triggered_by, priority_level)
                        VALUES (?, ?, 'system', 'ai_engine', ?, 'timeout', 'red')
                    `, [
                        request.request_id,
                        (request.escalation_count || 0) + 1,
                        `HR did not respond within ${escalationTimeout} hours for red priority request. AI re-evaluation triggered.`
                    ]);

                    // If AI approves and rules match, auto-approve
                    if (analysis.recommendation === 'approve' && analysis.can_auto_approve) {
                        await db.execute(`
                            UPDATE leave_requests SET 
                                status = 'approved', 
                                approved_by = 'AI_ENGINE_ESCALATION',
                                approval_date = NOW(),
                                processing_notes = CONCAT(IFNULL(processing_notes, ''), ?)
                            WHERE request_id = ?
                        `, [
                            `\n[${new Date().toISOString()}] Auto-approved by AI after ${escalationTimeout}hr escalation. Confidence: ${analysis.confidence || 'N/A'}`,
                            request.request_id
                        ]);

                        // Mark escalation as resolved
                        await db.execute(`
                            UPDATE leave_escalation_history 
                            SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = 'AI_ENGINE', resolution_action = 'approved'
                            WHERE request_id = ? AND is_resolved = FALSE
                        `, [request.request_id]);

                        // Update leave balance
                        await this.updateLeaveBalance(request.emp_id, request.leave_type, request.total_days);

                        // Notify employee
                        await this.sendAutoApprovalNotification(request);

                        results.autoApproved++;
                        console.log(`[Scheduler] Request ${request.request_id} auto-approved after escalation`);
                    } else {
                        // Escalate to manager
                        await db.execute(`
                            INSERT INTO leave_escalation_history 
                            (request_id, escalation_level, escalated_from, escalated_to, escalation_reason, triggered_by, priority_level)
                            VALUES (?, ?, 'ai_engine', 'manager', ?, 'policy', 'red')
                        `, [
                            request.request_id,
                            (request.escalation_count || 0) + 2,
                            `AI cannot auto-approve: ${analysis.recommendation_reason || 'Policy constraints'}. Escalated to manager.`
                        ]);

                        // Update request
                        await db.execute(`
                            UPDATE leave_requests SET 
                                escalation_count = escalation_count + 1,
                                last_escalation_at = NOW(),
                                processing_notes = CONCAT(IFNULL(processing_notes, ''), ?)
                            WHERE request_id = ?
                        `, [
                            `\n[${new Date().toISOString()}] Escalated to manager. AI review: ${analysis.recommendation}`,
                            request.request_id
                        ]);

                        // Notify manager
                        await this.sendManagerEscalationNotification(request, analysis);

                        results.escalated++;
                        console.log(`[Scheduler] Request ${request.request_id} escalated to manager`);
                    }

                } catch (requestError) {
                    results.errors.push({ requestId: request.request_id, error: requestError.message });
                    console.error(`[Scheduler] Error processing ${request.request_id}:`, requestError.message);
                }
            }

        } catch (error) {
            console.error('[Scheduler] Process escalations error:', error);
            results.errors.push({ general: error.message });
        }

        if (results.escalated > 0 || results.autoApproved > 0) {
            console.log(`[Scheduler] Escalation results: ${results.autoApproved} auto-approved, ${results.escalated} escalated`);
        }

        return results;
    }

    /**
     * Send reminders to HR for pending priority requests
     */
    async sendHRReminders() {
        try {
            // Find priority requests that haven't been viewed
            const pendingRequests = await db.query(`
                SELECT 
                    lr.request_id,
                    lr.emp_id,
                    e.full_name as employee_name,
                    lr.leave_type,
                    lr.start_date,
                    lr.end_date,
                    lpb.priority_level,
                    lpb.badge_set_at,
                    TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) as hours_pending
                FROM leave_requests lr
                JOIN employees e ON lr.emp_id = e.emp_id
                JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
                WHERE lr.status = 'pending'
                AND lpb.priority_level IN ('yellow', 'red')
                AND lr.hr_viewed_at IS NULL
                ORDER BY 
                    CASE lpb.priority_level WHEN 'red' THEN 1 ELSE 2 END,
                    lr.created_at ASC
                LIMIT 20
            `);

            if (pendingRequests.length === 0) {
                return { reminders_sent: 0 };
            }

            // Get HR emails
            const hrUsers = await db.query(
                "SELECT email, full_name FROM users WHERE role IN ('hr', 'hr_manager') AND is_active = 1"
            );

            if (hrUsers.length === 0 || !emailTransporter) {
                return { reminders_sent: 0, reason: 'No HR users or email not configured' };
            }

            const redCount = pendingRequests.filter(r => r.priority_level === 'red').length;
            const yellowCount = pendingRequests.filter(r => r.priority_level === 'yellow').length;

            const subject = redCount > 0 
                ? `🔴 ${redCount} URGENT + ${yellowCount} Priority Leave Requests Pending`
                : `🟡 ${yellowCount} Priority Leave Requests Pending Review`;

            const requestList = pendingRequests.map(r => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px; ${r.priority_level === 'red' ? 'background: #fef2f2;' : 'background: #fffbeb;'}">
                        ${r.priority_level === 'red' ? '🔴' : '🟡'} ${r.priority_level.toUpperCase()}
                    </td>
                    <td style="padding: 12px;">${r.employee_name}</td>
                    <td style="padding: 12px;">${r.leave_type}</td>
                    <td style="padding: 12px;">${r.start_date} - ${r.end_date}</td>
                    <td style="padding: 12px;">${r.hours_pending}h</td>
                </tr>
            `).join('');

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Priority Leave Requests Reminder</h2>
                    </div>
                    <div style="padding: 20px; background: #f9fafb;">
                        <p>You have <strong>${pendingRequests.length}</strong> priority leave requests awaiting your review:</p>
                        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="padding: 12px; text-align: left;">Priority</th>
                                    <th style="padding: 12px; text-align: left;">Employee</th>
                                    <th style="padding: 12px; text-align: left;">Type</th>
                                    <th style="padding: 12px; text-align: left;">Dates</th>
                                    <th style="padding: 12px; text-align: left;">Pending</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${requestList}
                            </tbody>
                        </table>
                        ${redCount > 0 ? `
                            <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; margin-top: 20px; border-radius: 8px;">
                                <p style="color: #dc2626; margin: 0;">
                                    <strong>⚠️ ${redCount} request(s) marked as URGENT.</strong><br>
                                    If not addressed within 24 hours of priority badge set, the system will automatically process them.
                                </p>
                            </div>
                        ` : ''}
                        <div style="margin-top: 20px; text-align: center;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/app/pages/hr/leave-requests.html" 
                               style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                                Review Requests
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

            console.log(`[Scheduler] Sent HR reminder for ${pendingRequests.length} priority requests`);
            return { reminders_sent: 1, requests: pendingRequests.length };

        } catch (error) {
            console.error('[Scheduler] Send HR reminders error:', error);
            return { error: error.message };
        }
    }

    /**
     * Clean up old notifications (older than 30 days)
     */
    async cleanupOldNotifications() {
        try {
            const result = await db.execute(
                'DELETE FROM hr_notification_queue WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) AND is_dismissed = TRUE'
            );
            console.log(`[Scheduler] Cleaned up ${result.affectedRows || 0} old notifications`);
            return { deleted: result.affectedRows || 0 };
        } catch (error) {
            console.error('[Scheduler] Cleanup error:', error);
            return { error: error.message };
        }
    }

    /**
     * Update leave balance after approval
     */
    async updateLeaveBalance(emp_id, leave_type, days) {
        try {
            // Try to update existing balance
            const result = await db.execute(`
                UPDATE leave_balances 
                SET used_so_far = used_so_far + ?
                WHERE emp_id = ? AND leave_type = ?
            `, [days, emp_id, leave_type]);

            if (result.affectedRows === 0) {
                // No existing record, try leave_balances_v2
                await db.execute(`
                    UPDATE leave_balances_v2 
                    SET used_days = used_days + ?, available_balance = available_balance - ?
                    WHERE emp_id = ? AND leave_type = ? AND year = YEAR(CURDATE())
                `, [days, days, emp_id, leave_type]);
            }
        } catch (error) {
            console.error('[Scheduler] Update balance error:', error);
        }
    }

    /**
     * Send auto-approval notification to employee
     */
    async sendAutoApprovalNotification(request) {
        try {
            const employee = await db.getOne('SELECT email, full_name FROM employees WHERE emp_id = ?', [request.emp_id]);
            
            if (!employee?.email || !emailTransporter) return;

            await emailTransporter.sendMail({
                from: process.env.SMTP_FROM || 'hr-system@company.com',
                to: employee.email,
                subject: `✅ Leave Request Approved - ${request.leave_type}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #10b981; color: white; padding: 20px; text-align: center;">
                            <h2 style="margin: 0;">✅ Leave Approved!</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p>Hi ${employee.full_name},</p>
                            <p>Great news! Your leave request has been automatically approved by our system.</p>
                            <div style="background: #f0fdf4; border: 1px solid #10b981; padding: 15px; border-radius: 8px;">
                                <p><strong>Leave Type:</strong> ${request.leave_type}</p>
                                <p><strong>Dates:</strong> ${request.start_date} to ${request.end_date}</p>
                                <p><strong>Days:</strong> ${request.total_days}</p>
                            </div>
                            <p style="margin-top: 20px; color: #6b7280; font-size: 0.9em;">
                                This was auto-approved after HR response timeout due to your red priority badge. All policy requirements were verified.
                            </p>
                        </div>
                    </div>
                `
            });
        } catch (error) {
            console.error('[Scheduler] Send auto-approval notification error:', error);
        }
    }

    /**
     * Send escalation notification to manager
     */
    async sendManagerEscalationNotification(request, analysis) {
        try {
            // Get manager info
            const manager = await db.getOne(`
                SELECT m.email, m.full_name 
                FROM employees e
                JOIN employees m ON e.manager_id = m.emp_id
                WHERE e.emp_id = ?
            `, [request.emp_id]);

            if (!manager?.email || !emailTransporter) return;

            await emailTransporter.sendMail({
                from: process.env.SMTP_FROM || 'hr-system@company.com',
                to: manager.email,
                subject: `🔴 Escalated Leave Request - ${request.full_name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                            <h2 style="margin: 0;">🔴 Escalated Leave Request</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p>Hi ${manager.full_name},</p>
                            <p>A leave request has been escalated to you for immediate action.</p>
                            <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px;">
                                <p><strong>Employee:</strong> ${request.full_name}</p>
                                <p><strong>Department:</strong> ${request.department}</p>
                                <p><strong>Leave Type:</strong> ${request.leave_type}</p>
                                <p><strong>Dates:</strong> ${request.start_date} to ${request.end_date}</p>
                                <p><strong>Days:</strong> ${request.total_days}</p>
                                <p><strong>Reason:</strong> ${request.reason}</p>
                            </div>
                            <div style="background: #fef9c3; border: 1px solid #f59e0b; padding: 15px; margin-top: 15px; border-radius: 8px;">
                                <p><strong>Why escalated:</strong></p>
                                <p>${analysis.recommendation_reason || 'HR did not respond within the timeout period and AI cannot auto-approve due to policy constraints.'}</p>
                            </div>
                            <div style="margin-top: 20px; text-align: center;">
                                <a href="${process.env.APP_URL || 'http://localhost:3000'}/app/pages/manager/leave-requests.html" 
                                   style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                                    Review & Take Action
                                </a>
                            </div>
                        </div>
                    </div>
                `
            });

            // Also create dashboard notification
            await db.execute(`
                INSERT INTO hr_notification_queue 
                (notification_type, request_id, recipient_role, priority_level, title, message, data)
                VALUES ('escalation', ?, 'manager', 'urgent', ?, ?, ?)
            `, [
                request.request_id,
                `Escalated: ${request.full_name} - ${request.leave_type}`,
                `This request was escalated after HR timeout. AI review: ${analysis.recommendation}`,
                JSON.stringify({ employeeName: request.full_name, leaveType: request.leave_type, aiRecommendation: analysis.recommendation })
            ]);

        } catch (error) {
            console.error('[Scheduler] Send manager notification error:', error);
        }
    }

    /**
     * Run all checks immediately (for testing)
     */
    async runAll() {
        console.log('[Scheduler] Running all checks immediately...');
        const results = {
            priorityEligibility: await this.checkPriorityEligibility(),
            escalations: await this.processEscalations(),
            hrReminders: await this.sendHRReminders()
        };
        console.log('[Scheduler] Manual run complete:', results);
        return results;
    }

    /**
     * Initialize scheduler (called from server.js)
     */
    initialize() {
        this.start();
    }
}

// Export singleton instance
const scheduler = new LeaveScheduler();
module.exports = scheduler;
