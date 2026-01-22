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

        // Get employee's country code
        const targetEmployee = await prisma.employee.findUnique({
            where: { emp_id: employeeId },
            select: { country_code: true }
        });

        if (!balance) {
            // Create new balance if doesn't exist
            await prisma.leaveBalance.create({
                data: {
                    emp_id: employeeId,
                    leave_type: leaveType,
                    country_code: targetEmployee?.country_code || "IN",
                    year: currentYear,
                    annual_entitlement: Math.max(0, adjustment),
                    used_days: 0,
                    pending_days: 0
                }
            });
        } else {
            // Update existing balance
            const newEntitlement = Number(balance.annual_entitlement) + adjustment;
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
