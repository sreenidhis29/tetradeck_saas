"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { logAudit, AuditAction } from "@/lib/audit";

// Types for leave records
export interface LeaveRecord {
    id: string;
    emp_id: string;
    employee_name: string;
    department: string | null;
    month: number;
    year: number;
    // Leave counts by status
    paid_leave_taken: number;
    unpaid_leave_taken: number;
    half_day_leave_taken: number;
    sick_leave_taken: number;
    casual_leave_taken: number;
    maternity_leave_taken: number;
    paternity_leave_taken: number;
    bereavement_leave_taken: number;
    // Attendance summary
    total_working_days: number;
    days_present: number;
    days_absent: number;
    late_arrivals: number;
    early_departures: number;
    // Balance info
    total_leave_balance: number;
    leave_used_this_year: number;
    carry_forward: number;
    // Metadata
    created_at: Date;
    updated_at: Date;
}

export interface LeaveRecordSummary {
    total_employees: number;
    total_paid_leaves: number;
    total_unpaid_leaves: number;
    total_half_days: number;
    avg_attendance_rate: number;
    employees_with_low_attendance: number;
    month: number;
    year: number;
}

// Verify access with role check
async function verifyAccess(requiredRoles: string[] = ['hr', 'admin', 'manager']) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        select: { 
            emp_id: true, 
            role: true, 
            org_id: true, 
            full_name: true,
            department: true
        }
    });
    
    if (!employee) return { success: false, error: "Employee not found" };
    
    if (!requiredRoles.includes(employee.role)) {
        return { success: false, error: `Access denied. Required roles: ${requiredRoles.join(', ')}` };
    }
    
    return { success: true, employee };
}

// Get employee's own leave records
export async function getMyLeaveRecords(year?: number) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id }
    });
    if (!employee) return { success: false, error: "Employee not found" };

    const targetYear = year || new Date().getFullYear();

    try {
        // Get all leave requests for the year
        const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
                emp_id: employee.emp_id,
                created_at: {
                    gte: new Date(`${targetYear}-01-01`),
                    lte: new Date(`${targetYear}-12-31`)
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Get leave balances
        const balances = await prisma.leaveBalance.findMany({
            where: {
                emp_id: employee.emp_id,
                year: targetYear
            }
        });

        // Get attendance data
        const attendance = await prisma.attendance.findMany({
            where: {
                emp_id: employee.emp_id,
                date: {
                    gte: new Date(`${targetYear}-01-01`),
                    lte: new Date(`${targetYear}-12-31`)
                }
            }
        });

        // Calculate monthly breakdown
        const monthlyRecords = calculateMonthlyRecords(
            employee,
            leaveRequests,
            attendance,
            balances,
            targetYear
        );

        // Calculate yearly summary
        const yearlySummary = calculateYearlySummary(monthlyRecords);

        return {
            success: true,
            employee: {
                emp_id: employee.emp_id,
                name: employee.full_name,
                department: employee.department
            },
            monthlyRecords,
            yearlySummary,
            year: targetYear
        };

    } catch (error: any) {
        console.error("[getMyLeaveRecords] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch leave records: ${error?.message || 'Unknown error'}` };
    }
}

// Get all employees' leave records (HR/Admin only)
export async function getAllLeaveRecords(month: number, year: number) {
    const authResult = await verifyAccess(['hr', 'admin']);
    if (!authResult.success) return authResult;
    
    const { employee: hrEmployee } = authResult;

    try {
        // Get all employees in the organization
        const employees = await prisma.employee.findMany({
            where: {
                org_id: hrEmployee!.org_id,
                is_active: true
            },
            include: {
                leave_requests: {
                    where: {
                        start_date: {
                            gte: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
                            lte: new Date(`${year}-${String(month).padStart(2, '0')}-31`)
                        }
                    }
                },
                attendances: {
                    where: {
                        date: {
                            gte: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
                            lte: new Date(`${year}-${String(month).padStart(2, '0')}-31`)
                        }
                    }
                },
                leave_balances: {
                    where: { year }
                }
            }
        });

        const records: LeaveRecord[] = employees.map(emp => {
            // Calculate leave counts by type and status
            const approvedLeaves = emp.leave_requests.filter(
                lr => lr.status === 'approved'
            );

            const paidLeaves = approvedLeaves.filter(lr => 
                ['annual', 'sick', 'casual'].includes(lr.leave_type)
            );
            const unpaidLeaves = approvedLeaves.filter(lr => 
                lr.leave_type === 'unpaid'
            );
            const halfDayLeaves = approvedLeaves.filter(lr => 
                lr.is_half_day
            );
            const sickLeaves = approvedLeaves.filter(lr => 
                lr.leave_type === 'sick'
            );
            const casualLeaves = approvedLeaves.filter(lr => 
                lr.leave_type === 'casual'
            );
            const maternityLeaves = approvedLeaves.filter(lr => 
                lr.leave_type === 'maternity'
            );
            const paternityLeaves = approvedLeaves.filter(lr => 
                lr.leave_type === 'paternity'
            );
            const bereavementLeaves = approvedLeaves.filter(lr => 
                lr.leave_type === 'bereavement'
            );

            // Calculate attendance stats
            const presentDays = emp.attendances.filter(a => 
                a.status === 'PRESENT' || a.status === 'LATE'
            ).length;
            const absentDays = emp.attendances.filter(a => 
                a.status === 'ABSENT'
            ).length;
            const lateDays = emp.attendances.filter(a => 
                a.status === 'LATE'
            ).length;

            // Get working days in month
            const workingDays = getWorkingDaysInMonth(month, year);

            // Sum up leave days
            const sumDays = (leaves: typeof approvedLeaves) => 
                leaves.reduce((sum, l) => sum + Number(l.working_days), 0);

            // Calculate balance info
            const totalBalance = emp.leave_balances.reduce(
                (sum, b) => sum + Number(b.annual_entitlement) + Number(b.carried_forward), 0
            );
            const usedDays = emp.leave_balances.reduce(
                (sum, b) => sum + Number(b.used_days), 0
            );
            const carryForward = emp.leave_balances.reduce(
                (sum, b) => sum + Number(b.carried_forward), 0
            );

            return {
                id: `${emp.emp_id}-${month}-${year}`,
                emp_id: emp.emp_id,
                employee_name: emp.full_name,
                department: emp.department,
                month,
                year,
                // Leave counts
                paid_leave_taken: sumDays(paidLeaves),
                unpaid_leave_taken: sumDays(unpaidLeaves),
                half_day_leave_taken: halfDayLeaves.length,
                sick_leave_taken: sumDays(sickLeaves),
                casual_leave_taken: sumDays(casualLeaves),
                maternity_leave_taken: sumDays(maternityLeaves),
                paternity_leave_taken: sumDays(paternityLeaves),
                bereavement_leave_taken: sumDays(bereavementLeaves),
                // Attendance
                total_working_days: workingDays,
                days_present: presentDays,
                days_absent: absentDays,
                late_arrivals: lateDays,
                early_departures: 0, // TODO: Track this
                // Balance
                total_leave_balance: totalBalance,
                leave_used_this_year: usedDays,
                carry_forward: carryForward,
                // Metadata
                created_at: new Date(),
                updated_at: new Date()
            };
        });

        // Calculate summary
        const summary: LeaveRecordSummary = {
            total_employees: records.length,
            total_paid_leaves: records.reduce((s, r) => s + r.paid_leave_taken, 0),
            total_unpaid_leaves: records.reduce((s, r) => s + r.unpaid_leave_taken, 0),
            total_half_days: records.reduce((s, r) => s + r.half_day_leave_taken, 0),
            avg_attendance_rate: records.length > 0 
                ? (records.reduce((s, r) => s + (r.days_present / r.total_working_days * 100), 0) / records.length)
                : 0,
            employees_with_low_attendance: records.filter(
                r => (r.days_present / r.total_working_days * 100) < 80
            ).length,
            month,
            year
        };

        await logAudit({
            action: AuditAction.LEAVE_RECORDS_VIEWED,
            actorId: hrEmployee!.emp_id,
            entityType: 'LeaveRecords',
            entityId: `${month}-${year}`,
            orgId: hrEmployee!.org_id || 'default',
            details: { month, year, recordCount: records.length }
        });

        return {
            success: true,
            records,
            summary
        };

    } catch (error: any) {
        console.error("[getAllLeaveRecords] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch leave records: ${error?.message || 'Unknown error'}` };
    }
}

// Export leave records to CSV
export async function exportLeaveRecordsCSV(month: number, year: number) {
    const authResult = await verifyAccess(['hr', 'admin']);
    if (!authResult.success) return authResult;

    const result = await getAllLeaveRecords(month, year);
    if (!result.success || !('records' in result)) return result;

    const headers = [
        'Employee ID',
        'Employee Name',
        'Department',
        'Paid Leave',
        'Unpaid Leave',
        'Half Day',
        'Sick Leave',
        'Casual Leave',
        'Working Days',
        'Present',
        'Absent',
        'Late',
        'Attendance %',
        'Leave Balance',
        'Used This Year',
        'Carry Forward'
    ].join(',');

    const rows = result.records.map(r => [
        r.emp_id,
        `"${r.employee_name}"`,
        `"${r.department || 'N/A'}"`,
        r.paid_leave_taken,
        r.unpaid_leave_taken,
        r.half_day_leave_taken,
        r.sick_leave_taken,
        r.casual_leave_taken,
        r.total_working_days,
        r.days_present,
        r.days_absent,
        r.late_arrivals,
        ((r.days_present / r.total_working_days) * 100).toFixed(1),
        r.total_leave_balance,
        r.leave_used_this_year,
        r.carry_forward
    ].join(','));

    const csv = [headers, ...rows].join('\n');

    return {
        success: true,
        csv,
        filename: `leave-records-${year}-${String(month).padStart(2, '0')}.csv`
    };
}

// Get individual employee leave record
export async function getEmployeeLeaveRecord(empId: string, year: number) {
    const authResult = await verifyAccess(['hr', 'admin', 'manager']);
    if (!authResult.success) return authResult;

    try {
        const employee = await prisma.employee.findUnique({
            where: { emp_id: empId },
            include: {
                leave_requests: {
                    where: {
                        created_at: {
                            gte: new Date(`${year}-01-01`),
                            lte: new Date(`${year}-12-31`)
                        }
                    },
                    orderBy: { created_at: 'desc' }
                },
                leave_balances: {
                    where: { year }
                },
                attendances: {
                    where: {
                        date: {
                            gte: new Date(`${year}-01-01`),
                            lte: new Date(`${year}-12-31`)
                        }
                    }
                }
            }
        });

        if (!employee) {
            return { success: false, error: "Employee not found" };
        }

        // Build monthly breakdown
        const monthlyData = [];
        for (let month = 1; month <= 12; month++) {
            const monthLeaves = employee.leave_requests.filter(lr => {
                const reqMonth = new Date(lr.start_date).getMonth() + 1;
                return reqMonth === month && lr.status === 'approved';
            });

            const monthAttendance = employee.attendances.filter(a => {
                const attMonth = new Date(a.date).getMonth() + 1;
                return attMonth === month;
            });

            monthlyData.push({
                month,
                year,
                leaves: {
                    paid: monthLeaves.filter(l => ['annual', 'sick', 'casual'].includes(l.leave_type))
                        .reduce((s, l) => s + Number(l.working_days), 0),
                    unpaid: monthLeaves.filter(l => l.leave_type === 'unpaid')
                        .reduce((s, l) => s + Number(l.working_days), 0),
                    half_day: monthLeaves.filter(l => l.is_half_day).length,
                    sick: monthLeaves.filter(l => l.leave_type === 'sick')
                        .reduce((s, l) => s + Number(l.working_days), 0),
                    casual: monthLeaves.filter(l => l.leave_type === 'casual')
                        .reduce((s, l) => s + Number(l.working_days), 0),
                },
                attendance: {
                    present: monthAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
                    absent: monthAttendance.filter(a => a.status === 'ABSENT').length,
                    late: monthAttendance.filter(a => a.status === 'LATE').length,
                    working_days: getWorkingDaysInMonth(month, year)
                }
            });
        }

        // Calculate yearly totals
        const yearlyTotals = {
            total_paid_leaves: monthlyData.reduce((s, m) => s + m.leaves.paid, 0),
            total_unpaid_leaves: monthlyData.reduce((s, m) => s + m.leaves.unpaid, 0),
            total_half_days: monthlyData.reduce((s, m) => s + m.leaves.half_day, 0),
            total_sick_leaves: monthlyData.reduce((s, m) => s + m.leaves.sick, 0),
            total_casual_leaves: monthlyData.reduce((s, m) => s + m.leaves.casual, 0),
            total_present_days: monthlyData.reduce((s, m) => s + m.attendance.present, 0),
            total_absent_days: monthlyData.reduce((s, m) => s + m.attendance.absent, 0),
            total_late_days: monthlyData.reduce((s, m) => s + m.attendance.late, 0),
            total_working_days: monthlyData.reduce((s, m) => s + m.attendance.working_days, 0),
        };

        // Get balance info
        const balances = employee.leave_balances.map(b => ({
            leave_type: b.leave_type,
            entitled: Number(b.annual_entitlement),
            used: Number(b.used_days),
            pending: Number(b.pending_days),
            carried_forward: Number(b.carried_forward),
            remaining: Number(b.annual_entitlement) + Number(b.carried_forward) - Number(b.used_days) - Number(b.pending_days)
        }));

        return {
            success: true,
            employee: {
                emp_id: employee.emp_id,
                name: employee.full_name,
                email: employee.email,
                department: employee.department,
                position: employee.position,
                hire_date: employee.hire_date
            },
            monthlyData,
            yearlyTotals,
            balances,
            leaveRequests: employee.leave_requests.map(lr => ({
                id: lr.request_id,
                type: lr.leave_type,
                start_date: lr.start_date,
                end_date: lr.end_date,
                days: Number(lr.working_days),
                is_half_day: lr.is_half_day,
                status: lr.status,
                reason: lr.reason,
                created_at: lr.created_at
            })),
            year
        };

    } catch (error: any) {
        console.error("[getEmployeeLeaveRecord] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        if (error?.code === 'P2025') {
            return { success: false, error: "Employee not found." };
        }
        return { success: false, error: `Failed to fetch employee leave record: ${error?.message || 'Unknown error'}` };
    }
}

// Helper: Calculate working days in a month (excluding weekends)
function getWorkingDaysInMonth(month: number, year: number): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    let workingDays = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) {
            workingDays++;
        }
    }

    return workingDays;
}

// Helper: Calculate monthly records from raw data
function calculateMonthlyRecords(
    employee: { emp_id: string; full_name: string; department: string | null },
    leaveRequests: any[],
    attendance: any[],
    balances: any[],
    year: number
) {
    const records = [];
    
    for (let month = 1; month <= 12; month++) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);

        const monthLeaves = leaveRequests.filter(lr => {
            const startDate = new Date(lr.start_date);
            return startDate >= monthStart && startDate <= monthEnd && lr.status === 'approved';
        });

        const monthAttendance = attendance.filter(a => {
            const date = new Date(a.date);
            return date >= monthStart && date <= monthEnd;
        });

        records.push({
            month,
            year,
            leaves: {
                paid: monthLeaves.filter(l => ['annual', 'sick', 'casual'].includes(l.leave_type))
                    .reduce((s: number, l: { working_days: number | string }) => s + Number(l.working_days), 0),
                unpaid: monthLeaves.filter(l => l.leave_type === 'unpaid')
                    .reduce((s: number, l: { working_days: number | string }) => s + Number(l.working_days), 0),
                half_day: monthLeaves.filter(l => l.is_half_day).length,
                sick: monthLeaves.filter(l => l.leave_type === 'sick')
                    .reduce((s: number, l: { working_days: number | string }) => s + Number(l.working_days), 0),
                casual: monthLeaves.filter(l => l.leave_type === 'casual')
                    .reduce((s: number, l: { working_days: number | string }) => s + Number(l.working_days), 0),
            },
            attendance: {
                present: monthAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
                absent: monthAttendance.filter(a => a.status === 'ABSENT').length,
                late: monthAttendance.filter(a => a.status === 'LATE').length,
                working_days: getWorkingDaysInMonth(month, year)
            }
        });
    }

    return records;
}

// Helper: Calculate yearly summary
function calculateYearlySummary(monthlyRecords: ReturnType<typeof calculateMonthlyRecords>) {
    return {
        total_paid_leaves: monthlyRecords.reduce((s, m) => s + m.leaves.paid, 0),
        total_unpaid_leaves: monthlyRecords.reduce((s, m) => s + m.leaves.unpaid, 0),
        total_half_days: monthlyRecords.reduce((s, m) => s + m.leaves.half_day, 0),
        total_sick_leaves: monthlyRecords.reduce((s, m) => s + m.leaves.sick, 0),
        total_casual_leaves: monthlyRecords.reduce((s, m) => s + m.leaves.casual, 0),
        total_present_days: monthlyRecords.reduce((s, m) => s + m.attendance.present, 0),
        total_absent_days: monthlyRecords.reduce((s, m) => s + m.attendance.absent, 0),
        total_late_days: monthlyRecords.reduce((s, m) => s + m.attendance.late, 0),
        total_working_days: monthlyRecords.reduce((s, m) => s + m.attendance.working_days, 0),
        attendance_rate: (() => {
            const totalWorking = monthlyRecords.reduce((s, m) => s + m.attendance.working_days, 0);
            const totalPresent = monthlyRecords.reduce((s, m) => s + m.attendance.present, 0);
            return totalWorking > 0 ? (totalPresent / totalWorking * 100) : 0;
        })()
    };
}
