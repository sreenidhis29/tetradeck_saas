"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { analyzeLeaveRequest, AIAnalysisResult } from "./leave-constraints";
import { revalidatePath } from "next/cache";
import { sendHRNewLeaveRequestEmail, sendLeaveApprovalEmail, sendLeaveSubmissionEmail } from "@/lib/email-service";

export async function submitLeaveRequest(formData: {
    leaveType: string;
    reason: string;
    startDate: string;
    endDate: string;
    days: number;
    isHalfDay?: boolean;
    documentId?: string; // Optional document attachment
}) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // 1. Get Employee with company
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        include: { company: true }
    });
    if (!employee) return { success: false, error: "Employee not found" };
    if (!employee.org_id) return { success: false, error: "Employee not linked to company" };

    // 2. Get company's configured leave types
    const companyLeaveTypes = await prisma.leaveType.findMany({
        where: { company_id: employee.org_id, is_active: true }
    });
    
    // Also get approval settings for document requirements
    const constraintPolicy = await prisma.constraintPolicy.findFirst({
        where: { org_id: employee.org_id, is_active: true }
    });
    const approvalSettings = (constraintPolicy?.rules as any) || {};

    // 3. Validate leave type against company's configured types
    const validTypeCodes = companyLeaveTypes.map(lt => lt.code.toUpperCase());
    const requestedType = formData.leaveType.toUpperCase();
    
    // Allow standard types if company hasn't configured any
    const fallbackTypes = ['CL', 'SL', 'PL', 'ML', 'PTL', 'BL', 'UL', 'COMP', 'ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'UNPAID', 'COMPENSATORY'];
    const allowedTypes = validTypeCodes.length > 0 ? validTypeCodes : fallbackTypes;
    
    if (!allowedTypes.includes(requestedType)) {
        return { success: false, error: `Invalid leave type: ${formData.leaveType}. Available types: ${allowedTypes.join(', ')}` };
    }

    // Get the specific leave type configuration
    const leaveTypeConfig = companyLeaveTypes.find(lt => lt.code.toUpperCase() === requestedType);

    // 4. Validate reason
    if (!formData.reason || typeof formData.reason !== 'string' || formData.reason.trim().length < 5) {
        return { success: false, error: "Reason must be at least 5 characters" };
    }

    if (formData.reason.length > 1000) {
        return { success: false, error: "Reason must not exceed 1000 characters" };
    }

    // 5. Date validation
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { success: false, error: "Invalid date format" };
    }

    if (endDate < startDate) {
        return { success: false, error: "End date cannot be before start date" };
    }

    // Prevent requests more than 6 months in advance or more than 1 year in the past
    const now = new Date();
    const sixMonthsFromNow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    if (startDate > sixMonthsFromNow) {
        return { success: false, error: "Cannot request leave more than 6 months in advance" };
    }

    if (startDate < oneYearAgo) {
        return { success: false, error: "Cannot request leave for dates more than 1 year ago" };
    }

    // 6. Days validation
    if (typeof formData.days !== 'number' || formData.days <= 0 || formData.days > 90) {
        return { success: false, error: "Days must be between 1 and 90" };
    }

    // 7. Half day validation - check against leave type configuration
    if (formData.isHalfDay) {
        if (formData.days !== 0.5) {
            return { success: false, error: "Half day requests must be 0.5 days" };
        }
        if (leaveTypeConfig && !leaveTypeConfig.half_day_allowed) {
            return { success: false, error: `Half-day is not allowed for ${leaveTypeConfig.name}` };
        }
    }

    // 8. Document requirement validation
    const requireDocAboveDays = approvalSettings.escalation?.require_document_above_days || 3;
    const leaveTypeRequiresDoc = leaveTypeConfig?.requires_document || false;
    
    if ((formData.days > requireDocAboveDays || leaveTypeRequiresDoc) && !formData.documentId) {
        const reason = leaveTypeRequiresDoc 
            ? `${leaveTypeConfig?.name || formData.leaveType} requires a supporting document`
            : `Leave requests over ${requireDocAboveDays} days require a supporting document`;
        return { success: false, error: reason, requiresDocument: true };
    }

    try {
        // 2. Run AI Analysis
        const analysisRes = await analyzeLeaveRequest({
            type: formData.leaveType,
            reason: formData.reason,
            startDate: formData.startDate,
            endDate: formData.endDate,
            days: formData.days,
            isHalfDay: formData.isHalfDay
        });

        // Default to strict 'Escalate' if analysis fails or returns error
        const analysis: AIAnalysisResult = (analysisRes as any).analysis || {
            approved: false,
            message: "AI Analysis Failed",
            violations: ["System Error"],
            suggestions: []
        };

        const isAutoApprovable = analysis.approved === true;
        const requestStatus = isAutoApprovable ? "approved" : "escalated";

        // 3. Atomic Transaction
        const result = await prisma.$transaction(async (tx) => {
            // A. Check Balance
            const currentYear = new Date().getFullYear();
            let balance = await tx.leaveBalance.findUnique({
                where: {
                    emp_id_leave_type_year: {
                        emp_id: employee.emp_id,
                        leave_type: formData.leaveType,
                        year: currentYear
                    }
                }
            });

            // If no balance record, create one (Seed on fly logic)
            if (!balance) {
                balance = await tx.leaveBalance.create({
                    data: {
                        emp_id: employee.emp_id,
                        leave_type: formData.leaveType,
                        year: currentYear,
                        country_code: employee.country_code || "IN",
                        annual_entitlement: 12, // Default
                        used_days: 0,
                        pending_days: 0,
                        carried_forward: 0
                    }
                });
            }

            const stats = {
                entitled: Number(balance.annual_entitlement) + Number(balance.carried_forward),
                used: Number(balance.used_days),
                pending: Number(balance.pending_days)
            };
            const remaining = stats.entitled - stats.used - stats.pending;

            if (remaining < formData.days) {
                throw new Error(`Insufficient Balance. Remaining: ${remaining}, Requested: ${formData.days}`);
            }

            // B. Update Balance
            // If Approved: deduct from 'Used'? Or add to 'Pending' then async job moves to 'Used'?
            // Prompt says "Decrement count (12 -> 11)".
            // If Pending/Escalated, we usually add to Pending.
            // If Approved, we add to Used.

            if (requestStatus === 'approved') {
                await tx.leaveBalance.update({
                    where: { balance_id: balance.balance_id },
                    data: {
                        used_days: { increment: formData.days }
                    }
                });
            } else {
                await tx.leaveBalance.update({
                    where: { balance_id: balance.balance_id },
                    data: {
                        pending_days: { increment: formData.days }
                    }
                });
            }

            // C. Create Leave Request
            const requestId = `REQ-${Date.now()}`;
            const newRequest = await tx.leaveRequest.create({
                data: {
                    request_id: requestId,
                    emp_id: employee.emp_id,
                    country_code: employee.country_code || "IN",
                    leave_type: formData.leaveType,
                    start_date: new Date(formData.startDate),
                    end_date: new Date(formData.endDate),
                    total_days: formData.days,
                    working_days: formData.days, // Simplified
                    reason: formData.reason,
                    status: requestStatus,
                    is_half_day: formData.isHalfDay || false,
                    ai_recommendation: isAutoApprovable ? "approve" : "escalate",
                    ai_confidence: 0.95, // Mocked from Python if available
                    ai_analysis_json: JSON.stringify(analysis) as any,
                    // SLA
                    sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h SLA
                }
            });

            return newRequest;
        });

        // ALWAYS send submission confirmation to employee
        sendLeaveSubmissionEmail(
            { email: employee.email, full_name: employee.full_name || 'Employee' },
            {
                requestId: result.request_id,
                leaveType: formData.leaveType,
                startDate: new Date(formData.startDate).toLocaleDateString('en-US', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                }),
                endDate: new Date(formData.endDate).toLocaleDateString('en-US', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                }),
                totalDays: formData.days,
                reason: formData.reason
            }
        ).catch(err => console.error('Leave submission email failed:', err));

        // Notify HR about new leave request (if escalated/pending)
        if (requestStatus === 'escalated') {
            const hrUsers = await prisma.employee.findMany({
                where: {
                    org_id: employee.org_id,
                    role: 'hr',
                    is_active: true
                },
                select: { email: true }
            });

            for (const hr of hrUsers) {
                sendHRNewLeaveRequestEmail(hr.email, {
                    employeeName: employee.full_name || 'Employee',
                    leaveType: formData.leaveType,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    totalDays: formData.days,
                    reason: formData.reason,
                    requestedAt: new Date().toLocaleString()
                }).catch(err => console.error('HR leave notification failed:', err));
            }
        } else if (requestStatus === 'approved') {
            // Auto-approved: notify employee
            sendLeaveApprovalEmail(
                { email: employee.email, full_name: employee.full_name || 'Employee' },
                {
                    leaveType: formData.leaveType,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    totalDays: formData.days,
                    approvedBy: 'AI System (Auto-Approved)',
                    reason: 'Your request meets all policy requirements.'
                }
            ).catch(err => console.error('Leave approval email failed:', err));
        }

        revalidatePath("/dashboard"); // Reflect balance change
        return { success: true, request: result, analysis };

    } catch (error: any) {
        console.error("Leave Transaction Error:", error);
        return { success: false, error: error.message || "Transaction Failed" };
    }
}
