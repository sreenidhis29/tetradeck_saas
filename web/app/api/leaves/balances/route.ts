import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Default leave allocations for new employees
const DEFAULT_LEAVE_ALLOCATIONS: Record<string, number> = {
    "Sick Leave": 12,
    "Vacation Leave": 20,
    "Casual Leave": 7,
    "Maternity Leave": 180,
    "Paternity Leave": 15,
    "Bereavement Leave": 5,
    "Comp Off": 10,
};

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get employee
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            select: { emp_id: true, country_code: true }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee profile not found" }, { status: 404 });
        }

        const currentYear = new Date().getFullYear();

        // Fetch real leave balances from database using correct schema fields
        let balances = await prisma.leaveBalance.findMany({
            where: { 
                emp_id: employee.emp_id,
                year: currentYear
            },
            select: {
                leave_type: true,
                annual_entitlement: true,
                used_days: true,
                carried_forward: true,
                pending_days: true,
            }
        });

        // If no balances exist, create default ones
        if (balances.length === 0) {
            console.log("[API] Creating default leave balances for employee:", employee.emp_id);
            
            const leaveTypes = Object.entries(DEFAULT_LEAVE_ALLOCATIONS);
            
            for (const [leaveType, allocation] of leaveTypes) {
                await prisma.leaveBalance.create({
                    data: {
                        emp_id: employee.emp_id,
                        country_code: employee.country_code || "IN",
                        leave_type: leaveType,
                        year: currentYear,
                        annual_entitlement: allocation,
                        carried_forward: 0,
                        used_days: 0,
                        pending_days: 0,
                    }
                });
            }
            
            // Re-fetch after creation
            balances = await prisma.leaveBalance.findMany({
                where: { 
                    emp_id: employee.emp_id,
                    year: currentYear
                },
                select: {
                    leave_type: true,
                    annual_entitlement: true,
                    used_days: true,
                    carried_forward: true,
                    pending_days: true,
                }
            });
        }

        // Transform to UI format
        const formattedBalances = balances.map(b => {
            const total = Number(b.annual_entitlement) + Number(b.carried_forward);
            const used = Number(b.used_days) + Number(b.pending_days);
            return {
                type: b.leave_type,
                available: total - used,
                total: total
            };
        });

        return NextResponse.json({
            success: true,
            balances: formattedBalances
        });
    } catch (error) {
        console.error("[API] Leave Balance Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed to fetch leave balances" },
            { status: 500 }
        );
    }
}
