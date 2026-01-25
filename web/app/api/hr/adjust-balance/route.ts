import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify HR role
        const hrEmployee = await prisma.employee.findFirst({
            where: { clerk_id: userId },
            select: { emp_id: true, org_id: true, role: true, full_name: true }
        });

        if (!hrEmployee || !["hr", "hr_manager", "admin"].includes(hrEmployee.role || "")) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const { employeeId, leaveType, adjustment, reason } = await request.json();

        if (!employeeId || !leaveType || adjustment === undefined || !reason) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Validate adjustment is a reasonable number
        const adjustmentNum = Number(adjustment);
        if (isNaN(adjustmentNum) || adjustmentNum < -365 || adjustmentNum > 365) {
            return NextResponse.json({ error: "Adjustment must be between -365 and 365 days" }, { status: 400 });
        }

        // Validate reason length
        if (typeof reason !== 'string' || reason.length < 5 || reason.length > 500) {
            return NextResponse.json({ error: "Reason must be between 5 and 500 characters" }, { status: 400 });
        }

        // SECURITY: Verify target employee belongs to same organization
        const targetEmployee = await prisma.employee.findUnique({
            where: { emp_id: employeeId },
            select: { org_id: true, country_code: true }
        });

        if (!targetEmployee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        if (targetEmployee.org_id !== hrEmployee.org_id) {
            return NextResponse.json({ error: "Cannot modify balance for employee in different organization" }, { status: 403 });
        }

        // Get current balance
        // Get current year
        const currentYear = new Date().getFullYear();

        const balance = await prisma.leaveBalance.findFirst({
            where: {
                emp_id: employeeId,
                leave_type: leaveType,
                year: currentYear
            }
        });

        if (!balance) {
            // Create new balance if doesn't exist
            await prisma.leaveBalance.create({
                data: {
                    emp_id: employeeId,
                    leave_type: leaveType,
                    country_code: targetEmployee?.country_code || "IN",
                    year: currentYear,
                    annual_entitlement: Math.max(0, adjustmentNum),
                    used_days: 0,
                    pending_days: 0
                }
            });
        } else {
            // Update existing balance
            const newEntitlement = Number(balance.annual_entitlement) + adjustmentNum;
            await prisma.leaveBalance.update({
                where: { balance_id: balance.balance_id },
                data: {
                    annual_entitlement: Math.max(0, newEntitlement)
                }
            });
        }

        // Log the adjustment
        await logAudit({
            actorId: hrEmployee.emp_id,
            actorType: "user",
            action: AuditAction.LEAVE_BALANCE_ADJUSTED,
            entityType: "LeaveBalance",
            entityId: employeeId,
            details: {
                leaveType,
                adjustment,
                reason,
                adjustedBy: hrEmployee.full_name,
                previousEntitlement: balance ? Number(balance.annual_entitlement) : 0,
                newEntitlement: balance ? Number(balance.annual_entitlement) + adjustment : adjustment
            },
            orgId: hrEmployee.org_id!
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error adjusting balance:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
