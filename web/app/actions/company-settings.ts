"use server";

import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// =========================================================================
// COMPANY SETTINGS ACTIONS
// For managing work schedules, leave types, and leave rules
// =========================================================================

export interface WorkScheduleSettings {
    work_start_time: string;      // "09:00"
    work_end_time: string;        // "18:00"
    grace_period_mins: number;
    half_day_hours: number;
    full_day_hours: number;
    work_days: number[];          // [1,2,3,4,5] for Mon-Fri
    timezone: string;
}

export interface LeaveSettings {
    leave_year_start: string;     // "01-01" or "04-01" for fiscal year
    carry_forward_max: number;
    probation_leave: boolean;
    negative_balance: boolean;
}

export interface LeaveTypeInput {
    code: string;
    name: string;
    description?: string;
    color?: string;
    annual_quota: number;
    max_consecutive?: number;
    min_notice_days?: number;
    requires_document?: boolean;
    requires_approval?: boolean;
    half_day_allowed?: boolean;
    gender_specific?: 'M' | 'F' | 'O' | null;
    carry_forward?: boolean;
    max_carry_forward?: number;
    is_paid?: boolean;
}

export interface LeaveRuleInput {
    name: string;
    description?: string;
    rule_type: 'blackout' | 'max_concurrent' | 'min_gap' | 'department_limit' | 'custom';
    config: Record<string, any>;
    is_blocking?: boolean;
    priority?: number;
    applies_to_all?: boolean;
    departments?: string[];
}

// Default leave types for India
const DEFAULT_LEAVE_TYPES: LeaveTypeInput[] = [
    {
        code: "CL",
        name: "Casual Leave",
        description: "For personal matters and emergencies",
        color: "#6366f1",
        annual_quota: 12,
        max_consecutive: 3,
        min_notice_days: 1,
        half_day_allowed: true,
        carry_forward: false,
        is_paid: true,
    },
    {
        code: "SL",
        name: "Sick Leave",
        description: "For health-related absences",
        color: "#ef4444",
        annual_quota: 12,
        max_consecutive: 7,
        min_notice_days: 0,
        requires_document: true, // Medical certificate for > 2 days
        half_day_allowed: true,
        carry_forward: false,
        is_paid: true,
    },
    {
        code: "PL",
        name: "Privilege Leave",
        description: "Earned leave for vacations",
        color: "#10b981",
        annual_quota: 15,
        max_consecutive: 15,
        min_notice_days: 7,
        half_day_allowed: false,
        carry_forward: true,
        max_carry_forward: 30,
        is_paid: true,
    },
    {
        code: "ML",
        name: "Maternity Leave",
        description: "For expecting mothers",
        color: "#f472b6",
        annual_quota: 182, // 26 weeks as per Indian law
        max_consecutive: 182,
        min_notice_days: 30,
        requires_document: true,
        half_day_allowed: false,
        gender_specific: 'F',
        carry_forward: false,
        is_paid: true,
    },
    {
        code: "PTL",
        name: "Paternity Leave",
        description: "For new fathers",
        color: "#3b82f6",
        annual_quota: 15,
        max_consecutive: 15,
        min_notice_days: 7,
        requires_document: true,
        half_day_allowed: false,
        gender_specific: 'M',
        carry_forward: false,
        is_paid: true,
    },
    {
        code: "LWP",
        name: "Leave Without Pay",
        description: "Unpaid leave when quota exhausted",
        color: "#6b7280",
        annual_quota: 0, // Unlimited but unpaid
        max_consecutive: 30,
        min_notice_days: 7,
        half_day_allowed: true,
        carry_forward: false,
        is_paid: false,
    },
];

// Default leave rules
const DEFAULT_LEAVE_RULES: LeaveRuleInput[] = [
    {
        name: "Weekend Restriction",
        description: "Cannot apply leave for weekends unless sandwich rule applies",
        rule_type: "blackout",
        config: { days_of_week: [6, 7] }, // Sat, Sun
        is_blocking: false, // Warning only
    },
    {
        name: "Maximum Concurrent Leaves",
        description: "Maximum 10% of team can be on leave simultaneously",
        rule_type: "max_concurrent",
        config: { max_percentage: 10 },
        is_blocking: true,
    },
];

/* =========================================================================
   1. SAVE WORK SCHEDULE SETTINGS
   ========================================================================= */
export async function saveWorkSchedule(companyId: string, settings: WorkScheduleSettings) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        // Verify user is HR/Admin of this company
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.org_id !== companyId || employee.role !== 'hr') {
            return { success: false, error: "Not authorized to modify company settings" };
        }

        await prisma.company.update({
            where: { id: companyId },
            data: {
                work_start_time: settings.work_start_time,
                work_end_time: settings.work_end_time,
                grace_period_mins: settings.grace_period_mins,
                half_day_hours: settings.half_day_hours,
                full_day_hours: settings.full_day_hours,
                work_days: settings.work_days,
                timezone: settings.timezone,
            }
        });

        revalidatePath("/hr/settings");
        return { success: true };
    } catch (error: any) {
        console.error("[saveWorkSchedule] Error:", error);
        return { success: false, error: error.message || "Failed to save work schedule" };
    }
}

/* =========================================================================
   2. SAVE LEAVE SETTINGS
   ========================================================================= */
export async function saveLeaveSettings(companyId: string, settings: LeaveSettings) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.org_id !== companyId || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        await prisma.company.update({
            where: { id: companyId },
            data: {
                leave_year_start: settings.leave_year_start,
                carry_forward_max: settings.carry_forward_max,
                probation_leave: settings.probation_leave,
                negative_balance: settings.negative_balance,
            }
        });

        revalidatePath("/hr/settings");
        return { success: true };
    } catch (error: any) {
        console.error("[saveLeaveSettings] Error:", error);
        return { success: false, error: error.message || "Failed to save leave settings" };
    }
}

/* =========================================================================
   3. CREATE/UPDATE LEAVE TYPES
   ========================================================================= */
export async function createLeaveType(companyId: string, leaveType: LeaveTypeInput) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.org_id !== companyId || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        // Check if code already exists
        const existing = await prisma.leaveType.findUnique({
            where: { company_id_code: { company_id: companyId, code: leaveType.code } }
        });

        if (existing) {
            return { success: false, error: `Leave type with code '${leaveType.code}' already exists` };
        }

        const newType = await prisma.leaveType.create({
            data: {
                company_id: companyId,
                code: leaveType.code.toUpperCase(),
                name: leaveType.name,
                description: leaveType.description,
                color: leaveType.color || "#6366f1",
                annual_quota: leaveType.annual_quota,
                max_consecutive: leaveType.max_consecutive || 5,
                min_notice_days: leaveType.min_notice_days || 1,
                requires_document: leaveType.requires_document || false,
                requires_approval: leaveType.requires_approval ?? true,
                half_day_allowed: leaveType.half_day_allowed ?? true,
                gender_specific: leaveType.gender_specific || null,
                carry_forward: leaveType.carry_forward || false,
                max_carry_forward: leaveType.max_carry_forward || 0,
                is_paid: leaveType.is_paid ?? true,
            }
        });

        revalidatePath("/hr/settings");
        return { success: true, leaveType: newType };
    } catch (error: any) {
        console.error("[createLeaveType] Error:", error);
        return { success: false, error: error.message || "Failed to create leave type" };
    }
}

export async function updateLeaveType(leaveTypeId: string, data: Partial<LeaveTypeInput>) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        // Verify leave type belongs to this company
        const existing = await prisma.leaveType.findUnique({
            where: { id: leaveTypeId }
        });

        if (!existing || existing.company_id !== employee.org_id) {
            return { success: false, error: "Leave type not found" };
        }

        const updated = await prisma.leaveType.update({
            where: { id: leaveTypeId },
            data: {
                name: data.name,
                description: data.description,
                color: data.color,
                annual_quota: data.annual_quota,
                max_consecutive: data.max_consecutive,
                min_notice_days: data.min_notice_days,
                requires_document: data.requires_document,
                requires_approval: data.requires_approval,
                half_day_allowed: data.half_day_allowed,
                carry_forward: data.carry_forward,
                max_carry_forward: data.max_carry_forward,
                is_paid: data.is_paid,
            }
        });

        revalidatePath("/hr/settings");
        return { success: true, leaveType: updated };
    } catch (error: any) {
        console.error("[updateLeaveType] Error:", error);
        return { success: false, error: error.message || "Failed to update leave type" };
    }
}

export async function deleteLeaveType(leaveTypeId: string) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        // Verify ownership
        const existing = await prisma.leaveType.findUnique({
            where: { id: leaveTypeId }
        });

        if (!existing || existing.company_id !== employee.org_id) {
            return { success: false, error: "Leave type not found" };
        }

        // Soft delete by marking inactive
        await prisma.leaveType.update({
            where: { id: leaveTypeId },
            data: { is_active: false }
        });

        revalidatePath("/hr/settings");
        return { success: true };
    } catch (error: any) {
        console.error("[deleteLeaveType] Error:", error);
        return { success: false, error: error.message || "Failed to delete leave type" };
    }
}

/* =========================================================================
   4. CREATE/UPDATE LEAVE RULES
   ========================================================================= */
export async function createLeaveRule(companyId: string, rule: LeaveRuleInput) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.org_id !== companyId || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        const newRule = await prisma.leaveRule.create({
            data: {
                company_id: companyId,
                name: rule.name,
                description: rule.description,
                rule_type: rule.rule_type,
                config: rule.config,
                is_blocking: rule.is_blocking ?? true,
                priority: rule.priority || 0,
                applies_to_all: rule.applies_to_all ?? true,
                departments: rule.departments,
            }
        });

        revalidatePath("/hr/settings");
        return { success: true, rule: newRule };
    } catch (error: any) {
        console.error("[createLeaveRule] Error:", error);
        return { success: false, error: error.message || "Failed to create leave rule" };
    }
}

export async function updateLeaveRule(ruleId: string, data: Partial<LeaveRuleInput>) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        const existing = await prisma.leaveRule.findUnique({
            where: { id: ruleId }
        });

        if (!existing || existing.company_id !== employee.org_id) {
            return { success: false, error: "Rule not found" };
        }

        const updated = await prisma.leaveRule.update({
            where: { id: ruleId },
            data: {
                name: data.name,
                description: data.description,
                rule_type: data.rule_type,
                config: data.config,
                is_blocking: data.is_blocking,
                priority: data.priority,
                applies_to_all: data.applies_to_all,
                departments: data.departments,
            }
        });

        revalidatePath("/hr/settings");
        return { success: true, rule: updated };
    } catch (error: any) {
        console.error("[updateLeaveRule] Error:", error);
        return { success: false, error: error.message || "Failed to update rule" };
    }
}

export async function deleteLeaveRule(ruleId: string) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!employee || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        const existing = await prisma.leaveRule.findUnique({
            where: { id: ruleId }
        });

        if (!existing || existing.company_id !== employee.org_id) {
            return { success: false, error: "Rule not found" };
        }

        await prisma.leaveRule.update({
            where: { id: ruleId },
            data: { is_active: false }
        });

        revalidatePath("/hr/settings");
        return { success: true };
    } catch (error: any) {
        console.error("[deleteLeaveRule] Error:", error);
        return { success: false, error: error.message || "Failed to delete rule" };
    }
}

/* =========================================================================
   5. GET COMPANY SETTINGS
   ========================================================================= */
export async function getCompanySettings(companyId: string) {
    try {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: {
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

        const leaveTypes = await prisma.leaveType.findMany({
            where: { company_id: companyId, is_active: true },
            orderBy: { sort_order: 'asc' }
        });

        const leaveRules = await prisma.leaveRule.findMany({
            where: { company_id: companyId, is_active: true },
            orderBy: { priority: 'desc' }
        });

        return {
            success: true,
            workSchedule: {
                work_start_time: company?.work_start_time || "09:00",
                work_end_time: company?.work_end_time || "18:00",
                grace_period_mins: company?.grace_period_mins || 15,
                half_day_hours: Number(company?.half_day_hours) || 4,
                full_day_hours: Number(company?.full_day_hours) || 8,
                work_days: (company?.work_days as number[]) || [1,2,3,4,5],
                timezone: company?.timezone || "Asia/Kolkata",
            },
            leaveSettings: {
                leave_year_start: company?.leave_year_start || "01-01",
                carry_forward_max: company?.carry_forward_max || 5,
                probation_leave: company?.probation_leave || false,
                negative_balance: company?.negative_balance || false,
            },
            leaveTypes,
            leaveRules,
        };
    } catch (error: any) {
        console.error("[getCompanySettings] Error:", error);
        return { success: false, error: error.message };
    }
}

/* =========================================================================
   6. SEED DEFAULT LEAVE TYPES (called during company creation)
   ========================================================================= */
export async function seedDefaultLeaveTypes(companyId: string) {
    try {
        const createPromises = DEFAULT_LEAVE_TYPES.map((lt, index) =>
            prisma.leaveType.create({
                data: {
                    company_id: companyId,
                    code: lt.code,
                    name: lt.name,
                    description: lt.description,
                    color: lt.color || "#6366f1",
                    annual_quota: lt.annual_quota,
                    max_consecutive: lt.max_consecutive || 5,
                    min_notice_days: lt.min_notice_days || 1,
                    requires_document: lt.requires_document || false,
                    half_day_allowed: lt.half_day_allowed ?? true,
                    gender_specific: lt.gender_specific || null,
                    carry_forward: lt.carry_forward || false,
                    max_carry_forward: lt.max_carry_forward || 0,
                    is_paid: lt.is_paid ?? true,
                    sort_order: index,
                }
            })
        );

        await Promise.all(createPromises);
        return { success: true };
    } catch (error: any) {
        console.error("[seedDefaultLeaveTypes] Error:", error);
        return { success: false, error: error.message };
    }
}

/* =========================================================================
   7. COMPLETE COMPANY ONBOARDING SETUP
   Called after HR finishes configuring all settings
   ========================================================================= */
export async function completeCompanySetup(companyId: string) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { emp_id: true, org_id: true, role: true }
        });

        if (!employee || employee.org_id !== companyId || employee.role !== 'hr') {
            return { success: false, error: "Not authorized" };
        }

        // Check if default leave types exist, seed if not
        const existingTypes = await prisma.leaveType.count({
            where: { company_id: companyId }
        });

        if (existingTypes === 0) {
            await seedDefaultLeaveTypes(companyId);
        }

        // Mark company setup as complete
        await prisma.company.update({
            where: { id: companyId },
            data: { onboarding_completed: true }
        });

        // Mark HR employee onboarding as complete
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: { 
                onboarding_completed: true,
                onboarding_status: 'completed',
                onboarding_step: 'complete'
            }
        });

        revalidatePath("/hr/dashboard");
        revalidatePath("/onboarding");
        return { success: true };
    } catch (error: any) {
        console.error("[completeCompanySetup] Error:", error);
        return { success: false, error: error.message || "Failed to complete setup" };
    }
}
