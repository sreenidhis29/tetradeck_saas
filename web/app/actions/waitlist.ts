"use server";

import { prisma } from "@/lib/prisma";

export async function joinWaitlist(email: string, companyName?: string, employeeCount?: string) {
    try {
        // Check if email already exists
        const existing = await prisma.waitlist.findUnique({
            where: { email }
        });

        if (existing) {
            return { success: true, message: "You're already on the waitlist!" };
        }

        // Add to waitlist
        await prisma.waitlist.create({
            data: {
                email,
                company_name: companyName,
                employee_count: employeeCount,
                source: "website"
            }
        });

        // TODO: Send confirmation email
        // await sendWaitlistConfirmationEmail(email);

        return { success: true, message: "Welcome to the waitlist!" };
    } catch (error: any) {
        console.error("[joinWaitlist] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Connection issue. Please try again." };
        }
        return { success: false, error: "Something went wrong. Please try again." };
    }
}

export async function getWaitlistCount() {
    try {
        const count = await prisma.waitlist.count();
        return { success: true, count };
    } catch (error: any) {
        console.error("[getWaitlistCount] Error:", error?.message || error);
        return { success: true, count: 0 }; // Fallback
    }
}
