"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

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

        // 3. Attendance Rate
        const attendanceRate = employee.attendances.length > 0 ? "95%" : "100%";

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
                performance: "On Track"
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

    } catch (error) {
        console.error("Employee Stats Error:", error);
        return { success: false, error: "Failed to fetch stats." };
    }
}

export async function analyzeLeaveRequest(text: string) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // Get emp_id corresponding to clerk_id
    const emp = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        select: { emp_id: true }
    });

    if (!emp) return { success: false, error: "Employee profile not found" };

    try {
        const response = await fetch(`${process.env.CONSTRAINT_ENGINE_URL || 'http://localhost:8001'}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employee_id: emp.emp_id,
                text: text
            }),
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Constraint Engine Error: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return { success: false, error: "AI Service Unavailable. Please try again later." };
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
                created_at: req.created_at.toISOString()
            }))
        };
    } catch (error) {
        console.error("History Fetch Error:", error);
        return { success: false, error: "Failed to fetch history" };
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
                company: employee.company?.name || "TetraDeck",
                status: employee.is_active ? "Active" : "Inactive",
                manager: employee.manager_id || "N/A"
            }
        };
    } catch (error) {
        console.error("Profile Fetch Error:", error);
        return { success: false, error: "Failed to fetch profile" };
    }
}
