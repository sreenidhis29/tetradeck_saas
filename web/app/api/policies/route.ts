import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get employee's organization
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            select: { org_id: true, role: true }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
        }

        // Try to fetch policies from database
        let policies: any[] = [];

        try {
            // Check if Policy/ConstraintRule table exists
            policies = await (prisma as any).constraintPolicy?.findMany?.({
                where: { org_id: employee.org_id, is_active: true },
                orderBy: { category: 'asc' }
            }) || [];
        } catch (dbError) {
            // Policy table doesn't exist yet - return empty array
            console.log("Policy table not available:", dbError);
            policies = [];
        }

        // Format policies for response
        const formattedPolicies = policies.map((policy: any) => ({
            id: policy.id,
            name: policy.name,
            value: policy.value,
            description: policy.description,
            category: policy.category || 'general',
            is_editable: employee.role === 'hr' || employee.role === 'admin'
        }));

        return NextResponse.json({
            success: true,
            policies: formattedPolicies
        });

    } catch (error) {
        console.error("[API] Policies GET Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch policies" },
            { status: 500 }
        );
    }
}
