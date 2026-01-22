"use server";

import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendWelcomeEmail, sendRegistrationApprovalEmail, sendRegistrationRejectionEmail, sendHRNewRegistrationEmail } from "@/lib/email-service";
import { logAudit, AuditAction } from "@/lib/audit";

// Types for onboarding data
interface OnboardingData {
    department?: string;
    position?: string;
    location?: string;
    companyCode?: string;
    companyName?: string;
    industry?: string;
    size?: string;
    website?: string;
}

/* =========================================================================
   1. IDENTITY SYNC - Enhanced with onboarding state restoration
   Ensures the Clerk User exists in our "Employee" table and restores any 
   partial onboarding data.
   ========================================================================= */
export async function syncUser() {
    const user = await currentUser();
    if (!user) return null;

    try {
        const email = user.emailAddresses[0]?.emailAddress;
        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";

        const employee = await prisma.employee.upsert({
            where: { clerk_id: user.id },
            update: {
                email: email,
            },
            create: {
                emp_id: `EMP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                clerk_id: user.id,
                email: email,
                full_name: name,
                is_active: true,
                onboarding_status: "in_progress",
                onboarding_step: "legal",
            },
            include: {
                company: true,
            },
        });

        return { 
            success: true, 
            employee,
            // Return saved onboarding data for form restoration
            onboardingData: employee.onboarding_data as OnboardingData | null,
            onboardingStep: employee.onboarding_step,
        };
    } catch (error) {
        console.error("Sync User Error:", error);
        return { success: false, error: "Failed to sync identity.", employee: null };
    }
}

/* =========================================================================
   2. SAVE ONBOARDING PROGRESS
   Saves partial form data at each step so user can resume later.
   ========================================================================= */
export async function saveOnboardingProgress(
    step: string,
    data: OnboardingData
) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        // Get existing onboarding data and merge with new data
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { onboarding_data: true }
        });

        const existingData = (employee?.onboarding_data as OnboardingData) || {};
        const mergedData = { ...existingData, ...data };

        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: {
                onboarding_step: step,
                onboarding_data: mergedData,
                onboarding_status: "in_progress",
            },
        });

        revalidatePath("/onboarding");
        return { success: true, savedData: mergedData };
    } catch (error) {
        console.error("Save Progress Error:", error);
        return { success: false, error: "Failed to save progress." };
    }
}

/* =========================================================================
   3. LEGAL GATE & COMMITMENT - Enhanced
   Updates the Employee record to mark Terms & Conditions as accepted.
   ========================================================================= */
export async function acceptTerms() {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: { 
                terms_accepted_at: new Date(),
                onboarding_step: "choice", // Move to next step
            },
        });
        revalidatePath("/onboarding");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to accept terms." };
    }
}

/* =========================================================================
   4. COMPANY REGISTRATION (HR) - Enhanced with complete onboarding
   Creates a new Company, generates a code, and links the current user as Admin.
   HR registration is auto-approved since they are creating the company.
   ========================================================================= */
export async function registerCompany(companyName: string, industry: string, size?: string, location?: string, website?: string) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    try {
        // 1. Create Company
        const newCompany = await prisma.company.create({
            data: {
                name: companyName,
                code: code,
                industry: industry,
                size: size,
                location: location,
                website: website,
                admin_id: user.id,
                legal_agreed_at: new Date(),
            },
        });

        // 2. Link Employee to this Company (Admin role) - Auto-approved for HR
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: {
                org_id: newCompany.id,
                position: "HR Admin",
                level_code: "L5",
                role: "hr",
                // HR is auto-approved and completes onboarding
                onboarding_status: "completed",
                onboarding_step: "complete",
                approval_status: "approved",
                approved_at: new Date(),
                onboarding_completed: true,
                onboarding_data: { companyName, industry, size, location, website },
            },
        });

        // 3. Seed Default Policies
        const defaultRules = {
            noticePeriod: 14,
            maxConsecutive: 10,
            blackoutDates: [],
        };

        await prisma.constraintPolicy.create({
            data: {
                org_id: newCompany.id,
                name: "Default Enterprise Policy",
                rules: defaultRules,
                is_active: true,
            }
        });

        revalidatePath("/");
        return { success: true, company: newCompany };
    } catch (error) {
        console.error("Register Company Error:", error);
        return { success: false, error: "Failed to create company." };
    }
}

/* =========================================================================
   5. JOIN COMPANY (EMPLOYEE) - Enhanced with pending approval
   Links an employee to an existing company via code.
   Employee must wait for HR approval before accessing features.
   ========================================================================= */
export async function joinCompany(code: string) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        const company = await prisma.company.findUnique({
            where: { code: code },
        });

        if (!company) {
            return { success: false, error: "Invalid Company Code" };
        }

        // Get current onboarding data before updating
        const currentEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { onboarding_data: true }
        });

        // Link employee but set to pending approval
        const employee = await prisma.employee.update({
            where: { clerk_id: user.id },
            data: {
                org_id: company.id,
                // Employee needs HR approval
                onboarding_status: "pending_approval",
                onboarding_step: "pending_approval",
                approval_status: "pending",
                onboarding_completed: false,
                onboarding_data: {
                    ...(currentEmployee?.onboarding_data as object || {}),
                    companyCode: code,
                    joinedAt: new Date().toISOString(),
                },
            },
        });

        // Log audit event for employee registration request
        await logAudit({
            actorId: employee.emp_id,
            actorType: 'user',
            action: AuditAction.EMPLOYEE_REGISTERED,
            entityType: 'Employee',
            entityId: employee.emp_id,
            details: {
                employeeName: employee.full_name,
                employeeEmail: employee.email,
                companyId: company.id,
                companyName: company.name,
                companyCode: code
            },
            orgId: company.id
        });

        // Notify HR about new registration
        const hrUsers = await prisma.employee.findMany({
            where: {
                org_id: company.id,
                role: 'hr',
                is_active: true
            },
            select: { email: true }
        });

        // Send email to all HR users
        for (const hr of hrUsers) {
            sendHRNewRegistrationEmail(hr.email, {
                employeeName: employee.full_name || 'New Employee',
                employeeEmail: employee.email,
                position: employee.position || undefined,
                department: employee.department || undefined,
                registeredAt: new Date().toLocaleString()
            }).catch(err => console.error('HR notification email failed:', err));
        }

        revalidatePath("/");
        return { success: true, company, needsApproval: true };
    } catch (error) {
        return { success: false, error: "Failed to join company." };
    }
}

/* =========================================================================
   6. UPDATE DETAILS (EMPLOYEE SETUP) - Enhanced with auto-save
   Updates profile info before joining.
   ========================================================================= */
export async function updateEmployeeDetails(details: { department?: string; position?: string; location?: string }) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        // Get existing onboarding data
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { onboarding_data: true }
        });

        const existingData = (employee?.onboarding_data as OnboardingData) || {};

        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: {
                department: details.department,
                position: details.position,
                work_location: details.location,
                onboarding_step: "join",
                onboarding_data: { 
                    ...existingData, 
                    department: details.department,
                    position: details.position,
                    location: details.location,
                },
            }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update details." };
    }
}

/* =========================================================================
   7. HR APPROVAL ACTIONS
   ========================================================================= */

// Get registration stats for HR dashboard
export async function getRegistrationStats() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!hrEmployee || !["hr", "admin"].includes(hrEmployee.role || "")) {
            return { success: false, error: "Access denied" };
        }

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Count pending approvals
        const pendingCount = await prisma.employee.count({
            where: {
                org_id: hrEmployee.org_id,
                approval_status: "pending",
                onboarding_status: "pending_approval",
            }
        });

        // Count approved today
        const approvedTodayCount = await prisma.employee.count({
            where: {
                org_id: hrEmployee.org_id,
                approval_status: "approved",
                approved_at: {
                    gte: today,
                    lt: tomorrow
                }
            }
        });

        // Count rejected today
        const rejectedTodayCount = await prisma.employee.count({
            where: {
                org_id: hrEmployee.org_id,
                approval_status: "rejected",
                // We don't have rejected_at field, so we'll use audit log or skip this
            }
        });

        // Count total approved this month
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const approvedThisMonthCount = await prisma.employee.count({
            where: {
                org_id: hrEmployee.org_id,
                approval_status: "approved",
                approved_at: {
                    gte: startOfMonth
                }
            }
        });

        return { 
            success: true, 
            stats: {
                pending: pendingCount,
                approvedToday: approvedTodayCount,
                rejectedToday: rejectedTodayCount,
                approvedThisMonth: approvedThisMonthCount
            }
        };
    } catch (error) {
        console.error("Get Registration Stats Error:", error);
        return { success: false, error: "Failed to fetch registration stats." };
    }
}

// Get pending employee registrations for HR
export async function getPendingEmployeeApprovals() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!hrEmployee || !["hr", "admin"].includes(hrEmployee.role || "")) {
            return { success: false, error: "Access denied" };
        }

        const pendingEmployees = await prisma.employee.findMany({
            where: {
                org_id: hrEmployee.org_id,
                approval_status: "pending",
                onboarding_status: "pending_approval",
            },
            select: {
                emp_id: true,
                full_name: true,
                email: true,
                department: true,
                position: true,
                work_location: true,
                onboarding_data: true,
                terms_accepted_at: true,
            },
            orderBy: { terms_accepted_at: 'desc' }
        });

        return { success: true, employees: pendingEmployees };
    } catch (error) {
        console.error("Get Pending Approvals Error:", error);
        return { success: false, error: "Failed to fetch pending approvals." };
    }
}

// Approve an employee
export async function approveEmployee(empId: string) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true, emp_id: true, company: true }
        });

        if (!hrEmployee || !["hr", "admin"].includes(hrEmployee.role || "")) {
            return { success: false, error: "Access denied" };
        }

        const employee = await prisma.employee.update({
            where: { emp_id: empId },
            data: {
                approval_status: "approved",
                approved_by: hrEmployee.emp_id,
                approved_at: new Date(),
                onboarding_status: "approved",
                onboarding_step: "welcome",
                onboarding_completed: true,
            },
        });

        // Log audit event
        await logAudit({
            actorId: hrEmployee.emp_id,
            actorType: 'user',
            action: AuditAction.EMPLOYEE_APPROVED,
            entityType: 'Employee',
            entityId: empId,
            details: {
                employeeName: employee.full_name,
                employeeEmail: employee.email,
                approvedBy: hrEmployee.emp_id,
                companyId: hrEmployee.org_id
            },
            orgId: hrEmployee.org_id!
        });

        // Send welcome email
        const welcomeParams = {
            employeeName: employee.full_name || 'Team Member',
            email: employee.email,
            position: employee.position || 'Employee',
            department: employee.department || 'General',
            startDate: new Date().toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            }),
        };

        sendWelcomeEmail(employee.email, welcomeParams)
            .catch(err => console.error('Welcome email failed:', err));

        // Send registration approval email
        sendRegistrationApprovalEmail(employee.email, {
            employeeName: employee.full_name || 'Team Member',
            companyName: hrEmployee.company?.name || 'Our Company',
            position: employee.position || undefined,
            department: employee.department || undefined,
            approvedBy: hrEmployee.company?.name || 'HR Team'
        }).catch(err => console.error('Registration approval email failed:', err));

        revalidatePath("/hr");
        return { success: true, employee };
    } catch (error) {
        console.error("Approve Employee Error:", error);
        return { success: false, error: "Failed to approve employee." };
    }
}

// Reject an employee
export async function rejectEmployee(empId: string, reason: string) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true, emp_id: true }
        });

        if (!hrEmployee || !["hr", "admin"].includes(hrEmployee.role || "")) {
            return { success: false, error: "Access denied" };
        }

        const rejectedEmployee = await prisma.employee.update({
            where: { emp_id: empId },
            data: {
                approval_status: "rejected",
                rejection_reason: reason,
                onboarding_status: "not_started",
                org_id: null, // Remove from company
            },
        });

        // Log audit event
        await logAudit({
            actorId: hrEmployee.emp_id,
            actorType: 'user',
            action: AuditAction.EMPLOYEE_REJECTED,
            entityType: 'Employee',
            entityId: empId,
            details: {
                employeeName: rejectedEmployee.full_name,
                employeeEmail: rejectedEmployee.email,
                rejectedBy: hrEmployee.emp_id,
                reason: reason
            },
            orgId: hrEmployee.org_id!
        });

        // Send rejection email
        sendRegistrationRejectionEmail(rejectedEmployee.email, {
            employeeName: rejectedEmployee.full_name || 'Applicant',
            companyName: 'Our Company',
            rejectedBy: 'HR Team',
            reason: reason
        }).catch(err => console.error('Registration rejection email failed:', err));

        revalidatePath("/hr");
        return { success: true };
    } catch (error) {
        console.error("Reject Employee Error:", error);
        return { success: false, error: "Failed to reject employee." };
    }
}

/* =========================================================================
   8. WELCOME & TUTORIAL COMPLETION
   ========================================================================= */

// Mark welcome animation as shown
export async function markWelcomeShown() {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: { welcome_shown: true },
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update." };
    }
}

// Mark tutorial as completed
export async function markTutorialCompleted() {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: { 
                tutorial_completed: true,
                onboarding_status: "completed",
                onboarding_step: "complete",
            },
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update." };
    }
}

/* =========================================================================
   9. CHECK ACCESS STATUS
   Utility to check if employee can access features
   ========================================================================= */
export async function checkFeatureAccess() {
    const user = await currentUser();
    if (!user) return { hasAccess: false, reason: "not_authenticated" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: {
                approval_status: true,
                onboarding_status: true,
                onboarding_completed: true,
                role: true,
                org_id: true,
                welcome_shown: true,
                tutorial_completed: true,
            }
        });

        if (!employee) {
            return { hasAccess: false, reason: "no_profile" };
        }

        // HR/Admin always has access
        if (["hr", "admin"].includes(employee.role || "")) {
            return { 
                hasAccess: true, 
                role: employee.role,
                showWelcome: !employee.welcome_shown,
                showTutorial: !employee.tutorial_completed,
            };
        }

        // Employee needs approval
        if (employee.approval_status !== "approved") {
            return { 
                hasAccess: false, 
                reason: "pending_approval",
                status: employee.approval_status,
            };
        }

        return { 
            hasAccess: true,
            role: employee.role,
            showWelcome: !employee.welcome_shown,
            showTutorial: !employee.tutorial_completed,
        };
    } catch (error) {
        return { hasAccess: false, reason: "error" };
    }
}
