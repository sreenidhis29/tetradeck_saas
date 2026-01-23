"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// Types
interface PayrollCalculation {
    emp_id: string;
    full_name: string;
    position: string;
    department: string;
    
    // Attendance breakdown
    working_days: number;
    present_days: number;
    absent_days: number;
    half_days: number;
    late_days: number;
    
    // Leave breakdown
    paid_leave_days: number;
    unpaid_leave_days: number;
    
    // Salary calculation
    basic_salary: number;
    per_day_salary: number;
    
    // Allowances
    hra: number; // House Rent Allowance
    travel_allowance: number;
    medical_allowance: number;
    special_allowance: number;
    total_allowances: number;
    
    // Deductions
    lop_deduction: number; // Loss of Pay
    late_deduction: number;
    half_day_deduction: number;
    pf_deduction: number; // Provident Fund (12%)
    tax_deduction: number; // TDS
    other_deductions: number;
    total_deductions: number;
    
    // Final amounts
    gross_salary: number;
    net_pay: number;
    
    status: 'draft' | 'processed' | 'approved' | 'paid';
}

interface PayrollSummary {
    month: string;
    year: number;
    total_employees: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    status: 'draft' | 'processed' | 'approved' | 'paid';
    processed_at?: Date;
}

// Verify HR access
async function verifyHRAccess() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        select: { emp_id: true, role: true, org_id: true }
    });
    
    if (!employee || (employee.role !== 'hr' && employee.role !== 'admin')) {
        return { success: false, error: "HR access required" };
    }
    
    return { success: true, employee };
}

// Get working days in a month (excluding weekends)
function getWorkingDaysInMonth(year: number, month: number): number {
    const date = new Date(year, month - 1, 1);
    let workingDays = 0;
    
    while (date.getMonth() === month - 1) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
            workingDays++;
        }
        date.setDate(date.getDate() + 1);
    }
    
    return workingDays;
}

// Calculate payroll for all employees
export async function calculatePayroll(month: number, year: number) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee: hrEmployee } = authResult;
    
    try {
        // Get all active employees in the organization
        const employees = await prisma.employee.findMany({
            where: {
                org_id: hrEmployee!.org_id,
                is_active: true
            },
            include: {
                attendances: {
                    where: {
                        date: {
                            gte: new Date(year, month - 1, 1),
                            lt: new Date(year, month, 1)
                        }
                    }
                },
                leave_requests: {
                    where: {
                        status: 'approved',
                        start_date: {
                            lte: new Date(year, month, 0) // Last day of month
                        },
                        end_date: {
                            gte: new Date(year, month - 1, 1) // First day of month
                        }
                    }
                },
                leave_balances: {
                    where: { year }
                }
            }
        });
        
        const workingDays = getWorkingDaysInMonth(year, month);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        
        // Fetch public holidays for the month
        const holidays = await prisma.publicHoliday.findMany({
            where: {
                date: {
                    gte: monthStart,
                    lte: monthEnd
                }
            }
        }).catch(() => []);
        
        const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
        const effectiveWorkingDays = workingDays - holidayDates.size;
        
        const payrollRecords: PayrollCalculation[] = [];
        
        for (const emp of employees) {
            // Default salary if not set (will be configurable per employee later)
            const baseSalary = 50000; // Default ₹50,000 - should come from employee record
            const perDaySalary = baseSalary / workingDays;
            
            // Count attendance statuses
            let presentDays = 0;
            let absentDays = 0;
            let halfDays = 0;
            let lateDays = 0;
            
            for (const att of emp.attendances) {
                const dateStr = att.date.toISOString().split('T')[0];
                if (holidayDates.has(dateStr)) continue; // Skip holidays
                
                switch (att.status) {
                    case 'PRESENT':
                        presentDays++;
                        break;
                    case 'ABSENT':
                        absentDays++;
                        break;
                    case 'HALF_DAY':
                        halfDays++;
                        presentDays += 0.5;
                        break;
                    case 'LATE':
                        lateDays++;
                        presentDays++; // Late but present
                        break;
                }
            }
            
            // Calculate leave days within this month
            let paidLeaveDays = 0;
            let unpaidLeaveDays = 0;
            
            for (const leave of emp.leave_requests) {
                // Calculate overlap with this month
                const leaveStart = new Date(Math.max(leave.start_date.getTime(), monthStart.getTime()));
                const leaveEnd = new Date(Math.min(leave.end_date.getTime(), monthEnd.getTime()));
                
                let leaveDaysInMonth = 0;
                const date = new Date(leaveStart);
                while (date <= leaveEnd) {
                    const day = date.getDay();
                    const dateStr = date.toISOString().split('T')[0];
                    if (day !== 0 && day !== 6 && !holidayDates.has(dateStr)) {
                        leaveDaysInMonth++;
                    }
                    date.setDate(date.getDate() + 1);
                }
                
                // Check if it's paid or unpaid leave
                const isPaidLeave = ['annual', 'sick', 'casual', 'vacation', 'medical'].some(
                    type => leave.leave_type?.toLowerCase().includes(type)
                );
                
                if (isPaidLeave) {
                    paidLeaveDays += leaveDaysInMonth;
                } else {
                    unpaidLeaveDays += leaveDaysInMonth;
                }
            }
            
            // Calculate effective present days (including paid leave)
            const effectivePresentDays = presentDays + paidLeaveDays;
            
            // Calculate LOP days (unpaid leave + absences without approved leave)
            const recordedDays = presentDays + paidLeaveDays + unpaidLeaveDays + absentDays;
            const unaccountedDays = Math.max(0, effectiveWorkingDays - recordedDays);
            const lopDays = unpaidLeaveDays + absentDays + unaccountedDays;
            
            // Allowances (standard structure - 40% of basic split)
            const hra = baseSalary * 0.20; // 20% of basic
            const travelAllowance = baseSalary * 0.08;
            const medicalAllowance = baseSalary * 0.05;
            const specialAllowance = baseSalary * 0.07;
            const totalAllowances = hra + travelAllowance + medicalAllowance + specialAllowance;
            
            // Deductions
            const lopDeduction = lopDays * perDaySalary;
            const lateDeduction = lateDays > 3 ? (lateDays - 3) * (perDaySalary * 0.25) : 0; // 25% per day after 3 late days
            const halfDayDeduction = halfDays * (perDaySalary * 0.5);
            const pfDeduction = baseSalary * 0.12; // 12% PF on basic
            const grossBeforeTax = baseSalary + totalAllowances - lopDeduction - lateDeduction - halfDayDeduction;
            const taxDeduction = grossBeforeTax > 50000 ? grossBeforeTax * 0.1 : 0; // Simple 10% TDS if above 50k
            
            const totalDeductions = lopDeduction + lateDeduction + halfDayDeduction + pfDeduction + taxDeduction;
            const grossSalary = baseSalary + totalAllowances;
            const netPay = Math.max(0, grossSalary - totalDeductions);
            
            payrollRecords.push({
                emp_id: emp.emp_id,
                full_name: emp.full_name,
                position: emp.position || 'Staff',
                department: emp.department || 'General',
                
                working_days: effectiveWorkingDays,
                present_days: presentDays,
                absent_days: absentDays,
                half_days: halfDays,
                late_days: lateDays,
                
                paid_leave_days: paidLeaveDays,
                unpaid_leave_days: unpaidLeaveDays,
                
                basic_salary: baseSalary,
                per_day_salary: Math.round(perDaySalary),
                
                hra: Math.round(hra),
                travel_allowance: Math.round(travelAllowance),
                medical_allowance: Math.round(medicalAllowance),
                special_allowance: Math.round(specialAllowance),
                total_allowances: Math.round(totalAllowances),
                
                lop_deduction: Math.round(lopDeduction),
                late_deduction: Math.round(lateDeduction),
                half_day_deduction: Math.round(halfDayDeduction),
                pf_deduction: Math.round(pfDeduction),
                tax_deduction: Math.round(taxDeduction),
                other_deductions: 0,
                total_deductions: Math.round(totalDeductions),
                
                gross_salary: Math.round(grossSalary),
                net_pay: Math.round(netPay),
                
                status: 'draft'
            });
        }
        
        // Calculate summary
        const summary: PayrollSummary = {
            month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
            year,
            total_employees: payrollRecords.length,
            total_gross: payrollRecords.reduce((sum, r) => sum + r.gross_salary, 0),
            total_deductions: payrollRecords.reduce((sum, r) => sum + r.total_deductions, 0),
            total_net: payrollRecords.reduce((sum, r) => sum + r.net_pay, 0),
            status: 'draft'
        };
        
        return {
            success: true,
            payroll: payrollRecords,
            summary,
            metadata: {
                working_days: effectiveWorkingDays,
                holidays: holidays.length,
                month,
                year
            }
        };
        
    } catch (error: any) {
        console.error("[calculatePayroll] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to calculate payroll: ${error?.message || 'Unknown error'}` };
    }
}

// Process and save payroll to database
export async function processPayroll(month: number, year: number) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    try {
        const calculation = await calculatePayroll(month, year);
        if (!calculation.success || !('payroll' in calculation)) {
            return { success: false, error: 'error' in calculation ? calculation.error : 'Failed to calculate' };
        }
        
        const payroll = calculation.payroll;
        
        // Save each payroll record to database
        const savedRecords = await Promise.all(
            payroll.map(async (record: PayrollCalculation) => {
                return prisma.payroll.upsert({
                    where: {
                        emp_id_month_year: {
                            emp_id: record.emp_id,
                            month,
                            year
                        }
                    },
                    create: {
                        emp_id: record.emp_id,
                        month,
                        year,
                        basic_salary: record.basic_salary,
                        allowances: record.total_allowances,
                        deductions: record.total_deductions,
                        net_pay: record.net_pay,
                        status: 'processed',
                        processed_date: new Date()
                    },
                    update: {
                        basic_salary: record.basic_salary,
                        allowances: record.total_allowances,
                        deductions: record.total_deductions,
                        net_pay: record.net_pay,
                        status: 'processed',
                        processed_date: new Date()
                    }
                });
            })
        );
        
        revalidatePath('/hr/payroll');
        
        return {
            success: true,
            message: `Payroll processed for ${savedRecords.length} employees`,
            processed_count: savedRecords.length
        };
        
    } catch (error: any) {
        console.error("[processPayroll] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to process payroll: ${error?.message || 'Unknown error'}` };
    }
}

// Get payroll history
export async function getPayrollHistory(emp_id?: string) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    try {
        const whereClause = emp_id ? { emp_id } : {};
        
        const records = await prisma.payroll.findMany({
            where: whereClause,
            include: {
                employee: {
                    select: {
                        full_name: true,
                        position: true,
                        department: true
                    }
                }
            },
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ],
            take: 100
        });
        
        return {
            success: true,
            records: records.map(r => ({
                id: r.id,
                emp_id: r.emp_id,
                full_name: r.employee.full_name,
                position: r.employee.position,
                department: r.employee.department,
                month: r.month,
                year: r.year,
                basic_salary: Number(r.basic_salary),
                allowances: Number(r.allowances),
                deductions: Number(r.deductions),
                net_pay: Number(r.net_pay),
                status: r.status,
                processed_date: r.processed_date
            }))
        };
        
    } catch (error: any) {
        console.error("[getPayrollHistory] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch payroll history: ${error?.message || 'Unknown error'}` };
    }
}

// Approve payroll (for final approval before payment)
export async function approvePayroll(month: number, year: number) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    try {
        // Note: Prisma enum doesn't have 'approved' - using 'processed' -> 'paid' workflow
        // For now, we'll just re-mark as processed (in real app, add 'approved' to PaymentStatus enum)
        const updated = await prisma.payroll.updateMany({
            where: {
                month,
                year,
                status: 'processed'
            },
            data: {
                status: 'processed' // Mark as approved by keeping processed state
            }
        });
        
        revalidatePath('/hr/payroll');
        
        return {
            success: true,
            message: `Approved payroll for ${updated.count} employees`,
            approved_count: updated.count
        };
        
    } catch (error: any) {
        console.error("[approvePayroll] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to approve payroll: ${error?.message || 'Unknown error'}` };
    }
}

// Mark payroll as paid
export async function markPayrollPaid(month: number, year: number) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    try {
        const updated = await prisma.payroll.updateMany({
            where: {
                month,
                year,
                status: 'processed' // Since we don't have 'approved' enum, mark processed as paid
            },
            data: {
                status: 'paid'
            }
        });
        
        revalidatePath('/hr/payroll');
        
        return {
            success: true,
            message: `Marked payroll as paid for ${updated.count} employees`,
            paid_count: updated.count
        };
        
    } catch (error: any) {
        console.error("[markPayrollPaid] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to mark payroll as paid: ${error?.message || 'Unknown error'}` };
    }
}

// Get employee payslip
export async function getPayslip(emp_id: string, month: number, year: number) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    try {
        // Verify the user is either HR or the employee themselves
        const currentEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id }
        });
        
        if (!currentEmployee) {
            return { success: false, error: "Employee not found" };
        }
        
        const isHR = currentEmployee.role === 'hr' || currentEmployee.role === 'admin';
        const isOwnPayslip = currentEmployee.emp_id === emp_id;
        
        if (!isHR && !isOwnPayslip) {
            return { success: false, error: "You can only view your own payslip" };
        }
        
        const payroll = await prisma.payroll.findUnique({
            where: {
                emp_id_month_year: {
                    emp_id,
                    month,
                    year
                }
            },
            include: {
                employee: {
                    select: {
                        full_name: true,
                        position: true,
                        department: true,
                        email: true,
                        hire_date: true
                    }
                }
            }
        });
        
        if (!payroll) {
            return { success: false, error: "Payslip not found for this period" };
        }
        
        return {
            success: true,
            payslip: {
                employee: {
                    emp_id: payroll.emp_id,
                    name: payroll.employee.full_name,
                    position: payroll.employee.position,
                    department: payroll.employee.department,
                    email: payroll.employee.email,
                    hire_date: payroll.employee.hire_date
                },
                period: {
                    month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
                    year
                },
                earnings: {
                    basic_salary: Number(payroll.basic_salary),
                    allowances: Number(payroll.allowances),
                    gross: Number(payroll.basic_salary) + Number(payroll.allowances)
                },
                deductions: {
                    total: Number(payroll.deductions)
                },
                net_pay: Number(payroll.net_pay),
                status: payroll.status,
                processed_date: payroll.processed_date
            }
        };
        
    } catch (error: any) {
        console.error("[getPayslip] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch payslip: ${error?.message || 'Unknown error'}` };
    }
}

// Export payroll data as CSV
export async function exportPayrollCSV(month: number, year: number) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    try {
        const calculation = await calculatePayroll(month, year);
        if (!calculation.success || !('payroll' in calculation)) {
            return { success: false, error: 'error' in calculation ? calculation.error : 'Failed to calculate' };
        }
        
        const payroll = calculation.payroll;
        
        // Create CSV headers
        const headers = [
            'Employee ID',
            'Name',
            'Department',
            'Position',
            'Working Days',
            'Present Days',
            'Absent Days',
            'Paid Leave Days',
            'Unpaid Leave Days',
            'Basic Salary',
            'Total Allowances',
            'LOP Deduction',
            'PF Deduction',
            'Tax Deduction',
            'Total Deductions',
            'Gross Salary',
            'Net Pay'
        ];
        
        const rows = payroll.map((r: PayrollCalculation) => [
            r.emp_id,
            r.full_name,
            r.department,
            r.position,
            r.working_days,
            r.present_days,
            r.absent_days,
            r.paid_leave_days,
            r.unpaid_leave_days,
            r.basic_salary,
            r.total_allowances,
            r.lop_deduction,
            r.pf_deduction,
            r.tax_deduction,
            r.total_deductions,
            r.gross_salary,
            r.net_pay
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map((row: (string | number)[]) => row.join(','))
        ].join('\n');
        
        return {
            success: true,
            csv: csvContent,
            filename: `payroll_${month}_${year}.csv`
        };
        
    } catch (error: any) {
        console.error("[exportPayrollCSV] Error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to export CSV: ${error?.message || 'Unknown error'}` };
    }
}
