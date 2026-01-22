import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction } from "@/lib/audit";

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

export async function PUT(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get employee and verify HR role
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            select: { emp_id: true, org_id: true, role: true, full_name: true }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
        }

        if (!["hr", "hr_manager", "admin"].includes(employee.role || "")) {
            return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
        }

        const { policyId, value } = await request.json();

        if (!policyId || value === undefined) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Get the current policy value for audit log
        let previousValue = null;
        try {
            const currentPolicy = await (prisma as any).constraintPolicy?.findUnique?.({
                where: { id: policyId }
            });
            previousValue = currentPolicy?.value;
        } catch (err) {
            // Ignore if table doesn't exist
        }

        // Update the policy
        try {
            await (prisma as any).constraintPolicy?.update?.({
                where: { id: policyId },
                data: { value, updated_at: new Date() }
            });
        } catch (updateErr) {
            console.error("Error updating policy:", updateErr);
            return NextResponse.json({ success: false, error: "Failed to update policy" }, { status: 500 });
        }

        // Log the policy update
        await logAudit({
            actorId: employee.emp_id,
            actorType: "user",
            action: AuditAction.POLICY_UPDATED,
            entityType: "Policy",
            entityId: policyId,
            details: {
                previousValue,
                newValue: value,
                updatedBy: employee.full_name
            },
            orgId: employee.org_id!
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("[API] Policies PUT Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update policy" },
            { status: 500 }
        );
    }
}
