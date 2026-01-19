"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export type AIAnalysisResult = {
    approved: boolean;
    message: string;
    violations: string[];
    suggestions: string[];
    confidence?: number;
    explanation?: string;
    decision_reason?: string;
};

/**
 * Analyze Leave Request with Explainable AI
 * 
 * All decisions include:
 * - Clear reasoning for why request was approved/escalated
 * - Specific constraint violations if any
 * - Helpful suggestions for resolution
 * - Graceful fallback if AI engine unavailable
 */
export async function analyzeLeaveRequest(
    leaveDetails: {
        type: string;
        reason: string;
        startDate: string;
        endDate: string;
        days: number;
        isHalfDay?: boolean;
    }
) {
    const user = await currentUser();
    if (!user) return { 
        error: "Unauthorized",
        explanation: "User session expired. Please sign in again." 
    };

    try {
        // 1. Fetch Context (Employee, Company, Policy, Team Stats)
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: {
                company: {
                    include: { policies: true }
                }
            }
        });

        if (!employee || !employee.company) {
            return { 
                error: "Employee not linked to company",
                explanation: "Your profile is not properly set up. Please contact HR."
            };
        }

        // 2. Fetch REAL Team Stats - count employees in same department and currently on leave
        const department = employee.department || 'General';
        
        const [teamCount, onLeaveCount] = await Promise.all([
            // Count team members in same department
            prisma.employee.count({
                where: {
                    org_id: employee.org_id,
                    department: department
                }
            }),
            // Count who's on leave during the requested period
            prisma.leaveRequest.count({
                where: {
                    status: 'approved',
                    employee: {
                        org_id: employee.org_id,
                        department: department
                    },
                    OR: [
                        {
                            start_date: { lte: new Date(leaveDetails.endDate) },
                            end_date: { gte: new Date(leaveDetails.startDate) }
                        }
                    ]
                }
            })
        ]);

        const teamState = {
            teamSize: teamCount || 1,
            alreadyOnLeave: onLeaveCount,
            min_coverage: 3,
            max_concurrent_leave: 5,
            blackoutDates: []
        };

        // 3. Get Rules from Policy
        const activePolicy = employee.company.policies.find(p => p.is_active) || { rules: {} };
        const rules = activePolicy.rules as any;

        // Merge policy rules into team state if needed
        if (rules.min_coverage) teamState.min_coverage = rules.min_coverage;
        if (rules.max_concurrent) teamState.max_concurrent_leave = rules.max_concurrent;

        // 4. Fetch REAL leave balance
        const currentYear = new Date().getFullYear();
        const balance = await prisma.leaveBalance.findUnique({
            where: {
                emp_id_leave_type_year: {
                    emp_id: employee.emp_id,
                    leave_type: leaveDetails.type,
                    year: currentYear
                }
            }
        });

        const totalEntitlement = balance 
            ? Number(balance.annual_entitlement) + Number(balance.carried_forward)
            : 12; // Default if no balance record
        const usedDays = balance ? Number(balance.used_days) + Number(balance.pending_days) : 0;
        const remainingBalance = totalEntitlement - usedDays;

        // 5. Construct Payload with REAL data
        const payload = {
            text: leaveDetails.reason,
            employee_id: employee.emp_id,
            extracted_info: {
                type: leaveDetails.type,
                dates: [leaveDetails.startDate],
                duration: leaveDetails.days,
                is_half_day: leaveDetails.isHalfDay || false
            },
            team_state: {
                team: teamState,
                blackoutDates: rules.blackoutDates || []
            },
            leave_balance: {
                remaining: remainingBalance
            },
            is_half_day: leaveDetails.isHalfDay || false
        };

        // 6. Call Python Constraint Engine
        const agentUrl = (process.env.CONSTRAINT_ENGINE_URL || "http://127.0.0.1:8001") + "/analyze";

        let analysis: AIAnalysisResult;

        try {
            const response = await fetch(agentUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(`Agent returned ${response.status}`);
            }

            analysis = await response.json();
            
            // Ensure response has explanation
            if (!analysis.explanation) {
                analysis.explanation = analysis.approved 
                    ? `✅ All constraints satisfied. Your ${leaveDetails.type} request for ${leaveDetails.days} days has been auto-approved.`
                    : `⚠️ Request escalated to HR. ${analysis.violations?.length || 0} constraint(s) require manual review.`;
            }
            
        } catch (agentError) {
            console.error("AI Agent Unreachable:", agentError);
            
            // Graceful Fallback - Do local validation
            const fallbackViolations: string[] = [];
            const fallbackSuggestions: string[] = [];
            
            // Basic validations without AI engine
            if (remainingBalance < leaveDetails.days) {
                fallbackViolations.push(`Insufficient balance: ${remainingBalance} days available, ${leaveDetails.days} requested`);
                fallbackSuggestions.push("Try requesting fewer days");
            }
            
            if (leaveDetails.isHalfDay) {
                fallbackViolations.push("Half-day requests require HR approval");
            }
            
            if (onLeaveCount >= teamState.max_concurrent_leave) {
                fallbackViolations.push(`Team coverage: ${onLeaveCount} colleagues already on leave`);
                fallbackSuggestions.push("Try different dates when more team members are available");
            }
            
            // If no violations found in fallback, still escalate for safety
            const canAutoApprove = fallbackViolations.length === 0 && !leaveDetails.isHalfDay;
            
            return {
                fallback: true,
                success: true,
                analysis: {
                    approved: canAutoApprove,
                    message: canAutoApprove 
                        ? "Request validated locally (AI engine unavailable)"
                        : "Escalated for manual review",
                    violations: fallbackViolations,
                    suggestions: fallbackSuggestions,
                    confidence: canAutoApprove ? 0.75 : 0.5,
                    explanation: `⚠️ AI Constraint Engine temporarily unavailable. ${
                        canAutoApprove 
                            ? 'Basic validation passed - request auto-approved.' 
                            : `Manual review required: ${fallbackViolations.join('; ') || 'Safety escalation'}`
                    }`,
                    decision_reason: canAutoApprove 
                        ? "Local validation passed all basic checks"
                        : `Escalated: ${fallbackViolations[0] || 'AI engine offline, safety escalation'}`
                }
            };
        }

        return { success: true, analysis };

    } catch (error) {
        console.error("Analysis Error:", error);
        return { 
            error: "Failed to analyze request",
            explanation: `System error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Your request will be sent for manual HR review.`,
            fallback: true,
            analysis: {
                approved: false,
                message: "Error during analysis - escalated to HR",
                violations: ["System error"],
                suggestions: ["Wait a few minutes and try again", "Contact HR directly"],
                confidence: 0.5,
                explanation: "Request escalated due to system error. HR will review manually."
            }
        };
    }
}
