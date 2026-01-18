import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Verify HR role
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            select: { role: true, org_id: true }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
        }

        if (employee.role !== 'hr' && employee.role !== 'admin') {
            return NextResponse.json({ success: false, error: "Unauthorized - HR access required" }, { status: 403 });
        }

        // Try to fetch payroll data from database
        let payrollRecords: any[] = [];

        try {
            // Check if Payroll table exists and fetch
            payrollRecords = await (prisma as any).payroll?.findMany?.({
                where: { org_id: employee.org_id },
                include: {
                    employee: {
                        select: { full_name: true, position: true }
                    }
                },
                orderBy: { created_at: 'desc' }
            }) || [];
        } catch (dbError) {
            // Payroll table doesn't exist yet - return empty array
            console.log("Payroll table not available:", dbError);
            payrollRecords = [];
        }

        // Format payroll data for response
        const formattedPayroll = payrollRecords.map((record: any) => ({
            emp_id: record.emp_id,
            full_name: record.employee?.full_name || 'Unknown',
            position: record.employee?.position || 'N/A',
            basic_salary: Number(record.basic_salary) || 0,
            allowances: Number(record.allowances) || 0,
            deductions: Number(record.deductions) || 0,
            net_pay: Number(record.net_pay) || 0,
            status: record.status || 'draft'
        }));

        return NextResponse.json({
            success: true,
            payroll: formattedPayroll
        });

    } catch (error) {
        console.error("[API] Payroll GET Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch payroll data" },
            { status: 500 }
        );
    }
}
