/**
 * Gmail OAuth Email Service
 * Uses OAuth 2.0 for secure email sending via Backend API
 * 
 * OAuth Credentials:
 * Client ID: 354227009682-eq7k9c4raa91gotpsrco06tph22uaeca.apps.googleusercontent.com
 * Client Secret: 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
 * Sender Email: traderlighter11@gmail.com
 * 
 * The backend has stored OAuth tokens for verified emails.
 * This service calls the backend API to send emails.
 */

import nodemailer from 'nodemailer';
import { google } from 'googleapis';

// Gmail OAuth Configuration
const GMAIL_OAUTH = {
    clientId: process.env.GMAIL_CLIENT_ID || '354227009682-eq7k9c4raa91gotpsrco06tph22uaeca.apps.googleusercontent.com',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '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',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    email: process.env.GMAIL_USER || 'traderlighter11@gmail.com'
};

// Backend URL for email API
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    GMAIL_OAUTH.clientId,
    GMAIL_OAUTH.clientSecret,
    'https://developers.google.com/oauthplayground'
);

// Set refresh token if available
if (GMAIL_OAUTH.refreshToken) {
    oauth2Client.setCredentials({
        refresh_token: GMAIL_OAUTH.refreshToken
    });
}

/**
 * Send email via Backend API (uses stored OAuth tokens)
 */
async function sendViaBackend(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/google/test-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emp_id: 'SYSTEM',
                to_email: to,
                subject: subject,
                message: html
            })
        });
        
        const data = await response.json();
        return { success: data.success, error: data.error };
    } catch (error) {
        console.warn('Backend email failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Backend unavailable' };
    }
}

/**
 * Get email transporter with OAuth or fallback to SMTP
 */
async function getEmailTransporter() {
    // Try OAuth first if refresh token is available
    if (GMAIL_OAUTH.refreshToken) {
        try {
            const { token } = await oauth2Client.getAccessToken();
            
            return nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: GMAIL_OAUTH.email,
                    clientId: GMAIL_OAUTH.clientId,
                    clientSecret: GMAIL_OAUTH.clientSecret,
                    refreshToken: GMAIL_OAUTH.refreshToken,
                    accessToken: token || undefined
                }
            });
        } catch (error) {
            console.warn('OAuth failed, falling back to SMTP:', error);
        }
    }

    // Fallback to SMTP/App Password
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER || process.env.GMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD
        }
    });
}

// Email Templates
export const EmailTemplates = {
    /**
     * Check-in Reminder Email
     */
    checkInReminder: (employeeName: string, reminderNumber: number) => ({
        subject: reminderNumber === 1 
            ? '⏰ Check-in Reminder - TetraDeck' 
            : '⚠️ Final Check-in Reminder - TetraDeck',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">TetraDeck</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <h2 style="color: #fff;">⏰ Check-in Reminder ${reminderNumber === 2 ? '(Final)' : ''}</h2>
                    <p>Hi ${employeeName},</p>
                    <p>This is ${reminderNumber === 1 ? 'a friendly reminder' : 'your <strong>final reminder</strong>'} that you haven't checked in yet today.</p>
                    <p>Standard check-in time is <strong>9:00 AM</strong>.</p>
                    <p>Please remember to check in through the <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/employee/dashboard" style="color: #0ea5e9;">employee portal</a>.</p>
                    ${reminderNumber === 2 ? `
                        <div style="margin-top: 20px; padding: 15px; background: #7f1d1d; border-radius: 8px;">
                            <p style="margin: 0; color: #fecaca;">
                                <strong>⚠️ Warning:</strong> If you don't check in soon, HR will be notified and your attendance may be marked as absent.
                            </p>
                        </div>
                    ` : `
                        <div style="margin-top: 20px; padding: 15px; background: #334155; border-radius: 8px;">
                            <p style="margin: 0; color: #94a3b8;">
                                <strong>Note:</strong> If you're on leave or working remotely, please disregard this message.
                            </p>
                        </div>
                    `}
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * Check-out Reminder Email
     */
    checkOutReminder: (employeeName: string, checkInTime: string, reminderNumber: number) => ({
        subject: reminderNumber === 1 
            ? '☕ Check-out Reminder - TetraDeck' 
            : '⚠️ Final Check-out Reminder - TetraDeck',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">TetraDeck</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <h2 style="color: #fff;">☕ Check-out Reminder ${reminderNumber === 2 ? '(Final)' : ''}</h2>
                    <p>Hi ${employeeName},</p>
                    <p>You checked in at <strong>${checkInTime}</strong> but haven't checked out yet.</p>
                    <p>Standard check-out time is <strong>4:00 PM</strong>.</p>
                    <p>Please remember to check out through the <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/employee/dashboard" style="color: #0ea5e9;">employee portal</a>.</p>
                    <div style="margin-top: 20px; padding: 15px; background: #334155; border-radius: 8px;">
                        <p style="margin: 0; color: #94a3b8;">
                            <strong>Tip:</strong> Checking out helps us track working hours accurately for payroll.
                        </p>
                    </div>
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * Leave Approved Email
     */
    leaveApproved: (
        employeeName: string, 
        leaveType: string, 
        startDate: string, 
        endDate: string, 
        totalDays: number,
        approvedBy: string,
        reason: string
    ) => ({
        subject: `✅ Leave Approved - ${leaveType}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">✅ Leave Approved</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <h2 style="color: #fff;">Great news, ${employeeName}!</h2>
                    <p>Your leave request has been approved.</p>
                    
                    <div style="background: #334155; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table style="width: 100%; color: #e2e8f0;">
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Leave Type:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${leaveType}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Start Date:</td>
                                <td style="padding: 8px 0; text-align: right;">${startDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">End Date:</td>
                                <td style="padding: 8px 0; text-align: right;">${endDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Total Days:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${totalDays} day${totalDays > 1 ? 's' : ''}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Approved By:</td>
                                <td style="padding: 8px 0; text-align: right;">${approvedBy}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="background: #065f46; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                        <p style="margin: 0; color: #d1fae5;">
                            <strong>📋 Approval Reason:</strong><br/>
                            ${reason}
                        </p>
                    </div>
                    
                    <p style="margin-top: 20px;">
                        View your updated leave balance in the <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/employee/dashboard" style="color: #0ea5e9;">employee portal</a>.
                    </p>
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * Leave Submission Confirmation Email
     */
    leaveSubmission: (
        employeeName: string,
        requestId: string,
        leaveType: string,
        startDate: string,
        endDate: string,
        totalDays: number,
        reason: string
    ) => ({
        subject: `📝 Leave Request Submitted - ${leaveType} (${requestId})`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">📝 Leave Request Submitted</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <h2 style="color: #fff;">Hi ${employeeName},</h2>
                    <p>Your leave request has been submitted successfully and is pending approval.</p>
                    
                    <div style="background: #334155; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table style="width: 100%; color: #e2e8f0;">
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Request ID:</td>
                                <td style="padding: 8px 0; text-align: right; font-family: monospace;">${requestId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Leave Type:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${leaveType}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Start Date:</td>
                                <td style="padding: 8px 0; text-align: right;">${startDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">End Date:</td>
                                <td style="padding: 8px 0; text-align: right;">${endDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Total Days:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${totalDays} day${totalDays > 1 ? 's' : ''}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="background: #1e3a5f; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0; color: #bfdbfe;">
                            <strong>📋 Reason:</strong><br/>
                            ${reason}
                        </p>
                    </div>
                    
                    <div style="background: #374151; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                            ⏳ <strong>Status:</strong> Pending Approval<br/>
                            Your request will be reviewed by your manager. You'll receive an email once a decision is made.
                        </p>
                    </div>
                    
                    <p style="margin-top: 20px;">
                        Track your request status in the <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/employee/history" style="color: #0ea5e9;">leave history</a>.
                    </p>
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * Leave Rejected Email
     */
    leaveRejected: (
        employeeName: string, 
        leaveType: string, 
        startDate: string, 
        endDate: string,
        rejectedBy: string,
        reason: string
    ) => ({
        subject: `❌ Leave Request Declined - ${leaveType}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">❌ Leave Declined</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <h2 style="color: #fff;">Hi ${employeeName},</h2>
                    <p>Unfortunately, your leave request has been declined.</p>
                    
                    <div style="background: #334155; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table style="width: 100%; color: #e2e8f0;">
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Leave Type:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${leaveType}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Requested Dates:</td>
                                <td style="padding: 8px 0; text-align: right;">${startDate} - ${endDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8;">Declined By:</td>
                                <td style="padding: 8px 0; text-align: right;">${rejectedBy}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="background: #7f1d1d; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0; color: #fecaca;">
                            <strong>📋 Reason:</strong><br/>
                            ${reason}
                        </p>
                    </div>
                    
                    <p style="margin-top: 20px;">
                        If you have questions, please contact HR or submit a new request with adjusted dates.
                    </p>
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * HR Notification about Missing Check-ins
     */
    hrMissingCheckIns: (missingEmployees: { name: string; department: string | null }[]) => ({
        subject: '⚠️ Attendance Alert - Missing Check-ins',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">⚠️ Attendance Alert</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <h2 style="color: #fff;">Missing Check-ins Report</h2>
                    <p>The following employees have not checked in today and are not on approved leave:</p>
                    <ul style="background: #334155; padding: 20px 40px; border-radius: 8px;">
                        ${missingEmployees.map(e => 
                            `<li style="padding: 5px 0;">${e.name} (${e.department || 'No Department'})</li>`
                        ).join('')}
                    </ul>
                    <p>Please review and take appropriate action through the <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/hr/attendance" style="color: #0ea5e9;">HR Portal</a>.</p>
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * Priority Leave Request Notification for HR
     */
    priorityLeaveRequest: (params: { 
        employeeName: string;
        leaveType: string;
        startDate: string;
        endDate: string;
        days: number;
        reason: string;
        priority: 'HIGH' | 'URGENT' | 'CRITICAL';
    }) => ({
        subject: `🚨 [${params.priority}] Priority Leave Request - ${params.employeeName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, ${params.priority === 'CRITICAL' ? '#dc2626' : params.priority === 'URGENT' ? '#ea580c' : '#d97706'}, #1e293b); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🚨 ${params.priority} Priority Leave Request</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <div style="background: ${params.priority === 'CRITICAL' ? '#7f1d1d' : params.priority === 'URGENT' ? '#7c2d12' : '#78350f'}; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                        <span style="font-size: 24px;">⚡</span>
                        <p style="margin: 5px 0; color: white; font-weight: bold;">IMMEDIATE ATTENTION REQUIRED</p>
                    </div>
                    
                    <table style="width: 100%; background: #334155; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Employee:</td>
                            <td style="padding: 8px; color: white; font-weight: bold;">${params.employeeName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Leave Type:</td>
                            <td style="padding: 8px; color: white;">${params.leaveType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Duration:</td>
                            <td style="padding: 8px; color: white;">${params.startDate} to ${params.endDate} (${params.days} days)</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Priority:</td>
                            <td style="padding: 8px; color: ${params.priority === 'CRITICAL' ? '#ef4444' : params.priority === 'URGENT' ? '#f97316' : '#eab308'}; font-weight: bold;">${params.priority}</td>
                        </tr>
                    </table>
                    
                    <div style="background: #475569; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #cbd5e1;"><strong>📝 Reason:</strong></p>
                        <p style="margin: 10px 0 0; color: white;">${params.reason}</p>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/hr/leave-requests" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review Request Now</a>
                    </div>
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * Security Alert - Suspicious Activity
     */
    securityAlert: (params: {
        alertType: 'SUSPICIOUS_LOGIN' | 'FAILED_ATTEMPTS' | 'UNUSUAL_ACTIVITY' | 'DATA_ACCESS' | 'ANONYMOUS_ACTION' | 'PERMISSION_CHANGE';
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        details: string;
        ipAddress?: string;
        userAgent?: string;
        timestamp: string;
        affectedUser?: string;
    }) => {
        const severityColors = {
            LOW: '#3b82f6',
            MEDIUM: '#eab308',
            HIGH: '#f97316',
            CRITICAL: '#ef4444'
        };
        const alertIcons = {
            SUSPICIOUS_LOGIN: '🔐',
            FAILED_ATTEMPTS: '🚫',
            UNUSUAL_ACTIVITY: '⚠️',
            DATA_ACCESS: '📁',
            ANONYMOUS_ACTION: '👤',
            PERMISSION_CHANGE: '🔑'
        };
        return {
            subject: `🔒 [${params.severity}] Security Alert: ${params.alertType.replace(/_/g, ' ')}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, ${severityColors[params.severity]}, #1e293b); padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">${alertIcons[params.alertType]} Security Alert</h1>
                    </div>
                    <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                        <div style="background: #334155; padding: 15px; border-radius: 8px; border-left: 4px solid ${severityColors[params.severity]}; margin-bottom: 20px;">
                            <p style="margin: 0; font-size: 18px; font-weight: bold; color: white;">
                                ${params.alertType.replace(/_/g, ' ')}
                            </p>
                            <p style="margin: 5px 0 0; color: ${severityColors[params.severity]}; font-weight: bold;">
                                Severity: ${params.severity}
                            </p>
                        </div>
                        
                        <table style="width: 100%; background: #475569; border-radius: 8px; margin-bottom: 20px;">
                            <tr>
                                <td style="padding: 12px; color: #94a3b8;">Timestamp:</td>
                                <td style="padding: 12px; color: white;">${params.timestamp}</td>
                            </tr>
                            ${params.affectedUser ? `
                            <tr>
                                <td style="padding: 12px; color: #94a3b8;">Affected User:</td>
                                <td style="padding: 12px; color: white;">${params.affectedUser}</td>
                            </tr>
                            ` : ''}
                            ${params.ipAddress ? `
                            <tr>
                                <td style="padding: 12px; color: #94a3b8;">IP Address:</td>
                                <td style="padding: 12px; color: white;">${params.ipAddress}</td>
                            </tr>
                            ` : ''}
                            ${params.userAgent ? `
                            <tr>
                                <td style="padding: 12px; color: #94a3b8;">User Agent:</td>
                                <td style="padding: 12px; color: white; font-size: 12px;">${params.userAgent}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <div style="background: #7f1d1d; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 0; color: #fecaca;"><strong>📋 Details:</strong></p>
                            <p style="margin: 10px 0 0; color: white;">${params.details}</p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/hr/audit-logs" style="display: inline-block; background: #ef4444; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Audit Logs</a>
                        </div>
                    </div>
                    <div style="padding: 15px; background: #0f172a; text-align: center;">
                        <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System - Security Team</p>
                    </div>
                </div>
            `
        };
    },

    /**
     * New Employee Welcome Email
     */
    welcomeEmail: (params: { 
        employeeName: string; 
        email: string; 
        position: string;
        department: string;
        startDate: string;
        managerName?: string;
    }) => ({
        subject: `🎉 Welcome to the Team, ${params.employeeName}!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981, #0ea5e9); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🎉 Welcome Aboard!</h1>
                </div>
                <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                    <h2 style="color: #10b981;">Hello ${params.employeeName}!</h2>
                    <p>We're thrilled to have you join our team! Here are your details:</p>
                    
                    <table style="width: 100%; background: #334155; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Position:</td>
                            <td style="padding: 8px; color: white; font-weight: bold;">${params.position}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Department:</td>
                            <td style="padding: 8px; color: white;">${params.department}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Start Date:</td>
                            <td style="padding: 8px; color: white;">${params.startDate}</td>
                        </tr>
                        ${params.managerName ? `
                        <tr>
                            <td style="padding: 8px; color: #94a3b8;">Reports To:</td>
                            <td style="padding: 8px; color: white;">${params.managerName}</td>
                        </tr>
                        ` : ''}
                    </table>
                    
                    <div style="background: #065f46; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #a7f3d0;"><strong>Next Steps:</strong></p>
                        <ul style="color: white; margin: 10px 0 0;">
                            <li>Complete your onboarding tasks in the portal</li>
                            <li>Set up your profile and preferences</li>
                            <li>Review company policies and guidelines</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Start Onboarding</a>
                    </div>
                </div>
                <div style="padding: 15px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                </div>
            </div>
        `
    }),

    /**
     * Password Reset / Account Action Email
     */
    accountAction: (params: {
        employeeName: string;
        actionType: 'PASSWORD_RESET' | 'ACCOUNT_LOCKED' | 'ACCOUNT_UNLOCKED' | '2FA_ENABLED' | '2FA_DISABLED';
        details?: string;
    }) => {
        const actionConfig = {
            PASSWORD_RESET: { icon: '🔑', title: 'Password Reset', color: '#0ea5e9' },
            ACCOUNT_LOCKED: { icon: '🔒', title: 'Account Locked', color: '#ef4444' },
            ACCOUNT_UNLOCKED: { icon: '🔓', title: 'Account Unlocked', color: '#10b981' },
            '2FA_ENABLED': { icon: '🛡️', title: 'Two-Factor Authentication Enabled', color: '#10b981' },
            '2FA_DISABLED': { icon: '⚠️', title: 'Two-Factor Authentication Disabled', color: '#f59e0b' }
        };
        const config = actionConfig[params.actionType];
        return {
            subject: `${config.icon} ${config.title} - Account Update`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, ${config.color}, #1e293b); padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">${config.icon} ${config.title}</h1>
                    </div>
                    <div style="padding: 30px; background: #1e293b; color: #e2e8f0;">
                        <h2 style="color: white;">Hello ${params.employeeName},</h2>
                        <p>This is a notification regarding a recent action on your account.</p>
                        
                        <div style="background: #334155; padding: 20px; border-radius: 8px; border-left: 4px solid ${config.color}; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px; color: white;"><strong>${config.title}</strong></p>
                            ${params.details ? `<p style="margin: 10px 0 0; color: #94a3b8;">${params.details}</p>` : ''}
                        </div>
                        
                        <p style="color: #94a3b8;">If you did not perform this action, please contact your administrator immediately.</p>
                        
                        <div style="text-align: center; margin-top: 20px;">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings" style="display: inline-block; background: ${config.color}; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Settings</a>
                        </div>
                    </div>
                    <div style="padding: 15px; background: #0f172a; text-align: center;">
                        <p style="color: #64748b; margin: 0; font-size: 12px;">TetraDeck HR Management System</p>
                    </div>
                </div>
            `
        };
    }
};

/**
 * Send an email using Gmail OAuth
 */
export async function sendEmail(
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; error?: string; explanation?: string }> {
    // Try Backend API first (has stored OAuth tokens)
    const backendResult = await sendViaBackend(to, subject, html);
    if (backendResult.success) {
        return { 
            success: true, 
            explanation: `Email sent successfully to ${to} via Backend OAuth`
        };
    }
    
    // Fallback to direct sending
    try {
        const transporter = await getEmailTransporter();
        
        await transporter.sendMail({
            from: process.env.SMTP_FROM || `"TetraDeck HR" <${GMAIL_OAUTH.email}>`,
            to,
            subject,
            html
        });

        return { 
            success: true, 
            explanation: `Email sent successfully to ${to} using ${GMAIL_OAUTH.refreshToken ? 'Gmail OAuth' : 'SMTP'}`
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to send email to ${to}:`, error);
        return { 
            success: false, 
            error: `Backend: ${backendResult.error}, Direct: ${errorMessage}`,
            explanation: `Email failed via both methods. Backend: ${backendResult.error}. Direct: ${errorMessage}`
        };
    }
}

/**
 * Send check-in reminder
 */
export async function sendCheckInReminderEmail(
    employee: { email: string; full_name: string },
    reminderNumber: 1 | 2
) {
    const template = EmailTemplates.checkInReminder(employee.full_name, reminderNumber);
    return sendEmail(employee.email, template.subject, template.html);
}

/**
 * Send check-out reminder
 */
export async function sendCheckOutReminderEmail(
    employee: { email: string; full_name: string; check_in_time: string },
    reminderNumber: 1 | 2
) {
    const template = EmailTemplates.checkOutReminder(employee.full_name, employee.check_in_time, reminderNumber);
    return sendEmail(employee.email, template.subject, template.html);
}

/**
 * Send leave submission confirmation
 */
export async function sendLeaveSubmissionEmail(
    employee: { email: string; full_name: string },
    leaveDetails: {
        requestId: string;
        leaveType: string;
        startDate: string;
        endDate: string;
        totalDays: number;
        reason: string;
    }
) {
    const template = EmailTemplates.leaveSubmission(
        employee.full_name,
        leaveDetails.requestId,
        leaveDetails.leaveType,
        leaveDetails.startDate,
        leaveDetails.endDate,
        leaveDetails.totalDays,
        leaveDetails.reason
    );
    return sendEmail(employee.email, template.subject, template.html);
}

/**
 * Send leave approval notification
 */
export async function sendLeaveApprovalEmail(
    employee: { email: string; full_name: string },
    leaveDetails: {
        leaveType: string;
        startDate: string;
        endDate: string;
        totalDays: number;
        approvedBy: string;
        reason: string;
    }
) {
    const template = EmailTemplates.leaveApproved(
        employee.full_name,
        leaveDetails.leaveType,
        leaveDetails.startDate,
        leaveDetails.endDate,
        leaveDetails.totalDays,
        leaveDetails.approvedBy,
        leaveDetails.reason
    );
    return sendEmail(employee.email, template.subject, template.html);
}

/**
 * Send leave rejection notification
 */
export async function sendLeaveRejectionEmail(
    employee: { email: string; full_name: string },
    leaveDetails: {
        leaveType: string;
        startDate: string;
        endDate: string;
        rejectedBy: string;
        reason: string;
    }
) {
    const template = EmailTemplates.leaveRejected(
        employee.full_name,
        leaveDetails.leaveType,
        leaveDetails.startDate,
        leaveDetails.endDate,
        leaveDetails.rejectedBy,
        leaveDetails.reason
    );
    return sendEmail(employee.email, template.subject, template.html);
}

/**
 * Send HR notification about missing check-ins
 */
export async function sendHRMissingCheckInsEmail(
    hrEmail: string,
    missingEmployees: { name: string; department: string | null }[]
) {
    const template = EmailTemplates.hrMissingCheckIns(missingEmployees);
    return sendEmail(hrEmail, template.subject, template.html);
}

/**
 * Send priority leave request notification to HR
 */
export async function sendPriorityLeaveNotification(
    hrEmail: string,
    params: {
        employeeName: string;
        leaveType: string;
        startDate: string;
        endDate: string;
        days: number;
        reason: string;
        priority: 'HIGH' | 'URGENT' | 'CRITICAL';
    }
) {
    const template = EmailTemplates.priorityLeaveRequest(params);
    return sendEmail(hrEmail, template.subject, template.html);
}

/**
 * Send security alert notification to HR/Admin
 */
export async function sendSecurityAlertEmail(
    adminEmail: string,
    params: {
        alertType: 'SUSPICIOUS_LOGIN' | 'FAILED_ATTEMPTS' | 'UNUSUAL_ACTIVITY' | 'DATA_ACCESS' | 'ANONYMOUS_ACTION' | 'PERMISSION_CHANGE';
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        details: string;
        ipAddress?: string;
        userAgent?: string;
        timestamp: string;
        affectedUser?: string;
    }
) {
    const template = EmailTemplates.securityAlert(params);
    return sendEmail(adminEmail, template.subject, template.html);
}

/**
 * Send welcome email to new employee
 */
export async function sendWelcomeEmail(
    employeeEmail: string,
    params: {
        employeeName: string;
        email: string;
        position: string;
        department: string;
        startDate: string;
        managerName?: string;
    }
) {
    const template = EmailTemplates.welcomeEmail(params);
    return sendEmail(employeeEmail, template.subject, template.html);
}

/**
 * Send account action notification (password reset, 2FA, etc.)
 */
export async function sendAccountActionEmail(
    employeeEmail: string,
    params: {
        employeeName: string;
        actionType: 'PASSWORD_RESET' | 'ACCOUNT_LOCKED' | 'ACCOUNT_UNLOCKED' | '2FA_ENABLED' | '2FA_DISABLED';
        details?: string;
    }
) {
    const template = EmailTemplates.accountAction(params);
    return sendEmail(employeeEmail, template.subject, template.html);
}

export default {
    sendEmail,
    sendCheckInReminderEmail,
    sendCheckOutReminderEmail,
    sendLeaveApprovalEmail,
    sendLeaveRejectionEmail,
    sendHRMissingCheckInsEmail,
    sendPriorityLeaveNotification,
    sendSecurityAlertEmail,
    sendWelcomeEmail,
    sendAccountActionEmail,
    EmailTemplates
};
