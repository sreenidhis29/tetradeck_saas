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
    if (!user) {
        console.error("[syncUser] No authenticated user found");
        return { success: false, error: "Not authenticated. Please sign in.", employee: null };
    }

    try {
        const email = user.emailAddresses[0]?.emailAddress;
        if (!email) {
            console.error("[syncUser] User has no email address");
            return { success: false, error: "No email address found on your account.", employee: null };
        }

        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";

        // First, check if an employee with this clerk_id exists
        let employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (employee) {
            // Update existing employee
            employee = await prisma.employee.update({
                where: { clerk_id: user.id },
                data: { email: email },
                include: { company: true }
            });
        } else {
            // Check if email already exists (different clerk account)
            const existingByEmail = await prisma.employee.findUnique({
                where: { email: email }
            });

            if (existingByEmail) {
                // Link this clerk_id to the existing employee record
                employee = await prisma.employee.update({
                    where: { email: email },
                    data: { clerk_id: user.id },
                    include: { company: true }
                });
            } else {
                // Create new employee
                employee = await prisma.employee.create({
                    data: {
                        emp_id: `EMP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                        clerk_id: user.id,
                        email: email,
                        full_name: name,
                        is_active: true,
                        onboarding_status: "in_progress",
                        onboarding_step: "legal",
                    },
                    include: { company: true }
                });
            }
        }

        return { 
            success: true, 
            employee,
            // Return saved onboarding data for form restoration
            onboardingData: employee.onboarding_data as OnboardingData | null,
            onboardingStep: employee.onboarding_step,
        };
    } catch (error: any) {
        console.error("[syncUser] Database error:", error?.message || error);
        console.error("[syncUser] Full error:", JSON.stringify(error, null, 2));
        
        // Provide more specific error messages
        if (error?.code === 'P2002') {
            const field = error?.meta?.target?.[0] || 'unknown';
            return { success: false, error: `A duplicate ${field} exists. Please try signing out and in again.`, employee: null };
        }
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection issue. Please try again in a moment.", employee: null };
        }
        if (error?.code === 'P2025') {
            return { success: false, error: "Record not found. Please refresh the page.", employee: null };
        }
        
        return { success: false, error: `Failed to load your profile: ${error?.message || 'Unknown error'}`, employee: null };
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
    } catch (error: any) {
        console.error("[saveOnboardingProgress] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        if (error?.code === 'P2025') {
            return { success: false, error: "Employee profile not found. Please sign out and sign in again." };
        }
        return { success: false, error: `Failed to save progress: ${error?.message || 'Unknown error'}` };
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
    } catch (error: any) {
        console.error("[acceptTerms] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to accept terms: ${error?.message || 'Unknown error'}` };
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
        // Use a transaction to ensure atomic operation
        const result = await prisma.$transaction(async (tx) => {
            // 1. Check employee exists first
            const existingEmployee = await tx.employee.findUnique({
                where: { clerk_id: user.id },
            });

            if (!existingEmployee) {
                throw new Error("Employee record not found. Please refresh and try again.");
            }

            // 2. Create Company
            const newCompany = await tx.company.create({
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

            // 3. Link Employee to this Company (Admin role) - Auto-approved for HR
            // NOTE: Don't mark onboarding_completed yet - HR still needs to configure company settings
            const updatedEmployee = await tx.employee.update({
                where: { clerk_id: user.id },
                data: {
                    org_id: newCompany.id,
                    position: "HR Admin",
                    level_code: "L5",
                    role: "hr",
                    // HR is auto-approved but needs to complete settings first
                    onboarding_status: "in_progress",
                    onboarding_step: "constraints",
                    approval_status: "approved",
                    approved_at: new Date(),
                    onboarding_completed: false, // Will be set true after company settings
                    onboarding_data: { companyName, industry, size, location, website },
                },
            });

            // 4. Seed Default Policies
            const defaultRules = {
                noticePeriod: 14,
                maxConsecutive: 10,
                blackoutDates: [],
            };

            await tx.constraintPolicy.create({
                data: {
                    org_id: newCompany.id,
                    name: "Default Enterprise Policy",
                    rules: defaultRules,
                    is_active: true,
                }
            });

            return { company: newCompany, employee: updatedEmployee };
        });

        console.log("[registerCompany] Success - Company:", result.company.id, "Employee:", result.employee.emp_id);
        revalidatePath("/");
        return { success: true, company: result.company, companyId: result.company.id };
    } catch (error) {
        console.error("[registerCompany] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to create company.";
        return { success: false, error: errorMessage };
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

        // Use transaction to ensure atomicity of employee update + audit log
        const employee = await prisma.$transaction(async (tx) => {
            // Get current onboarding data before updating
            const currentEmployee = await tx.employee.findUnique({
                where: { clerk_id: user.id },
                select: { onboarding_data: true }
            });

            // Link employee but set to pending approval
            const updatedEmployee = await tx.employee.update({
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

            // Create audit log within same transaction
            await tx.auditLog.create({
                data: {
                    actor_id: updatedEmployee.emp_id,
                    action: AuditAction.EMPLOYEE_REGISTERED,
                    entity_type: 'Employee',
                    entity_id: updatedEmployee.emp_id,
                    target_org: company.id,
                    details: {
                        actor_type: 'user',
                        employeeName: updatedEmployee.full_name,
                        employeeEmail: updatedEmployee.email,
                        companyId: company.id,
                        companyName: company.name,
                        companyCode: code
                    }
                }
            });

            return updatedEmployee;
        });

        // Notify HR about new registration (outside transaction - non-critical)
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
    } catch (error: any) {
        console.error("[joinCompany] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to join company: ${error?.message || 'Unknown error'}` };
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
    } catch (error: any) {
        console.error("[updateEmployeeDetails] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to update details: ${error?.message || 'Unknown error'}` };
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
    } catch (error: any) {
        console.error("[getRegistrationStats] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch registration stats: ${error?.message || 'Unknown error'}` };
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
    } catch (error: any) {
        console.error("[getPendingEmployeeApprovals] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch pending approvals: ${error?.message || 'Unknown error'}` };
    }
}

// Seed leave balances for a newly approved employee
async function seedLeaveBalancesForEmployee(empId: string, orgId: string) {
    try {
        // Get company's leave types
        const leaveTypes = await prisma.leaveType.findMany({
            where: { company_id: orgId }
        });

        if (leaveTypes.length === 0) {
            console.log(`[seedLeaveBalances] No leave types found for org ${orgId}, skipping`);
            return;
        }

        // Get employee's country code
        const employee = await prisma.employee.findUnique({
            where: { emp_id: empId },
            select: { country_code: true }
        });

        const currentYear = new Date().getFullYear();
        const countryCode = employee?.country_code || 'IN'; // Default to India

        // Create leave balance for each leave type
        for (const lt of leaveTypes) {
            // Check if balance already exists
            const existing = await prisma.leaveBalance.findFirst({
                where: {
                    emp_id: empId,
                    leave_type: lt.code,
                    year: currentYear
                }
            });

            if (!existing) {
                await prisma.leaveBalance.create({
                    data: {
                        emp_id: empId,
                        country_code: countryCode,
                        leave_type: lt.code,
                        year: currentYear,
                        annual_entitlement: lt.annual_quota,
                        used_days: 0,
                        pending_days: 0,
                        carried_forward: 0,
                    }
                });
            }
        }

        console.log(`[seedLeaveBalances] Created ${leaveTypes.length} leave balances for employee ${empId}`);
    } catch (error) {
        console.error(`[seedLeaveBalances] Error:`, error);
        // Don't throw - this is non-critical
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
                onboarding_status: "completed",
                onboarding_step: "complete",
                onboarding_completed: true,
            },
        });

        // CRITICAL: Seed leave balances for the approved employee
        if (hrEmployee.org_id) {
            await seedLeaveBalancesForEmployee(empId, hrEmployee.org_id);
        }

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
    } catch (error: any) {
        console.error("[approveEmployee] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        if (error?.code === 'P2025') {
            return { success: false, error: "Employee not found." };
        }
        return { success: false, error: `Failed to approve employee: ${error?.message || 'Unknown error'}` };
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
    } catch (error: any) {
        console.error("[rejectEmployee] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        if (error?.code === 'P2025') {
            return { success: false, error: "Employee not found." };
        }
        return { success: false, error: `Failed to reject employee: ${error?.message || 'Unknown error'}` };
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
    } catch (error: any) {
        console.error("[markWelcomeShown] Database error:", error?.message || error);
        return { success: false, error: `Failed to update: ${error?.message || 'Unknown error'}` };
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
    } catch (error: any) {
        console.error("[markTutorialCompleted] Database error:", error?.message || error);
        return { success: false, error: `Failed to update: ${error?.message || 'Unknown error'}` };
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
                terms_accepted_at: true,
            }
        });

        if (!employee) {
            return { hasAccess: false, reason: "no_profile" };
        }

        // HR/Admin - but MUST have org_id (completed company registration)
        if (["hr", "admin"].includes(employee.role || "")) {
            // HR without company registration must complete onboarding
            if (!employee.org_id) {
                return { 
                    hasAccess: false, 
                    reason: "incomplete_onboarding",
                    message: "Please complete company registration first."
                };
            }
            return { 
                hasAccess: true, 
                role: employee.role,
                showWelcome: !employee.welcome_shown,
                showTutorial: !employee.tutorial_completed,
            };
        }

        // Employee - MUST have org_id (joined a company)
        if (!employee.org_id) {
            return { 
                hasAccess: false, 
                reason: "no_company",
                message: "Please join a company using your company code."
            };
        }

        // Employee needs HR approval to access features
        if (employee.approval_status !== "approved") {
            return { 
                hasAccess: false, 
                reason: "pending_approval",
                status: employee.approval_status,
                message: "Your account is awaiting HR approval."
            };
        }

        // Must have completed onboarding
        if (!employee.onboarding_completed && employee.onboarding_status !== "completed" && employee.onboarding_status !== "approved") {
            return { 
                hasAccess: false, 
                reason: "incomplete_onboarding",
                message: "Please complete the onboarding process."
            };
        }

        return { 
            hasAccess: true,
            role: employee.role,
            showWelcome: !employee.welcome_shown,
            showTutorial: !employee.tutorial_completed,
        };
    } catch (error: any) {
        console.error("[checkFeatureAccess] Database error:", error?.message || error);
        return { hasAccess: false, reason: "database_error", error: error?.message };
    }
}
