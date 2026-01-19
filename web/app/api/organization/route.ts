import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { companyName, industry } = await req.json();

        // Generate unique company code (e.g., COMP-1234)
        // Simple 4 char suffix
        const suffix = nanoid(4).toUpperCase();
        const code = `${companyName.substring(0, 3).toUpperCase()}-${suffix}`;

        // Create Company
        const company = await prisma.company.create({
            data: {
                name: companyName,
                industry: industry,
                code: code,
                admin_id: userId,
            },
        });

        // Create/Update Employee record for the Admin
        // We assume the user exists in Clerk, but maybe not in Employee table yet?
        // Or we update existing. Let's assume we create/update.

        // Check if employee exists by clerk_id
        /* 
           Note: The current schema uses `emp_id` as primary key (String). 
           We might need to generate an emp_id if it doesn't exist.
        */

        return NextResponse.json({ company });
    } catch (error: any) {
        console.error("Create Org Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
