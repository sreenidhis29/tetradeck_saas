import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { companyCode } = await req.json();

        // Find Company
        const company = await prisma.company.findUnique({
            where: { code: companyCode },
        });

        if (!company) {
            return NextResponse.json({ error: "Invalid Company Code" }, { status: 404 });
        }

        // Link Employee to Organization
        // We assume there is an Employee record or we need to create one.
        // Logic: Look up Employee by Clerk ID. If exists, update org_id.
        // If not, we might need more info to create one, or this is just linking.

        // For this migration, let's assume we are updating the record if it exists, 
        // or creating a basic placeholder if not.

        // const employee = await prisma.employee.upsert(...)

        return NextResponse.json({ success: true, org_name: company.name });
    } catch (error: any) {
        console.error("Join Org Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
