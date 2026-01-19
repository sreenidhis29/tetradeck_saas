import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendLeaveApprovalEmail, sendPriorityLeaveNotification } from "@/lib/email-service";

/**
 * Leave Request Submission API
 * 
 * Handles leave request submission with:
 * - AI-based auto-approval or escalation
 * - Explainable decision reasoning
 * - Graceful error handling with fallback
 */
export async function POST(req: NextRequest) {
    const explanations: string[] = [];
    
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ 
                success: false, 
                error: "Unauthorized",
                explanation: "User authentication failed. Please sign in again."
            }, { status: 401 });
        }

        const body = await req.json();
        const { leaveType, startDate, endDate, days, reason, aiRecommendation, aiConfidence, aiAnalysis, isHalfDay } = body;

        // Validate required fields
        if (!leaveType || !startDate || !endDate || !days) {
            return NextResponse.json({ 
                success: false, 
                error: "Missing required fields",
                explanation: "Please provide leave type, start date, end date, and duration."
            }, { status: 400 });
        }

        explanations.push(`Processing ${days} day(s) ${leaveType} request from ${startDate} to ${endDate}`);

        // Get employee from database
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
        });

        if (!employee) {
            return NextResponse.json({ 
                success: false, 
                error: "Employee not found",
                explanation: "Your employee profile was not found. Please contact HR to set up your account."
            }, { status: 404 });
        }

        explanations.push(`Employee: ${employee.full_name} (${employee.department || 'No Department'})`);

        // Determine status based on AI recommendation
        const recommendationLower = (aiRecommendation || '').toString().toLowerCase();
        const isAutoApprovable = recommendationLower === 'approve' || recommendationLower === 'approved';
        
        // Half-day requests always require HR approval
        const requiresHRApproval = isHalfDay === true;
        const requestStatus = (isAutoApprovable && !requiresHRApproval) ? "approved" : "escalated";

        // Build decision explanation
        let decisionReason = '';
        if (requestStatus === 'approved') {
            decisionReason = `✅ AUTO-APPROVED: All ${(aiAnalysis?.constraint_results?.total_rules || 'policy')} constraints satisfied. `;
            decisionReason += `AI Confidence: ${Math.round((aiConfidence || 0.95) * 100)}%.`;
            explanations.push(decisionReason);
        } else {
            if (requiresHRApproval) {
                decisionReason = '⚠️ ESCALATED: Half-day leaves always require HR approval for accurate tracking.';
            } else if (aiAnalysis?.violations?.length > 0) {
                const violationSummary = aiAnalysis.violations
                    .slice(0, 3)
                    .map((v: any) => v.rule_name || v.message || 'Policy violation')
                    .join(', ');
                decisionReason = `⚠️ ESCALATED: ${aiAnalysis.violations.length} constraint(s) need HR review: ${violationSummary}`;
            } else {
                decisionReason = '⚠️ ESCALATED: Request requires HR approval based on policy rules.';
            }
            explanations.push(decisionReason);
        }

        console.log(`[Submit] ${decisionReason}`);

        // Perform atomic transaction
        const result = await prisma.$transaction(async (tx) => {
            // A. Check Balance
            const currentYear = new Date().getFullYear();
            let balance = await tx.leaveBalance.findUnique({
                where: {
                    emp_id_leave_type_year: {
                        emp_id: employee.emp_id,
                        leave_type: leaveType,
                        year: currentYear
                    }
                }
            });

            // If no balance record exists, create one with defaults
            if (!balance) {
                explanations.push(`No existing ${leaveType} balance found - creating with 12 day entitlement`);
                balance = await tx.leaveBalance.create({
                    data: {
                        emp_id: employee.emp_id,
                        leave_type: leaveType,
                        year: currentYear,
                        country_code: employee.country_code || "IN",
                        annual_entitlement: 12,
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

            explanations.push(`Balance: ${remaining} days remaining (${stats.entitled} total - ${stats.used} used - ${stats.pending} pending)`);

            if (remaining < days) {
                throw new Error(`Insufficient Balance. You have ${remaining} days available but requested ${days} days.`);
            }

            // B. Update Balance
            if (requestStatus === 'approved') {
                await tx.leaveBalance.update({
                    where: { balance_id: balance.balance_id },
                    data: {
                        used_days: { increment: days }
                    }
                });
                explanations.push(`Deducted ${days} days from ${leaveType} balance`);
            } else {
                await tx.leaveBalance.update({
                    where: { balance_id: balance.balance_id },
                    data: {
                        pending_days: { increment: days }
                    }
                });
                explanations.push(`Reserved ${days} days as pending (will be deducted upon HR approval)`);
            }

            // C. Create Leave Request with explanation
            const requestId = `REQ-${Date.now()}`;
            const newRequest = await tx.leaveRequest.create({
                data: {
                    request_id: requestId,
                    emp_id: employee.emp_id,
                    country_code: employee.country_code || "IN",
                    leave_type: leaveType,
                    start_date: new Date(startDate),
                    end_date: new Date(endDate),
                    total_days: days,
                    working_days: days,
                    reason: reason || decisionReason, // Include decision reason in the request reason
                    status: requestStatus,
                    is_half_day: isHalfDay || false,
                    ai_recommendation: isAutoApprovable ? "approve" : "escalate",
                    ai_confidence: aiConfidence || 0.95,
                    ai_analysis_json: aiAnalysis ? JSON.stringify({
                        ...aiAnalysis,
                        decision_reason: decisionReason,
                        explanations
                    }) : undefined,
                    sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h SLA
                }
            });

            return newRequest;
        });

        // Send email notification for auto-approved requests
        if (requestStatus === 'approved') {
            sendLeaveApprovalEmail(
                { email: employee.email, full_name: employee.full_name },
                {
                    leaveType,
                    startDate: new Date(startDate).toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    }),
                    endDate: new Date(endDate).toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    }),
                    totalDays: days,
                    approvedBy: 'AI System',
                    reason: decisionReason
                }
            ).catch(err => console.error('Email notification failed:', err));
        } else {
            // Send priority notification to HR for escalated requests
            // Determine priority based on leave type and urgency
            const isUrgent = leaveType.toLowerCase().includes('emergency') || 
                             leaveType.toLowerCase().includes('sick') ||
                             new Date(startDate) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Within 2 days
            
            const isCritical = leaveType.toLowerCase().includes('emergency') && 
                               new Date(startDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000); // Within 1 day

            const priority = isCritical ? 'CRITICAL' : isUrgent ? 'URGENT' : 'HIGH';

            // Get HR users to notify
            const hrUsers = await prisma.employee.findMany({
                where: {
                    OR: [
                        { role: 'hr' },
                        { role: 'admin' }
                    ]
                },
                select: { email: true }
            });

            // Send notification to all HR users
            for (const hr of hrUsers) {
                sendPriorityLeaveNotification(
                    hr.email,
                    {
                        employeeName: employee.full_name,
                        leaveType,
                        startDate: new Date(startDate).toLocaleDateString('en-US', { 
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                        }),
                        endDate: new Date(endDate).toLocaleDateString('en-US', { 
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                        }),
                        days,
                        reason: reason || 'No reason provided',
                        priority
                    }
                ).catch(err => console.error('HR notification failed:', err));
            }
        }

        // Revalidate paths to update UI
        revalidatePath("/employee/dashboard");
        revalidatePath("/employee/request-leave");
        revalidatePath("/employee/my-history");
        revalidatePath("/hr/dashboard");
        revalidatePath("/hr/leave-requests");

        const userMessage = requestStatus === 'approved' 
            ? "✅ Leave request auto-approved! Check your email for confirmation." 
            : "📋 Leave request submitted for HR review. You'll be notified once reviewed.";

        return NextResponse.json({
            success: true,
            request: {
                request_id: result.request_id,
                status: result.status,
                leave_type: result.leave_type,
                start_date: result.start_date,
                end_date: result.end_date,
                total_days: result.total_days
            },
            message: userMessage,
            explanation: explanations.join(' → '),
            decision_reason: decisionReason
        });

    } catch (error) {
        console.error("[API] Leave Submit Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to submit leave request";
        
        return NextResponse.json(
            { 
                success: false, 
                error: errorMessage,
                explanation: `Request failed: ${errorMessage}. Please try again or contact HR for assistance.`,
                suggestions: [
                    "Check your leave balance",
                    "Verify the dates are correct",
                    "Try a different leave type",
                    "Contact HR for help"
                ]
            }, 
            { status: 500 }
        );
    }
}
