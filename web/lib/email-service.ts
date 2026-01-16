/**
 * Gmail OAuth Email Service
 * Uses OAuth 2.0 for secure email sending
 * 
 * OAuth Credentials (provided by user):
 * Client ID: 354227009682-eq7k9c4raa91gotpsrco06tph22uaeca.apps.googleusercontent.com
 * Client Secret: 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
 */

import nodemailer from 'nodemailer';
import { google } from 'googleapis';

// Gmail OAuth Configuration
const GMAIL_OAUTH = {
    clientId: process.env.GMAIL_CLIENT_ID || '354227009682-eq7k9c4raa91gotpsrco06tph22uaeca.apps.googleusercontent.com',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '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',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    email: process.env.GMAIL_USER || 'noreply@tetradeck.com'
};

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    GMAIL_OAUTH.clientId,
    GMAIL_OAUTH.clientSecret,
    'https://developers.google.com/oauthplayground'
);

// Set refresh token
if (GMAIL_OAUTH.refreshToken) {
    oauth2Client.setCredentials({
        refresh_token: GMAIL_OAUTH.refreshToken
    });
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
    })
};

/**
 * Send an email using Gmail OAuth
 */
export async function sendEmail(
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; error?: string; explanation?: string }> {
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
            error: errorMessage,
            explanation: `Email failed: ${errorMessage}. Will retry on next trigger.`
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

export default {
    sendEmail,
    sendCheckInReminderEmail,
    sendCheckOutReminderEmail,
    sendLeaveApprovalEmail,
    sendLeaveRejectionEmail,
    sendHRMissingCheckInsEmail,
    EmailTemplates
};
