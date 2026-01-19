"use server";

import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendWelcomeEmail } from "@/lib/email-service";

/* =========================================================================
   1. IDENTITY SYNC
   Ensures the Clerk User exists in our "Employee" table.
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
                email: email, // ensure email is current
                // We don't overwrite name incase they changed it locally, unless you want to.
            },
            create: {
                emp_id: `EMP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`, // Temp ID, real one logic can be added
                clerk_id: user.id,
                email: email,
                full_name: name,
                is_active: true,
            },
            include: {
                company: true,
            },
        });

        return { success: true, employee };
    } catch (error) {
        console.error("Sync User Error:", error);
        return { success: false, error: "Failed to sync identity.", employee: null };
    }
}

/* =========================================================================
   2. LEGAL GATE & COMMITMENT
   Updates the Employee record to mark Terms & Conditions as accepted.
   ========================================================================= */
export async function acceptTerms() {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: { terms_accepted_at: new Date() },
        });
        revalidatePath("/onboarding");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to accept terms." };
    }
}

/* =========================================================================
   3. COMPANY REGISTRATION (HR)
   Creates a new Company, generates a code, and links the current user as Admin.
   ========================================================================= */
export async function registerCompany(companyName: string, industry: string, size?: string, location?: string, website?: string) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    // Generate 8-char random code
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
                admin_id: user.id, // Store clerk_id as admin reference for now
                legal_agreed_at: new Date(),
            },
        });

        // 2. Link Employee to this Company (Admin role)
        // Also upgrade their Job Level to 'Executive' or 'Admin' ideally, 
        // but for now we just link the Org ID.
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: {
                org_id: newCompany.id,
                position: "HR Admin", // Auto-assign a title
                level_code: "L5", // Assuming L5 is high
            },
        });

        // 3. Seed Default Policies (Phase 2 Prep)
        // We can trigger this async or do it here. 
        // Let's do a basic seed.
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
   4. JOIN COMPANY (EMPLOYEE)
   Links an employee to an existing company via code.
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

        // Get current employee details for welcome email
        const employee = await prisma.employee.update({
            where: { clerk_id: user.id },
            data: {
                org_id: company.id,
            },
        });

        // Send welcome email to new employee
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

        revalidatePath("/");
        return { success: true, company };
    } catch (error) {
        return { success: false, error: "Failed to join company." };
    }
}
/* =========================================================================
   5. UPDATE DETAILS (EMPLOYEE SETUP)
   Updates profile info before joining.
   ========================================================================= */
export async function updateEmployeeDetails(details: { department?: string; position?: string; location?: string }) {
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        await prisma.employee.update({
            where: { clerk_id: user.id },
            data: {
                department: details.department,
                position: details.position,
                work_location: details.location
            }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update details." };
    }
}
