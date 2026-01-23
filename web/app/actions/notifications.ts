"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { logAudit, AuditAction } from "@/lib/audit";

// Resend client - dynamically imported only when needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resendClient: any = null;
async function getResend() {
    if (process.env.RESEND_API_KEY && !resendClient) {
        try {
            // @ts-expect-error - resend is optionally installed
            const { Resend } = await import('resend');
            resendClient = new Resend(process.env.RESEND_API_KEY);
        } catch {
            console.log('Resend module not available, using mock email');
        }
    }
    return resendClient;
}

// Resend is dynamically imported above

// Email Templates
const EMAIL_TEMPLATES = {
    leaveApproved: (data: { employeeName: string; leaveType: string; startDate: string; endDate: string; days: number }) => ({
        subject: `Leave Request Approved - ${data.leaveType}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
                    .badge { display: inline-block; background: #10B981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
                    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin:0;">✓ Leave Approved</h1>
                        <p style="margin:10px 0 0 0; opacity:0.9;">Your leave request has been approved</p>
                    </div>
                    <div class="content">
                        <p>Hi ${data.employeeName},</p>
                        <p>Great news! Your leave request has been <span class="badge">APPROVED</span></p>
                        
                        <div class="details">
                            <p><strong>Leave Type:</strong> ${data.leaveType}</p>
                            <p><strong>Duration:</strong> ${data.startDate} to ${data.endDate}</p>
                            <p><strong>Days:</strong> ${data.days} day(s)</p>
                            <p><strong>Status:</strong> Paid Leave</p>
                        </div>
                        
                        <p>Please ensure proper handover before your leave begins. Enjoy your time off!</p>
                    </div>
                    <div class="footer">
                        <p>Continuum AI Leave Management System</p>
                        <p>This is an automated notification. Please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    leaveRejected: (data: { employeeName: string; leaveType: string; startDate: string; endDate: string; reason: string }) => ({
        subject: `Leave Request Rejected - ${data.leaveType}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #EF4444, #DC2626); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
                    .badge { display: inline-block; background: #EF4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
                    .reason { background: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin:0;">✕ Leave Rejected</h1>
                        <p style="margin:10px 0 0 0; opacity:0.9;">Your leave request could not be approved</p>
                    </div>
                    <div class="content">
                        <p>Hi ${data.employeeName},</p>
                        <p>Unfortunately, your leave request has been <span class="badge">REJECTED</span></p>
                        
                        <p><strong>Leave Type:</strong> ${data.leaveType}<br>
                        <strong>Requested:</strong> ${data.startDate} to ${data.endDate}</p>
                        
                        <div class="reason">
                            <strong>Reason for Rejection:</strong><br>
                            ${data.reason}
                        </div>
                        
                        <p>If you have questions, please contact your manager or HR.</p>
                    </div>
                    <div class="footer">
                        <p>Continuum AI Leave Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    leaveEscalated: (data: { employeeName: string; leaveType: string; startDate: string; endDate: string; escalatedTo: string }) => ({
        subject: `Leave Request Escalated - Action Required`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
                    .badge { display: inline-block; background: #F59E0B; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
                    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin:0;">⚡ Leave Escalated</h1>
                        <p style="margin:10px 0 0 0; opacity:0.9;">Your request needs additional review</p>
                    </div>
                    <div class="content">
                        <p>Hi ${data.employeeName},</p>
                        <p>Your leave request has been <span class="badge">ESCALATED</span> for manual review.</p>
                        
                        <div class="details">
                            <p><strong>Leave Type:</strong> ${data.leaveType}</p>
                            <p><strong>Duration:</strong> ${data.startDate} to ${data.endDate}</p>
                            <p><strong>Escalated To:</strong> ${data.escalatedTo}</p>
                            <p><strong>Status:</strong> Pending Review</p>
                        </div>
                        
                        <p>The AI system was unable to automatically approve this request due to policy considerations. A human reviewer will make the final decision within 24 hours.</p>
                    </div>
                    <div class="footer">
                        <p>Continuum AI Leave Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    leaveSummary: (data: { 
        employeeName: string; 
        month: string; 
        paidLeaves: number; 
        unpaidLeaves: number; 
        halfDays: number; 
        remaining: number;
        attendanceRate: number;
    }) => ({
        subject: `Monthly Leave Summary - ${data.month}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #6366F1, #4F46E5); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
                    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
                    .stat { background: white; padding: 20px; border-radius: 8px; text-align: center; }
                    .stat-value { font-size: 28px; font-weight: bold; color: #4F46E5; }
                    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin:0;">📊 Monthly Leave Summary</h1>
                        <p style="margin:10px 0 0 0; opacity:0.9;">${data.month}</p>
                    </div>
                    <div class="content">
                        <p>Hi ${data.employeeName},</p>
                        <p>Here's your leave and attendance summary for ${data.month}:</p>
                        
                        <div class="stats">
                            <div class="stat">
                                <div class="stat-value">${data.paidLeaves}</div>
                                <div class="stat-label">Paid Leaves</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${data.unpaidLeaves}</div>
                                <div class="stat-label">Unpaid Leaves</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${data.halfDays}</div>
                                <div class="stat-label">Half Days</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${data.remaining}</div>
                                <div class="stat-label">Balance</div>
                            </div>
                        </div>
                        
                        <div style="background:white; padding:20px; border-radius:8px; text-align:center;">
                            <p style="margin:0; color:#6b7280;">Attendance Rate</p>
                            <p style="margin:10px 0 0 0; font-size:32px; font-weight:bold; color:${data.attendanceRate >= 90 ? '#10B981' : data.attendanceRate >= 80 ? '#F59E0B' : '#EF4444'};">
                                ${data.attendanceRate.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Continuum AI Leave Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `
    })
};

// Send email notification
export async function sendLeaveNotification(
    type: 'approved' | 'rejected' | 'escalated',
    leaveRequestId: string
) {
    try {
        // Get leave request details
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { request_id: leaveRequestId },
            include: {
                employee: true
            }
        });

        if (!leaveRequest) {
            return { success: false, error: "Leave request not found" };
        }

        const { employee } = leaveRequest;
        const startDate = new Date(leaveRequest.start_date).toLocaleDateString('en-IN');
        const endDate = new Date(leaveRequest.end_date).toLocaleDateString('en-IN');

        let emailData;
        switch (type) {
            case 'approved':
                emailData = EMAIL_TEMPLATES.leaveApproved({
                    employeeName: employee.full_name,
                    leaveType: leaveRequest.leave_type,
                    startDate,
                    endDate,
                    days: Number(leaveRequest.working_days)
                });
                break;
            case 'rejected':
                emailData = EMAIL_TEMPLATES.leaveRejected({
                    employeeName: employee.full_name,
                    leaveType: leaveRequest.leave_type,
                    startDate,
                    endDate,
                    reason: 'Your leave request was rejected based on company policy and current workload.'
                });
                break;
            case 'escalated':
                emailData = EMAIL_TEMPLATES.leaveEscalated({
                    employeeName: employee.full_name,
                    leaveType: leaveRequest.leave_type,
                    startDate,
                    endDate,
                    escalatedTo: 'HR Manager'
                });
                break;
        }

        // Send email if Resend is configured
        const resend = await getResend();
        if (resend) {
            await resend.emails.send({
                from: 'Continuum <noreply@continuum.hr>',
                to: employee.email,
                subject: emailData.subject,
                html: emailData.html
            });
        } else {
            // Log email in development
            console.log('[Email Mock]', {
                to: employee.email,
                subject: emailData.subject
            });
        }

        // Log audit
        await logAudit({
            action: type === 'approved' ? AuditAction.LEAVE_APPROVED : 
                    type === 'rejected' ? AuditAction.LEAVE_REJECTED : 
                    AuditAction.LEAVE_ESCALATED,
            actorId: 'system',
            actorType: 'system',
            entityType: 'LeaveRequest',
            entityId: leaveRequestId,
            details: { emailSent: true, type },
            orgId: employee.org_id || 'default'
        });

        return { success: true, message: "Notification sent" };

    } catch (error: any) {
        console.error("[sendLeaveNotification] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to send notification: ${error?.message || 'Unknown error'}` };
    }
}

// Send monthly leave summary to employee
export async function sendMonthlySummary(empId: string, month: number, year: number) {
    try {
        const employee = await prisma.employee.findUnique({
            where: { emp_id: empId },
            include: {
                leave_requests: {
                    where: {
                        start_date: {
                            gte: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
                            lte: new Date(`${year}-${String(month).padStart(2, '0')}-31`)
                        },
                        status: 'approved'
                    }
                },
                leave_balances: {
                    where: { year }
                },
                attendances: {
                    where: {
                        date: {
                            gte: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
                            lte: new Date(`${year}-${String(month).padStart(2, '0')}-31`)
                        }
                    }
                }
            }
        });

        if (!employee) {
            return { success: false, error: "Employee not found" };
        }

        // Calculate stats
        const paidLeaves = employee.leave_requests
            .filter(l => ['annual', 'sick', 'casual'].includes(l.leave_type))
            .reduce((sum, l) => sum + Number(l.working_days), 0);

        const unpaidLeaves = employee.leave_requests
            .filter(l => l.leave_type === 'unpaid')
            .reduce((sum, l) => sum + Number(l.working_days), 0);

        const halfDays = employee.leave_requests
            .filter(l => l.is_half_day).length;

        const totalBalance = employee.leave_balances.reduce(
            (sum, b) => sum + Number(b.annual_entitlement) + Number(b.carried_forward) - Number(b.used_days),
            0
        );

        const presentDays = employee.attendances.filter(
            a => a.status === 'PRESENT' || a.status === 'LATE'
        ).length;

        // Calculate working days in month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        let workingDays = 0;
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) workingDays++;
        }

        const attendanceRate = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;

        const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const emailData = EMAIL_TEMPLATES.leaveSummary({
            employeeName: employee.full_name,
            month: monthName,
            paidLeaves,
            unpaidLeaves,
            halfDays,
            remaining: totalBalance,
            attendanceRate
        });

        // Send email
        const resend = await getResend();
        if (resend) {
            await resend.emails.send({
                from: 'Continuum <noreply@continuum.hr>',
                to: employee.email,
                subject: emailData.subject,
                html: emailData.html
            });
        } else {
            console.log('[Email Mock] Monthly Summary', {
                to: employee.email,
                month: monthName
            });
        }

        return { success: true, message: "Monthly summary sent" };

    } catch (error: any) {
        console.error("[sendMonthlySummary] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to send monthly summary: ${error?.message || 'Unknown error'}` };
    }
}

// Send bulk notifications to all employees
export async function sendBulkMonthlySummaries(month: number, year: number) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const hrEmployee = await prisma.employee.findUnique({
        where: { clerk_id: user.id }
    });

    if (!hrEmployee || (hrEmployee.role !== 'hr' && hrEmployee.role !== 'admin')) {
        return { success: false, error: "HR access required" };
    }

    try {
        const employees = await prisma.employee.findMany({
            where: {
                org_id: hrEmployee.org_id,
                is_active: true
            },
            select: { emp_id: true }
        });

        const results = await Promise.allSettled(
            employees.map(emp => sendMonthlySummary(emp.emp_id, month, year))
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return {
            success: true,
            summary: {
                total: employees.length,
                successful,
                failed
            }
        };

    } catch (error: any) {
        console.error("[sendBulkMonthlySummaries] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to send bulk summaries: ${error?.message || 'Unknown error'}` };
    }
}
