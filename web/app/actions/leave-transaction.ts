"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { analyzeLeaveRequest, AIAnalysisResult } from "./leave-constraints";
import { revalidatePath } from "next/cache";

export async function submitLeaveRequest(formData: {
    leaveType: string;
    reason: string;
    startDate: string;
    endDate: string;
    days: number;
    isHalfDay?: boolean;
}) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // 1. Get Employee
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
    });
    if (!employee) return { success: false, error: "Employee not found" };

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

        revalidatePath("/dashboard"); // Reflect balance change
        return { success: true, request: result, analysis };

    } catch (error: any) {
        console.error("Leave Transaction Error:", error);
        return { success: false, error: error.message || "Transaction Failed" };
    }
}
