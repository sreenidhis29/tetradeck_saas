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
 * Get Company-Specific Settings for an Employee
 * This ensures each company has isolated settings
 */
async function getCompanySettings(orgId: string) {
    // Fetch company settings including work schedule
    const company = await prisma.company.findUnique({
        where: { id: orgId },
        select: {
            id: true,
            name: true,
            work_start_time: true,
            work_end_time: true,
            grace_period_mins: true,
            half_day_hours: true,
            full_day_hours: true,
            work_days: true,
            timezone: true,
            leave_year_start: true,
            carry_forward_max: true,
            probation_leave: true,
            negative_balance: true,
        }
    });

    // Fetch company-specific leave types
    const leaveTypes = await prisma.leaveType.findMany({
        where: { company_id: orgId, is_active: true },
        orderBy: { sort_order: 'asc' }
    });

    // Fetch company-specific leave rules
    const leaveRules = await prisma.leaveRule.findMany({
        where: { company_id: orgId, is_active: true },
        orderBy: { priority: 'desc' }
    });

    // Also fetch legacy ConstraintPolicy for backwards compatibility
    const legacyPolicy = await prisma.constraintPolicy.findFirst({
        where: { org_id: orgId, is_active: true }
    });

    return {
        company,
        leaveTypes,
        leaveRules,
        legacyPolicy,
    };
}

/**
 * Get leave type configuration for a specific type in a company
 */
function getLeaveTypeConfig(leaveTypes: any[], typeCode: string) {
    // Try to find by code first, then by name
    const found = leaveTypes.find(lt => 
        lt.code.toUpperCase() === typeCode.toUpperCase() ||
        lt.name.toLowerCase().includes(typeCode.toLowerCase())
    );
    
    if (found) {
        return {
            code: found.code,
            name: found.name,
            annual_quota: found.annual_quota,
            max_consecutive: found.max_consecutive,
            min_notice_days: found.min_notice_days,
            requires_document: found.requires_document,
            requires_approval: found.requires_approval,
            half_day_allowed: found.half_day_allowed,
            gender_specific: found.gender_specific,
            carry_forward: found.carry_forward,
            max_carry_forward: found.max_carry_forward,
            is_paid: found.is_paid,
        };
    }
    
    // Return defaults if not found
    return {
        code: typeCode.toUpperCase(),
        name: typeCode,
        annual_quota: 12,
        max_consecutive: 5,
        min_notice_days: 1,
        requires_document: false,
        requires_approval: true,
        half_day_allowed: true,
        gender_specific: null,
        carry_forward: false,
        max_carry_forward: 0,
        is_paid: true,
    };
}

/**
 * Check company-specific leave rules
 */
function evaluateLeaveRules(
    leaveRules: any[],
    leaveDetails: { startDate: string; endDate: string; days: number },
    teamState: { alreadyOnLeave: number; teamSize: number },
    department?: string
): { violations: string[]; suggestions: string[]; blocking: boolean } {
    const violations: string[] = [];
    const suggestions: string[] = [];
    let hasBlockingViolation = false;

    for (const rule of leaveRules) {
        // Check if rule applies to this department
        if (!rule.applies_to_all && rule.departments?.length > 0) {
            if (department && !rule.departments.includes(department)) {
                continue; // Skip rule - doesn't apply to this department
            }
        }

        const config = rule.config as Record<string, any>;

        switch (rule.rule_type) {
            case 'blackout':
                // Check blackout dates
                if (config.dates?.length > 0) {
                    const startDate = new Date(leaveDetails.startDate);
                    const endDate = new Date(leaveDetails.endDate);
                    
                    for (const blackoutDate of config.dates) {
                        const blackout = new Date(blackoutDate);
                        if (blackout >= startDate && blackout <= endDate) {
                            violations.push(`${rule.name}: ${blackoutDate} is a blackout date`);
                            suggestions.push("Choose dates outside the blackout period");
                            if (rule.is_blocking) hasBlockingViolation = true;
                        }
                    }
                }
                // Check blackout days of week
                if (config.days_of_week?.length > 0) {
                    // Warning for weekend-only leaves
                    violations.push(`${rule.name}: Leave includes restricted days`);
                    if (rule.is_blocking) hasBlockingViolation = true;
                }
                break;

            case 'max_concurrent':
                // Check concurrent leave limit
                const maxConcurrent = config.max_count || Math.ceil(teamState.teamSize * (config.max_percentage || 10) / 100);
                if (teamState.alreadyOnLeave >= maxConcurrent) {
                    violations.push(`${rule.name}: ${teamState.alreadyOnLeave} colleagues already on leave (max: ${maxConcurrent})`);
                    suggestions.push("Try different dates when fewer team members are on leave");
                    if (rule.is_blocking) hasBlockingViolation = true;
                }
                break;

            case 'min_gap':
                // Would need to check previous leaves - simplified for now
                const minGap = config.days || 7;
                suggestions.push(`Note: ${rule.name} requires ${minGap} days gap between leaves`);
                break;

            case 'department_limit':
                // Department-specific limits
                const deptLimit = config.max_per_department || 2;
                if (teamState.alreadyOnLeave >= deptLimit) {
                    violations.push(`${rule.name}: Department leave limit reached (${deptLimit})`);
                    if (rule.is_blocking) hasBlockingViolation = true;
                }
                break;
        }
    }

    return { violations, suggestions, blocking: hasBlockingViolation };
}

/**
 * Analyze Leave Request with Explainable AI
 * 
 * All decisions include:
 * - Clear reasoning for why request was approved/escalated
 * - Specific constraint violations if any
 * - Helpful suggestions for resolution
 * - Graceful fallback if AI engine unavailable
 * 
 * MULTI-TENANT: Each company's settings are isolated
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
        // 1. Fetch Employee with Company
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: {
                company: true
            }
        });

        if (!employee || !employee.company) {
            return { 
                error: "Employee not linked to company",
                explanation: "Your profile is not properly set up. Please contact HR."
            };
        }

        // 2. Fetch COMPANY-SPECIFIC settings (multi-tenant isolation)
        const companySettings = await getCompanySettings(employee.org_id!);
        const { company, leaveTypes, leaveRules, legacyPolicy } = companySettings;

        // 3. Get leave type configuration for this company
        const leaveTypeConfig = getLeaveTypeConfig(leaveTypes, leaveDetails.type);

        // 4. Validate against company-specific leave type rules
        const violations: string[] = [];
        const suggestions: string[] = [];

        // Check if half-day is allowed for this leave type
        if (leaveDetails.isHalfDay && !leaveTypeConfig.half_day_allowed) {
            violations.push(`Half-day not allowed for ${leaveTypeConfig.name}`);
            suggestions.push("Request a full day instead");
        }

        // Check max consecutive days
        if (leaveDetails.days > leaveTypeConfig.max_consecutive) {
            violations.push(`Exceeds maximum consecutive days (${leaveTypeConfig.max_consecutive}) for ${leaveTypeConfig.name}`);
            suggestions.push(`Split your leave into periods of ${leaveTypeConfig.max_consecutive} days or less`);
        }

        // Check minimum notice period
        const daysUntilStart = Math.ceil((new Date(leaveDetails.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilStart < leaveTypeConfig.min_notice_days) {
            violations.push(`Insufficient notice: ${leaveTypeConfig.name} requires ${leaveTypeConfig.min_notice_days} days advance notice`);
            suggestions.push(`Submit requests at least ${leaveTypeConfig.min_notice_days} days in advance`);
        }

        // Check gender-specific leave
        if (leaveTypeConfig.gender_specific) {
            const employeeGender = (employee as any).gender;
            if (employeeGender && employeeGender !== leaveTypeConfig.gender_specific) {
                violations.push(`${leaveTypeConfig.name} is only available for ${leaveTypeConfig.gender_specific === 'F' ? 'female' : 'male'} employees`);
            }
        }

        // 5. Fetch REAL Team Stats for this company
        const department = employee.department || 'General';
        
        const [teamCount, onLeaveCount] = await Promise.all([
            prisma.employee.count({
                where: {
                    org_id: employee.org_id,
                    department: department
                }
            }),
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
        };

        // 6. Evaluate COMPANY-SPECIFIC leave rules
        const ruleResults = evaluateLeaveRules(leaveRules, leaveDetails, teamState, department);
        violations.push(...ruleResults.violations);
        suggestions.push(...ruleResults.suggestions);

        // 7. Fetch REAL leave balance for this employee in this company
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

        // Use company-specific quota or balance record
        const totalEntitlement = balance 
            ? Number(balance.annual_entitlement) + Number(balance.carried_forward)
            : leaveTypeConfig.annual_quota;
        const usedDays = balance ? Number(balance.used_days) + Number(balance.pending_days) : 0;
        const remainingBalance = totalEntitlement - usedDays;

        // Check balance
        if (remainingBalance < leaveDetails.days) {
            if (!company?.negative_balance) {
                violations.push(`Insufficient ${leaveTypeConfig.name} balance: ${remainingBalance} days available, ${leaveDetails.days} requested`);
                suggestions.push("Request fewer days or apply for Leave Without Pay");
            } else {
                suggestions.push(`Note: This will result in negative balance (company allows negative balance)`);
            }
        }

        // 8. Check probation restriction
        if (!company?.probation_leave && employee.onboarding_status !== 'completed') {
            const hireDate = (employee as any).hire_date;
            if (hireDate) {
                const probationEnd = new Date(hireDate);
                probationEnd.setDate(probationEnd.getDate() + 90); // 90 day probation
                if (new Date() < probationEnd) {
                    violations.push("Leave not available during probation period");
                    suggestions.push("Contact HR for special circumstances");
                }
            }
        }

        // 9. Prepare legacy policy rules for AI engine
        const legacyRules = legacyPolicy?.rules as any || {};
        
        // 10. Get approval settings from the policy
        const approvalSettings = {
            auto_approve: legacyRules.auto_approve || { max_days: 3, min_notice_days: 1, allowed_leave_types: ["CL", "SL"] },
            escalation: legacyRules.escalation || { above_days: 5, consecutive_leaves: true, low_balance: true, require_document_above_days: 3 },
            team_coverage: legacyRules.team_coverage || { max_concurrent: 3, min_coverage: 2 },
            blackout: legacyRules.blackout || { dates: [], days_of_week: [] },
        };

        // 11. Evaluate approval rules from ConstraintPolicy
        let canAutoApprove = true;
        
        // Check if leave type is allowed for auto-approve
        if (!approvalSettings.auto_approve.allowed_leave_types?.includes(leaveDetails.type.toUpperCase())) {
            canAutoApprove = false;
            suggestions.push(`${leaveTypeConfig.name} requires HR approval for all requests`);
        }
        
        // Check max days for auto-approve
        if (leaveDetails.days > approvalSettings.auto_approve.max_days) {
            canAutoApprove = false;
            suggestions.push(`Requests over ${approvalSettings.auto_approve.max_days} days require HR approval`);
        }
        
        // Check minimum notice for auto-approve
        if (daysUntilStart < approvalSettings.auto_approve.min_notice_days) {
            canAutoApprove = false;
            suggestions.push(`Auto-approval requires ${approvalSettings.auto_approve.min_notice_days} days advance notice`);
        }
        
        // Check escalation triggers
        if (leaveDetails.days > approvalSettings.escalation.above_days) {
            canAutoApprove = false;
            violations.push(`Leave of ${leaveDetails.days} days exceeds auto-approve limit (${approvalSettings.escalation.above_days} days)`);
        }
        
        // Check low balance escalation
        if (approvalSettings.escalation.low_balance && remainingBalance - leaveDetails.days < 2) {
            canAutoApprove = false;
            suggestions.push("Low remaining balance - escalated to HR for review");
        }
        
        // Check consecutive leave escalation
        if (approvalSettings.escalation.consecutive_leaves) {
            // Look for approved leaves in the past 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentLeaves = await prisma.leaveRequest.count({
                where: {
                    emp_id: employee.emp_id,
                    status: 'approved',
                    end_date: {
                        gte: thirtyDaysAgo
                    }
                }
            });
            
            // Also check if requested leave starts within 7 days of a previous leave ending
            const leaveEndingNearStart = await prisma.leaveRequest.findFirst({
                where: {
                    emp_id: employee.emp_id,
                    status: 'approved',
                    end_date: {
                        gte: new Date(new Date(leaveDetails.startDate).getTime() - 7 * 24 * 60 * 60 * 1000),
                        lt: new Date(leaveDetails.startDate)
                    }
                }
            });
            
            if (recentLeaves >= 2 || leaveEndingNearStart) {
                canAutoApprove = false;
                const reason = leaveEndingNearStart 
                    ? "New leave request starts within 7 days of your previous leave ending"
                    : `You have had ${recentLeaves} approved leaves in the past 30 days`;
                suggestions.push(`Consecutive leave detected: ${reason} - escalated to HR`);
            }
        }
        
        // Check blackout dates from ConstraintPolicy
        if (approvalSettings.blackout.dates?.length > 0) {
            const startDate = new Date(leaveDetails.startDate);
            const endDate = new Date(leaveDetails.endDate);
            
            for (const blackoutDate of approvalSettings.blackout.dates) {
                const blackout = new Date(blackoutDate);
                if (blackout >= startDate && blackout <= endDate) {
                    canAutoApprove = false;
                    violations.push(`${blackout.toLocaleDateString()} is a blackout date - no leave allowed`);
                }
            }
        }
        
        // Check blackout days of week
        if (approvalSettings.blackout.days_of_week?.length > 0) {
            const startDay = new Date(leaveDetails.startDate).getDay();
            const blockedDay = startDay === 0 ? 7 : startDay; // Convert Sunday from 0 to 7
            
            if (approvalSettings.blackout.days_of_week.includes(blockedDay)) {
                canAutoApprove = false;
                const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                violations.push(`${dayNames[blockedDay]} is a restricted day for leave`);
            }
        }
        
        // Check team coverage from ConstraintPolicy
        if (teamState.alreadyOnLeave >= approvalSettings.team_coverage.max_concurrent) {
            canAutoApprove = false;
            violations.push(`Team leave limit reached: ${teamState.alreadyOnLeave} already on leave (max: ${approvalSettings.team_coverage.max_concurrent})`);
        }
        
        if (teamState.teamSize - teamState.alreadyOnLeave - 1 < approvalSettings.team_coverage.min_coverage) {
            canAutoApprove = false;
            violations.push(`Insufficient team coverage: minimum ${approvalSettings.team_coverage.min_coverage} members required`);
        }

        // 12. Construct Payload with COMPANY-SPECIFIC data
        const payload = {
            text: leaveDetails.reason,
            employee_id: employee.emp_id,
            org_id: employee.org_id,
            company_name: employee.company.name,
            extracted_info: {
                type: leaveDetails.type,
                dates: [leaveDetails.startDate],
                duration: leaveDetails.days,
                is_half_day: leaveDetails.isHalfDay || false
            },
            team_state: {
                team: {
                    teamSize: teamState.teamSize,
                    alreadyOnLeave: teamState.alreadyOnLeave,
                    min_coverage: legacyRules.min_coverage || 3,
                    max_concurrent_leave: legacyRules.max_concurrent || 5
                },
                blackoutDates: legacyRules.blackoutDates || []
            },
            leave_balance: {
                remaining: remainingBalance,
                total: totalEntitlement,
                used: usedDays
            },
            leave_type_config: leaveTypeConfig,
            company_settings: {
                work_start: company?.work_start_time || "09:00",
                work_end: company?.work_end_time || "18:00",
                half_day_hours: Number(company?.half_day_hours) || 4,
                full_day_hours: Number(company?.full_day_hours) || 8,
                work_days: company?.work_days || [1,2,3,4,5],
            },
            pre_violations: violations,
            pre_suggestions: suggestions,
            is_half_day: leaveDetails.isHalfDay || false
        };

        // 11. Call Python Constraint Engine
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
            
            // Merge pre-evaluated violations
            if (violations.length > 0) {
                analysis.violations = [...violations, ...(analysis.violations || [])];
                analysis.suggestions = [...suggestions, ...(analysis.suggestions || [])];
                if (ruleResults.blocking || !canAutoApprove) {
                    analysis.approved = false;
                }
            }
            
            // Ensure response has explanation
            if (!analysis.explanation) {
                analysis.explanation = analysis.approved 
                    ? `✅ All constraints satisfied for ${employee.company.name}. Your ${leaveTypeConfig.name} request for ${leaveDetails.days} days has been auto-approved.`
                    : `⚠️ Request escalated to HR at ${employee.company.name}. ${analysis.violations?.length || 0} constraint(s) require manual review.`;
            }
            
        } catch (agentError) {
            console.error("AI Agent Unreachable:", agentError);
            
            // Graceful Fallback - Use local evaluation results with proper canAutoApprove check
            const localCanApprove = canAutoApprove && 
                                   violations.length === 0 && 
                                   remainingBalance >= leaveDetails.days &&
                                   !ruleResults.blocking;
            
            return {
                fallback: true,
                success: true,
                companyName: employee.company.name,
                leaveTypeConfig,
                analysis: {
                    approved: localCanApprove,
                    message: localCanApprove 
                        ? `Request validated for ${employee.company.name} (AI engine unavailable)`
                        : "Escalated for manual review",
                    violations: violations,
                    suggestions: suggestions,
                    confidence: localCanApprove ? 0.75 : 0.5,
                    explanation: `⚠️ AI Constraint Engine temporarily unavailable. ${
                        localCanApprove 
                            ? `Basic validation passed for ${employee.company.name} - request auto-approved.` 
                            : `Manual review required: ${violations.join('; ') || 'Safety escalation'}`
                    }`,
                    decision_reason: localCanApprove 
                        ? `Local validation passed all ${employee.company.name} policy checks`
                        : `Escalated: ${violations[0] || 'AI engine offline, safety escalation'}`
                }
            };
        }

        return { 
            success: true, 
            analysis,
            companyName: employee.company.name,
            leaveTypeConfig,
        };

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
