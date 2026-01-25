import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { checkRateLimit, rateLimitResponse } from "@/lib/security";

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 5 organization creations per hour per IP
        const rateLimit = await checkRateLimit(req, { windowMs: 3600000, maxRequests: 5 });
        if (!rateLimit.allowed) {
            return rateLimitResponse(rateLimit.resetTime);
        }

        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { companyName, industry } = await req.json();

        if (!companyName || typeof companyName !== 'string') {
            return NextResponse.json({ error: "Company name is required" }, { status: 400 });
        }

        // Get user details from Clerk
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unable to get user details" }, { status: 401 });
        }

        const email = user.emailAddresses[0]?.emailAddress;
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || email?.split('@')[0] || 'Admin';

        // Generate unique company code (e.g., COMP-1234)
        const suffix = nanoid(4).toUpperCase();
        const code = `${companyName.substring(0, 3).toUpperCase()}-${suffix}`;

        // Create Company and Admin Employee in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create the company
            const company = await tx.company.create({
                data: {
                    name: companyName,
                    industry: industry || null,
                    code: code,
                    admin_id: userId,
                },
            });

            // Check if employee record exists
            const existingEmployee = await tx.employee.findUnique({
                where: { clerk_id: userId }
            });

            let employee;
            if (existingEmployee) {
                // Update existing employee - link to company as admin
                employee = await tx.employee.update({
                    where: { clerk_id: userId },
                    data: {
                        org_id: company.id,
                        role: 'hr', // Company creator is HR/Admin
                        onboarding_status: 'completed',
                        approval_status: 'approved',
                        onboarding_completed: true,
                    }
                });
            } else {
                // Create new employee record for admin
                const emp_id = `ADM-${Date.now()}-${nanoid(4).toUpperCase()}`;
                
                employee = await tx.employee.create({
                    data: {
                        emp_id,
                        clerk_id: userId,
                        full_name: fullName,
                        email: email || '',
                        org_id: company.id,
                        role: 'hr', // Company creator is HR/Admin
                        position: 'Administrator',
                        department: 'Management',
                        onboarding_status: 'completed',
                        approval_status: 'approved',
                        onboarding_completed: true,
                    }
                });
            }

            return { company, employee };
        });

        return NextResponse.json({ 
            success: true,
            company: result.company,
            message: "Organization created successfully"
        });
    } catch (error: any) {
        console.error("Create Org Error:", error);
        return NextResponse.json({ error: error.message || "Failed to create organization" }, { status: 500 });
    }
}
