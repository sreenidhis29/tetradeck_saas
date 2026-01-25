"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

// Helper function to count work days in a month (excluding weekends)
function getWorkDaysInMonth(year: number, month: number): number {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    let workDays = 0;
    
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) workDays++; // Exclude weekends
    }
    return workDays;
}

// Helper function to count work days passed in current month
function getWorkDaysPassed(date: Date): number {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    let workDays = 0;
    
    for (let d = new Date(startOfMonth); d <= date; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) workDays++; // Exclude weekends
    }
    return workDays;
}

export async function getEmployeeDashboardStats() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: {
                leave_balances: true,
                leave_requests: {
                    orderBy: { created_at: 'desc' },
                    take: 10 // Fetch recent history
                },
                attendances: {
                    where: {
                        date: {
                            gte: new Date(new Date().setDate(new Date().getDate() - 30))
                        }
                    }
                }
            }
        });

        if (!employee) return { success: false, error: "Employee not found." };

        // 1. Calculate Leave Balances
        const DEFAULTS = {
            "Annual Leave": 20,
            "Sick Leave": 15,
            "Emergency Leave": 5,
            "Personal Leave": 5,
            "Maternity Leave": 18,
            "Paternity Leave": 15,
            "Bereavement Leave": 5,
            "Study Leave": 10
        };

        const allBalances: any[] = [];
        const processedTypes = new Set<string>();

        // Normalize helper
        const normalizeType = (t: string) => {
            t = t.toLowerCase();
            if (t.includes('annual') || t.includes('vacation')) return 'Annual Leave';
            if (t.includes('sick')) return 'Sick Leave';
            return Object.keys(DEFAULTS).find(k => k.toLowerCase() === t) || t;
        };

        // Fetch ALL requests to calculate usage dynamically (to mitigate sync issues)
        const allRequests = await prisma.leaveRequest.findMany({
            where: {
                emp_id: employee.emp_id,
                start_date: {
                    gte: new Date(new Date().getFullYear(), 0, 1) // Current Year
                }
            }
        });

        // Map requests to usage
        const usageMap = new Map<string, { used: number, pending: number }>();

        allRequests.forEach(req => {
            const type = normalizeType(req.leave_type);
            const days = Number(req.total_days);

            if (!usageMap.has(type)) usageMap.set(type, { used: 0, pending: 0 });
            const entry = usageMap.get(type)!;

            if (req.status === 'approved') {
                entry.used += days;
            } else if (req.status === 'pending' || req.status === 'escalated') {
                entry.pending += days;
            }
        });

        // 1. Process existing DB entitlements
        if (employee.leave_balances) {
            employee.leave_balances.forEach(bal => {
                const stdType = normalizeType(bal.leave_type);
                processedTypes.add(stdType);

                const entitlement = Number(bal.annual_entitlement);
                const carried = Number(bal.carried_forward);

                // Use calculated usage if valid
                const realUsage = usageMap.get(stdType);
                const used = realUsage ? realUsage.used : 0;
                const pending = realUsage ? realUsage.pending : 0;

                const total = entitlement + carried;
                const available = total - used - pending;

                allBalances.push({
                    type: stdType,
                    total: total,
                    used: used,
                    pending: pending,
                    available: available
                });
            });
        }

        // 2. Add Defaults for missing types
        Object.entries(DEFAULTS).forEach(([type, limit]) => {
            if (!processedTypes.has(type)) {
                const realUsage = usageMap.get(type);
                const used = realUsage ? realUsage.used : 0;
                const pending = realUsage ? realUsage.pending : 0;

                allBalances.push({
                    type: type,
                    total: limit, // Default entitlement
                    used: used,
                    pending: pending,
                    available: limit - used - pending
                });
            }
        });

        // Extract key metrics based on "Annual" and "Sick"
        const annual = allBalances.find(b => b.type === 'Annual Leave') || { available: 20, total: 20 };
        const sick = allBalances.find(b => b.type === 'Sick Leave') || { available: 15, total: 15 };

        // 2. Pending Requests Count
        const pendingCount = employee.leave_requests.filter(r => r.status === 'pending' || r.status === 'escalated').length;

        // 3. Real Attendance Rate Calculation (Critical Fix #7)
        // Calculate from actual attendance records this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const totalWorkDaysThisMonth = getWorkDaysInMonth(now.getFullYear(), now.getMonth());
        
        // Count present days from attendance records
        const presentDays = employee.attendances.filter(a => {
            const checkInDate = new Date(a.check_in);
            return checkInDate >= startOfMonth && checkInDate <= now;
        }).length;

        // Calculate working days passed so far this month
        const daysPassed = Math.min(getWorkDaysPassed(now), totalWorkDaysThisMonth);
        
        // Calculate attendance percentage
        const attendancePercent = daysPassed > 0 
            ? Math.round((presentDays / daysPassed) * 100) 
            : 100;
        const attendanceRate = `${attendancePercent}%`;

        // Calculate performance indicator from real data (Critical Fix #12)
        // Based on: attendance rate, late arrivals, leave pattern
        const lateCount = employee.attendances.filter(a => a.status === 'LATE').length;
        const lateRatio = daysPassed > 0 ? lateCount / daysPassed : 0;
        const leaveUsageRatio = (Number(annual.total) > 0) ? (Number(annual.total) - annual.available) / Number(annual.total) : 0;
        
        let performance = "On Track";
        if (attendancePercent >= 95 && lateRatio < 0.1) {
            performance = "Excellent";
        } else if (attendancePercent >= 85 && lateRatio < 0.2) {
            performance = "On Track";
        } else if (attendancePercent >= 70) {
            performance = "Needs Attention";
        } else {
            performance = "Requires Review";
        }

        return {
            success: true,
            stats: {
                leaveBalance: annual.available,
                annualBalance: annual.available,
                annualTotal: annual.total,
                sickBalance: sick.available,
                sickTotal: sick.total,
                pendingRequests: pendingCount,
                attendance: attendanceRate,
                performance,
                // Additional metrics from real data
                lateArrivals: lateCount,
                attendancePercent,
            },
            allBalances: allBalances,
            history: employee.leave_requests.map(req => ({
                id: req.request_id,
                type: req.leave_type || "Annual Leave",
                days: req.total_days.toString(),
                start_date: req.start_date,
                end_date: req.end_date,
                status: req.status,
                reason: req.reason
            }))
        };

    } catch (error: any) {
        console.error("[getEmployeeDashboardStats] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch stats: ${error?.message || 'Unknown error'}` };
    }
}

export async function analyzeLeaveRequest(text: string) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        // Get employee from database
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: {
                company: true,
                leave_balances: {
                    where: { year: new Date().getFullYear() }
                }
            }
        });

        if (!employee) {
            return { success: false, error: "Employee profile not found. Please complete onboarding." };
        }

        // Calculate remaining leave balance for the detected type
        const balanceMap: Record<string, number> = {};
        employee.leave_balances.forEach(bal => {
            const total = Number(bal.annual_entitlement) + Number(bal.carried_forward);
            const used = Number(bal.used_days) + Number(bal.pending_days);
            balanceMap[bal.leave_type.toLowerCase()] = total - used;
        });

        // Default remaining if type not found
        const remainingLeave = balanceMap['vacation leave'] || balanceMap['casual leave'] || 20;

        // AI Service URL - use localhost for local development
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
        console.log('[AI] Calling AI service at:', aiUrl);

        // Call the AI constraint engine directly
        // Let the backend parse natural language - don't override with hardcoded values
        const aiResponse = await fetch(`${aiUrl}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employee_id: employee.emp_id,
                text: text,
                // Let backend extract all info from text
                team_state: {
                    team: {
                        teamSize: 10,
                        alreadyOnLeave: 0,
                        min_coverage: 3,
                        max_concurrent_leave: 5
                    },
                    blackoutDates: []
                },
                leave_balance: {
                    remaining: remainingLeave
                }
            }),
        });

        if (!aiResponse.ok) {
            const errText = await aiResponse.text().catch(() => '');
            throw new Error(`AI Engine Error: ${aiResponse.status} ${errText}`);
        }

        const data = await aiResponse.json();
        
        return { 
            success: true, 
            data: {
                ...data,
                employee: {
                    emp_id: employee.emp_id,
                    name: employee.full_name,
                    department: employee.department
                }
            }
        };
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "AI Service Unavailable. Please try again later." 
        };
    }
}

// Update employee compensation settings (HR/Admin only)
export async function updateEmployeeCompensation(params: {
    emp_id: string;
    base_salary?: number;
    pf_rate?: number; // 0.12 = 12%
    insurance_amount?: number;
    professional_tax?: number;
    other_allowances?: number;
    other_deductions?: number;
    gst_applicable?: boolean;
}) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const actor = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { role: true, org_id: true }
        });
        if (!actor || (actor.role !== 'hr' && actor.role !== 'admin')) {
            return { success: false, error: "HR access required" };
        }

        const target = await prisma.employee.findUnique({
            where: { emp_id: params.emp_id },
            select: { org_id: true }
        });
        if (!target || target.org_id !== actor.org_id) {
            return { success: false, error: "Employee not found in your organization" };
        }

        const updateData: any = {};
        if (typeof params.base_salary === 'number') updateData.base_salary = params.base_salary;
        if (typeof params.pf_rate === 'number') updateData.pf_rate = params.pf_rate;
        if (typeof params.insurance_amount === 'number') updateData.insurance_amount = params.insurance_amount;
        if (typeof params.professional_tax === 'number') updateData.professional_tax = params.professional_tax;
        if (typeof params.other_allowances === 'number') updateData.other_allowances = params.other_allowances;
        if (typeof params.other_deductions === 'number') updateData.other_deductions = params.other_deductions;
        if (typeof params.gst_applicable === 'boolean') updateData.gst_applicable = params.gst_applicable;

        await prisma.employee.update({
            where: { emp_id: params.emp_id },
            data: updateData
        });

        return { success: true, message: "Compensation updated" };
    } catch (error: any) {
        console.error("[updateEmployeeCompensation] Error:", error?.message || error);
        return { success: false, error: `Failed to update compensation: ${error?.message || 'Unknown error'}` };
    }
}

export async function getLeaveHistory() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: {
                leave_requests: {
                    orderBy: { created_at: 'desc' },
                    take: 50
                }
            }
        });

        if (!employee) return { success: false, error: "Employee not found" };

        return {
            success: true,
            requests: employee.leave_requests.map(req => ({
                id: req.request_id,
                type: req.leave_type || "Annual Leave",
                start_date: req.start_date.toISOString(),
                end_date: req.end_date.toISOString(),
                reason: req.reason,
                status: req.status,
                total_days: req.total_days.toString(),
                created_at: req.created_at.toISOString(),
                is_half_day: req.is_half_day || false
            }))
        };
    } catch (error: any) {
        console.error("[getLeaveHistory] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch history: ${error?.message || 'Unknown error'}` };
    }
}

export async function getEmployeeProfile() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee) return { success: false, error: "Employee not found" };

        return {
            success: true,
            profile: {
                name: employee.full_name,
                email: employee.email,
                emp_id: employee.emp_id,
                department: employee.department || "Not Assigned",
                position: employee.position || "Staff",
                join_date: (employee.hire_date || new Date()).toISOString(),
                company: employee.company?.name || "Continuum",
                status: employee.is_active ? "Active" : "Inactive",
                manager: employee.manager_id || "N/A"
            }
        };
    } catch (error: any) {
        console.error("[getEmployeeProfile] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch profile: ${error?.message || 'Unknown error'}` };
    }
}

// ============================================================
// ATTENDANCE & CHECK-IN ACTIONS
// ============================================================

export async function getAttendanceRecords(limit = 30) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
        });

        if (!employee) return { success: false, error: "Employee not found" };

        const records = await prisma.attendance.findMany({
            where: { emp_id: employee.emp_id },
            orderBy: { date: 'desc' },
            take: limit
        });

        return {
            success: true,
            records: records.map(r => {
                // Format date as YYYY-MM-DD in local timezone to avoid date shifting
                const dateObj = new Date(r.date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const localDateStr = `${year}-${month}-${day}`;
                
                return {
                    id: r.id,
                    date: localDateStr,
                    check_in: r.check_in?.toISOString() || null,
                    check_out: r.check_out?.toISOString() || null,
                    total_hours: r.total_hours ? Number(r.total_hours) : null,
                    status: r.status
                };
            })
        };
    } catch (error: any) {
        console.error("[getAttendanceRecords] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch attendance: ${error?.message || 'Unknown error'}` };
    }
}

export async function getTodayAttendance() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
        });

        if (!employee) return { success: false, error: "Employee not found" };

        const now = new Date();
        // Use local date - set to midnight of current local day
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await prisma.attendance.findUnique({
            where: {
                emp_id_date: {
                    emp_id: employee.emp_id,
                    date: today
                }
            }
        });

        if (!attendance) {
            return {
                success: true,
                checked_in: false,
                checked_out: false,
                check_in_time: null,
                check_out_time: null
            };
        }

        return {
            success: true,
            checked_in: !!attendance.check_in,
            checked_out: !!attendance.check_out,
            check_in_time: attendance.check_in?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || null,
            check_out_time: attendance.check_out?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || null,
            total_hours: attendance.total_hours ? Number(attendance.total_hours) : null,
            status: attendance.status
        };
    } catch (error: any) {
        console.error("[getTodayAttendance] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to fetch today's attendance: ${error?.message || 'Unknown error'}` };
    }
}

export async function checkIn() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee) return { success: false, error: "Employee not found" };

        const now = new Date();
        // Use local date - set to midnight of current local day
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if already checked in
        const existing = await prisma.attendance.findUnique({
            where: {
                emp_id_date: {
                    emp_id: employee.emp_id,
                    date: today
                }
            }
        });

        if (existing?.check_in) {
            return { success: false, error: "Already checked in today" };
        }

        // Determine status - assume 9 AM local time is standard check-in
        const hour = now.getHours();
        const isLate = hour >= 9;

        const attendance = await prisma.attendance.upsert({
            where: {
                emp_id_date: {
                    emp_id: employee.emp_id,
                    date: today
                }
            },
            create: {
                emp_id: employee.emp_id,
                date: today,
                check_in: now,
                status: isLate ? 'LATE' : 'PRESENT'
            },
            update: {
                check_in: now,
                status: isLate ? 'LATE' : 'PRESENT'
            }
        });

        return {
            success: true,
            message: isLate ? "Checked in (Late)" : "Checked in successfully",
            check_in_time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            isLate
        };
    } catch (error: any) {
        console.error("[checkIn] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to check in: ${error?.message || 'Unknown error'}` };
    }
}

export async function checkOut() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
        });

        if (!employee) return { success: false, error: "Employee not found" };

        const now = new Date();
        // Use local midnight - consistent with checkIn
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if checked in
        const existing = await prisma.attendance.findUnique({
            where: {
                emp_id_date: {
                    emp_id: employee.emp_id,
                    date: today
                }
            }
        });

        if (!existing?.check_in) {
            return { success: false, error: "You haven't checked in yet" };
        }

        if (existing.check_out) {
            return { success: false, error: "Already checked out today" };
        }

        // Validate check_in time exists
        if (!existing.check_in) {
            return { success: false, error: "Check-in time not recorded properly" };
        }

        // Calculate total hours
        const checkInTime = new Date(existing.check_in);
        const totalHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        // Determine final status
        let finalStatus = existing.status;
        if (totalHours < 4) {
            finalStatus = 'HALF_DAY';
        }

        const attendance = await prisma.attendance.update({
            where: {
                emp_id_date: {
                    emp_id: employee.emp_id,
                    date: today
                }
            },
            data: {
                check_out: now,
                total_hours: totalHours,
                status: finalStatus
            }
        });

        return {
            success: true,
            message: "Checked out successfully",
            check_out_time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            total_hours: totalHours.toFixed(2)
        };
    } catch (error: any) {
        console.error("[checkOut] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again." };
        }
        return { success: false, error: `Failed to check out: ${error?.message || 'Unknown error'}` };
    }
}

export async function getHolidays(year?: number) {
    try {
        const targetYear = year || new Date().getFullYear();
        
        const holidays = await prisma.publicHoliday.findMany({
            where: { year: targetYear },
            orderBy: { date: 'asc' }
        });

        return {
            success: true,
            holidays: holidays.map(h => ({
                date: h.date.toISOString(),
                name: h.name,
                local_name: h.local_name
            }))
        };
    } catch (error: any) {
        console.error("[getHolidays] Database error:", error?.message || error);
        if (error?.code === 'P1001' || error?.code === 'P1002') {
            return { success: false, error: "Database connection failed. Please try again.", holidays: [] };
        }
        return { success: false, error: `Failed to fetch holidays: ${error?.message || 'Unknown error'}`, holidays: [] };
    }
}
