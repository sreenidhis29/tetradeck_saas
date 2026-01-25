"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

// ============================================================================
// TYPES FOR ADVANCED FEATURES
// ============================================================================

export type ConflictResolution = {
    requestId: string;
    employeeName: string;
    conflictsWith: string[];
    priorityScore: number;
    alternativeDates: { date: string; score: number; reason: string }[];
    recommendation: 'approve' | 'suggest_alternative' | 'escalate';
    reasoning: string;
};

export type WorkloadBalance = {
    department: string;
    currentLoad: number; // 0-100
    optimalLoad: number;
    overloadedEmployees: { name: string; workload: number; suggestion: string }[];
    suggestedLeaveWindows: { start: string; end: string; reason: string }[];
};

export type HolidayOptimization = {
    suggestion: string;
    leaveDaysNeeded: number;
    totalDaysOff: number;
    efficiency: number; // Days off per leave day used
    dates: { date: string; type: 'holiday' | 'leave' | 'weekend' }[];
    savingsDays: number;
};

export type AttendancePattern = {
    employeeId: string;
    employeeName: string;
    patterns: {
        type: 'late_day' | 'early_leave' | 'absence_pattern' | 'overtime' | 'consistent';
        description: string;
        frequency: string;
        days: string[];
        recommendation: string;
    }[];
    overallScore: number;
};

export type LeaveImpact = {
    teamCoverage: number;
    projectsAffected: string[];
    criticalMeetings: { date: string; title: string }[];
    blockedCollaborators: string[];
    riskLevel: 'low' | 'medium' | 'high';
    suggestions: string[];
};

export type EscalationStatus = {
    requestId: string;
    currentLevel: number;
    maxLevel: number;
    escalatedTo: string;
    reason: string;
    deadline: Date;
    autoEscalateAt: Date | null;
};

export type CompensationCalc = {
    employeeId: string;
    overtimeHours: number;
    weekendDays: number;
    holidayWork: number;
    earnedCompOff: number;
    pendingApproval: number;
    expiringDays: { days: number; expiresOn: string }[];
};

export type YearEndOptimization = {
    remainingBalance: number;
    expiringDays: number;
    carryForwardMax: number;
    optimalUsage: { date: string; days: number; reason: string }[];
    potentialLoss: number;
    recommendation: string;
};

// ============================================================================
// 1. SMART CONFLICT RESOLUTION ENGINE
// Resolves overlapping leave requests intelligently
// ============================================================================

export async function resolveLeaveConflicts(): Promise<{
    success: boolean;
    conflicts?: ConflictResolution[];
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const orgId = employee.org_id;

        // Get all pending requests
        const pendingRequests = await prisma.leaveRequest.findMany({
            where: {
                status: 'pending',
                employee: { org_id: orgId }
            },
            include: {
                employee: true
            },
            orderBy: { created_at: 'asc' }
        });

        const conflicts: ConflictResolution[] = [];

        // Group requests by overlapping dates
        for (const request of pendingRequests) {
            const startDate = new Date(request.start_date);
            const endDate = new Date(request.end_date);

            // Find overlapping requests
            const overlapping = pendingRequests.filter(other => {
                if (other.id === request.id) return false;
                if (other.employee.department !== request.employee.department) return false;
                
                const otherStart = new Date(other.start_date);
                const otherEnd = new Date(other.end_date);
                
                return startDate <= otherEnd && endDate >= otherStart;
            });

            if (overlapping.length > 0) {
                // Calculate priority score based on multiple factors
                let priorityScore = 50;

                // Seniority bonus
                const hireDate = (request.employee as any).hire_date;
                if (hireDate) {
                    const tenure = (Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
                    priorityScore += Math.min(tenure * 5, 20);
                }

                // First-come-first-served bonus
                priorityScore += 10;

                // Low balance penalty (encourage those with more balance to wait)
                const balance = await prisma.leaveBalance.findFirst({
                    where: { emp_id: request.emp_id, year: new Date().getFullYear() }
                });
                if (balance) {
                    const remaining = Number(balance.annual_entitlement) - Number(balance.used_days);
                    if (remaining < 5) priorityScore += 15;
                }

                // Generate alternative dates
                const alternatives = await generateAlternativeDates(
                    orgId,
                    request.employee.department || 'General',
                    startDate,
                    Number(request.days)
                );

                conflicts.push({
                    requestId: request.id,
                    employeeName: `${request.employee.first_name} ${request.employee.last_name}`,
                    conflictsWith: overlapping.map(o => `${o.employee.first_name} ${o.employee.last_name}`),
                    priorityScore: Math.round(priorityScore),
                    alternativeDates: alternatives,
                    recommendation: priorityScore > 70 ? 'approve' : alternatives.length > 0 ? 'suggest_alternative' : 'escalate',
                    reasoning: priorityScore > 70 
                        ? 'Higher priority based on tenure and request timing'
                        : 'Consider alternative dates to avoid team coverage issues'
                });
            }
        }

        return { success: true, conflicts };

    } catch (error) {
        console.error("Conflict resolution error:", error);
        return { success: false, error: "Failed to resolve conflicts" };
    }
}

async function generateAlternativeDates(
    orgId: string,
    department: string,
    originalDate: Date,
    days: number
): Promise<{ date: string; score: number; reason: string }[]> {
    const alternatives: { date: string; score: number; reason: string }[] = [];
    
    // Check 14 days before and after
    for (let offset = -14; offset <= 14; offset++) {
        if (offset === 0) continue;
        
        const altDate = new Date(originalDate);
        altDate.setDate(altDate.getDate() + offset);
        
        // Skip weekends
        if (altDate.getDay() === 0 || altDate.getDay() === 6) continue;
        
        // Check team availability
        const onLeave = await prisma.leaveRequest.count({
            where: {
                status: 'approved',
                start_date: { lte: altDate },
                end_date: { gte: altDate },
                employee: { org_id: orgId, department }
            }
        });

        const teamSize = await prisma.employee.count({
            where: { org_id: orgId, department }
        });

        const availability = teamSize > 0 ? ((teamSize - onLeave) / teamSize) * 100 : 100;
        
        if (availability >= 70) {
            alternatives.push({
                date: altDate.toISOString().split('T')[0],
                score: Math.round(availability),
                reason: availability >= 90 ? 'Excellent team coverage' : 'Good team availability'
            });
        }
    }

    return alternatives.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ============================================================================
// 2. INTELLIGENT WORKLOAD BALANCER
// Detects overloaded teams and suggests optimal leave windows
// ============================================================================

export async function analyzeWorkloadBalance(): Promise<{
    success: boolean;
    departments?: WorkloadBalance[];
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const orgId = employee.org_id;
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get all employees with their recent data
        const employees = await prisma.employee.findMany({
            where: { org_id: orgId },
            include: {
                attendance: {
                    where: { date: { gte: thirtyDaysAgo } }
                },
                leave_requests: {
                    where: {
                        status: 'approved',
                        start_date: { gte: thirtyDaysAgo }
                    }
                }
            }
        });

        // Group by department
        const deptMap: Record<string, typeof employees> = {};
        employees.forEach(emp => {
            const dept = emp.department || 'General';
            if (!deptMap[dept]) deptMap[dept] = [];
            deptMap[dept].push(emp);
        });

        const departments: WorkloadBalance[] = [];

        for (const [dept, emps] of Object.entries(deptMap)) {
            const overloadedEmployees: WorkloadBalance['overloadedEmployees'] = [];
            let totalLoad = 0;

            for (const emp of emps) {
                // Calculate workload based on:
                // - Overtime (check_out - check_in > 9 hours)
                // - No leave taken
                // - Consistent presence
                
                let workload = 50; // Base
                
                const avgHours = emp.attendance.reduce((sum, a) => {
                    if (!a.check_in || !a.check_out) return sum;
                    const hours = (new Date(a.check_out).getTime() - new Date(a.check_in).getTime()) / (1000 * 60 * 60);
                    return sum + hours;
                }, 0) / (emp.attendance.length || 1);

                if (avgHours > 9) workload += 30;
                else if (avgHours > 8) workload += 15;

                // No leave taken = higher workload
                if (emp.leave_requests.length === 0) workload += 20;

                workload = Math.min(100, workload);
                totalLoad += workload;

                if (workload > 70) {
                    overloadedEmployees.push({
                        name: `${emp.first_name} ${emp.last_name}`,
                        workload,
                        suggestion: workload > 85 
                            ? 'Urgent: Recommend mandatory time off'
                            : 'Consider encouraging a break'
                    });
                }
            }

            // Find optimal leave windows (periods with lower team activity)
            const suggestedWindows: WorkloadBalance['suggestedLeaveWindows'] = [];
            
            // Check next 30 days for low-conflict periods
            for (let i = 7; i < 30; i += 7) {
                const windowStart = new Date(today);
                windowStart.setDate(windowStart.getDate() + i);
                const windowEnd = new Date(windowStart);
                windowEnd.setDate(windowEnd.getDate() + 4);

                const leavesInWindow = await prisma.leaveRequest.count({
                    where: {
                        status: 'approved',
                        employee: { org_id: orgId, department: dept },
                        OR: [
                            { start_date: { gte: windowStart, lte: windowEnd } },
                            { end_date: { gte: windowStart, lte: windowEnd } }
                        ]
                    }
                });

                if (leavesInWindow < 2) {
                    suggestedWindows.push({
                        start: windowStart.toISOString().split('T')[0],
                        end: windowEnd.toISOString().split('T')[0],
                        reason: 'Low team absence expected - good window for leave'
                    });
                }
            }

            departments.push({
                department: dept,
                currentLoad: Math.round(totalLoad / emps.length),
                optimalLoad: 60,
                overloadedEmployees,
                suggestedLeaveWindows: suggestedWindows.slice(0, 3)
            });
        }

        return { success: true, departments };

    } catch (error) {
        console.error("Workload balance error:", error);
        return { success: false, error: "Failed to analyze workload" };
    }
}

// ============================================================================
// 3. HOLIDAY OPTIMIZER ENGINE
// Maximizes days off using smart leave placement around holidays
// ============================================================================

export async function optimizeHolidays(): Promise<{
    success: boolean;
    optimizations?: HolidayOptimization[];
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const orgId = employee.org_id;
        const workDays = (employee.company?.work_days as number[]) || [1, 2, 3, 4, 5];

        // Get holidays for this year and next
        const currentYear = new Date().getFullYear();
        const holidays = await prisma.holiday.findMany({
            where: {
                company_id: orgId,
                date: {
                    gte: new Date(),
                    lte: new Date(currentYear + 1, 11, 31)
                }
            },
            orderBy: { date: 'asc' }
        });

        const optimizations: HolidayOptimization[] = [];

        for (const holiday of holidays) {
            const holidayDate = new Date(holiday.date);
            const dayOfWeek = holidayDate.getDay() === 0 ? 7 : holidayDate.getDay();

            // Check for long weekend opportunities
            const dates: HolidayOptimization['dates'] = [];
            let leaveDaysNeeded = 0;
            let totalDaysOff = 0;

            // If Thursday holiday - take Friday off for 4-day weekend
            if (dayOfWeek === 4) {
                const friday = new Date(holidayDate);
                friday.setDate(friday.getDate() + 1);
                
                dates.push({ date: holidayDate.toISOString().split('T')[0], type: 'holiday' });
                dates.push({ date: friday.toISOString().split('T')[0], type: 'leave' });
                
                // Add weekend
                const saturday = new Date(friday);
                saturday.setDate(saturday.getDate() + 1);
                const sunday = new Date(saturday);
                sunday.setDate(sunday.getDate() + 1);
                
                dates.push({ date: saturday.toISOString().split('T')[0], type: 'weekend' });
                dates.push({ date: sunday.toISOString().split('T')[0], type: 'weekend' });

                leaveDaysNeeded = 1;
                totalDaysOff = 4;

                optimizations.push({
                    suggestion: `Take Friday off after ${holiday.name} for a 4-day weekend`,
                    leaveDaysNeeded,
                    totalDaysOff,
                    efficiency: totalDaysOff / leaveDaysNeeded,
                    dates,
                    savingsDays: totalDaysOff - leaveDaysNeeded - 1 // -1 for the holiday
                });
            }

            // If Tuesday holiday - take Monday off for 4-day weekend
            if (dayOfWeek === 2) {
                const monday = new Date(holidayDate);
                monday.setDate(monday.getDate() - 1);
                
                const sunday = new Date(monday);
                sunday.setDate(sunday.getDate() - 1);
                const saturday = new Date(sunday);
                saturday.setDate(saturday.getDate() - 1);

                dates.push({ date: saturday.toISOString().split('T')[0], type: 'weekend' });
                dates.push({ date: sunday.toISOString().split('T')[0], type: 'weekend' });
                dates.push({ date: monday.toISOString().split('T')[0], type: 'leave' });
                dates.push({ date: holidayDate.toISOString().split('T')[0], type: 'holiday' });

                leaveDaysNeeded = 1;
                totalDaysOff = 4;

                optimizations.push({
                    suggestion: `Take Monday off before ${holiday.name} for a 4-day weekend`,
                    leaveDaysNeeded,
                    totalDaysOff,
                    efficiency: totalDaysOff / leaveDaysNeeded,
                    dates,
                    savingsDays: totalDaysOff - leaveDaysNeeded - 1
                });
            }

            // If Wednesday holiday - sandwich for 5-day break
            if (dayOfWeek === 3) {
                const monday = new Date(holidayDate);
                monday.setDate(monday.getDate() - 2);
                const tuesday = new Date(holidayDate);
                tuesday.setDate(tuesday.getDate() - 1);
                const thursday = new Date(holidayDate);
                thursday.setDate(thursday.getDate() + 1);
                const friday = new Date(holidayDate);
                friday.setDate(friday.getDate() + 2);

                optimizations.push({
                    suggestion: `Take Mon-Tue off before ${holiday.name} for a 5-day break (use 2 leave days)`,
                    leaveDaysNeeded: 2,
                    totalDaysOff: 5,
                    efficiency: 2.5,
                    dates: [
                        { date: monday.toISOString().split('T')[0], type: 'leave' },
                        { date: tuesday.toISOString().split('T')[0], type: 'leave' },
                        { date: holidayDate.toISOString().split('T')[0], type: 'holiday' },
                        { date: thursday.toISOString().split('T')[0], type: 'weekend' },
                        { date: friday.toISOString().split('T')[0], type: 'weekend' },
                    ],
                    savingsDays: 2
                });
            }
        }

        // Sort by efficiency
        optimizations.sort((a, b) => b.efficiency - a.efficiency);

        return { success: true, optimizations: optimizations.slice(0, 10) };

    } catch (error) {
        console.error("Holiday optimization error:", error);
        return { success: false, error: "Failed to optimize holidays" };
    }
}

// ============================================================================
// 4. ATTENDANCE PATTERN ANALYZER
// Detects behavioral patterns in attendance data
// ============================================================================

export async function analyzeAttendancePatterns(): Promise<{
    success: boolean;
    patterns?: AttendancePattern[];
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const orgId = employee.org_id;
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const employees = await prisma.employee.findMany({
            where: { org_id: orgId },
            include: {
                attendance: {
                    where: { date: { gte: ninetyDaysAgo } },
                    orderBy: { date: 'asc' }
                }
            }
        });

        const patterns: AttendancePattern[] = [];

        for (const emp of employees) {
            const empPatterns: AttendancePattern['patterns'] = [];
            const dayStats: Record<number, { late: number; total: number }> = {};

            // Initialize day stats
            for (let i = 1; i <= 7; i++) dayStats[i] = { late: 0, total: 0 };

            let totalOvertime = 0;
            let overtimeDays = 0;
            let consistentDays = 0;

            for (const att of emp.attendance) {
                const dayOfWeek = new Date(att.date).getDay() || 7;
                dayStats[dayOfWeek].total++;

                if (att.status === 'LATE') {
                    dayStats[dayOfWeek].late++;
                } else {
                    consistentDays++;
                }

                // Check overtime
                if (att.check_in && att.check_out) {
                    const hours = (new Date(att.check_out).getTime() - new Date(att.check_in).getTime()) / (1000 * 60 * 60);
                    if (hours > 9) {
                        totalOvertime += hours - 8;
                        overtimeDays++;
                    }
                }
            }

            // Detect late day pattern
            const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const lateDays: string[] = [];
            
            for (let day = 1; day <= 5; day++) {
                const stats = dayStats[day];
                if (stats.total >= 5 && (stats.late / stats.total) > 0.4) {
                    lateDays.push(dayNames[day]);
                }
            }

            if (lateDays.length > 0) {
                empPatterns.push({
                    type: 'late_day',
                    description: `Frequently late on ${lateDays.join(', ')}`,
                    frequency: `${lateDays.length > 1 ? 'Multiple days' : 'Weekly'}`,
                    days: lateDays,
                    recommendation: 'Consider flexible start time or addressing root cause'
                });
            }

            // Detect overtime pattern
            if (overtimeDays > emp.attendance.length * 0.3) {
                empPatterns.push({
                    type: 'overtime',
                    description: `Regular overtime (${Math.round(totalOvertime)} extra hours in 90 days)`,
                    frequency: `${Math.round((overtimeDays / emp.attendance.length) * 100)}% of work days`,
                    days: [],
                    recommendation: 'Review workload distribution or consider comp-off'
                });
            }

            // Detect consistent attendance
            if (consistentDays > emp.attendance.length * 0.9) {
                empPatterns.push({
                    type: 'consistent',
                    description: 'Excellent attendance record',
                    frequency: `${Math.round((consistentDays / emp.attendance.length) * 100)}% on-time`,
                    days: [],
                    recommendation: 'Consider for attendance bonus or recognition'
                });
            }

            const overallScore = Math.round((consistentDays / (emp.attendance.length || 1)) * 100);

            if (empPatterns.length > 0) {
                patterns.push({
                    employeeId: emp.emp_id,
                    employeeName: `${emp.first_name} ${emp.last_name}`,
                    patterns: empPatterns,
                    overallScore
                });
            }
        }

        // Sort by score (lowest first - need attention)
        patterns.sort((a, b) => a.overallScore - b.overallScore);

        return { success: true, patterns };

    } catch (error) {
        console.error("Attendance pattern error:", error);
        return { success: false, error: "Failed to analyze patterns" };
    }
}

// ============================================================================
// 5. LEAVE IMPACT SIMULATOR
// Shows impact before submitting leave request
// ============================================================================

export async function simulateLeaveImpact(
    startDate: string,
    endDate: string,
    days: number
): Promise<{
    success: boolean;
    impact?: LeaveImpact;
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const orgId = employee.org_id;
        const department = employee.department || 'General';
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Calculate team coverage
        const [teamSize, approvedLeaves] = await Promise.all([
            prisma.employee.count({
                where: { org_id: orgId, department }
            }),
            prisma.leaveRequest.findMany({
                where: {
                    status: 'approved',
                    employee: { org_id: orgId, department },
                    OR: [
                        { start_date: { lte: end }, end_date: { gte: start } }
                    ]
                },
                include: { employee: true }
            })
        ]);

        const onLeaveCount = approvedLeaves.length + 1; // +1 for this request
        const teamCoverage = teamSize > 0 
            ? Math.round(((teamSize - onLeaveCount) / teamSize) * 100)
            : 100;

        // Get blocked collaborators (people waiting for this employee)
        const blockedCollaborators = approvedLeaves.map(l => 
            `${l.employee.first_name} ${l.employee.last_name}`
        );

        // Determine risk level
        let riskLevel: LeaveImpact['riskLevel'] = 'low';
        if (teamCoverage < 50) riskLevel = 'high';
        else if (teamCoverage < 70) riskLevel = 'medium';

        // Generate suggestions
        const suggestions: string[] = [];
        if (riskLevel === 'high') {
            suggestions.push('Consider splitting leave into multiple shorter periods');
            suggestions.push('Ensure handover documentation is prepared');
        }
        if (blockedCollaborators.length > 0) {
            suggestions.push(`Coordinate with ${blockedCollaborators[0]} who is also on leave`);
        }
        if (days > 5) {
            suggestions.push('Set up auto-responder for emails');
            suggestions.push('Delegate critical tasks before leaving');
        }

        return {
            success: true,
            impact: {
                teamCoverage,
                projectsAffected: [], // Would need project tracking
                criticalMeetings: [], // Would need calendar integration
                blockedCollaborators,
                riskLevel,
                suggestions
            }
        };

    } catch (error) {
        console.error("Leave impact simulation error:", error);
        return { success: false, error: "Failed to simulate impact" };
    }
}

// ============================================================================
// 6. AUTO-ESCALATION ENGINE
// Automatically escalates pending requests based on rules
// ============================================================================

export async function processAutoEscalations(): Promise<{
    success: boolean;
    escalated?: EscalationStatus[];
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const orgId = employee.org_id;
        const now = new Date();
        
        // Get pending requests older than 24 hours
        const twentyFourHoursAgo = new Date(now);
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const pendingRequests = await prisma.leaveRequest.findMany({
            where: {
                status: 'pending',
                employee: { org_id: orgId },
                created_at: { lt: twentyFourHoursAgo }
            },
            include: { employee: true }
        });

        const escalated: EscalationStatus[] = [];

        for (const request of pendingRequests) {
            const hoursPending = (now.getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60);
            
            let currentLevel = 1;
            let escalatedTo = 'Manager';
            
            if (hoursPending > 72) {
                currentLevel = 3;
                escalatedTo = 'HR Director';
            } else if (hoursPending > 48) {
                currentLevel = 2;
                escalatedTo = 'HR Manager';
            }

            const autoEscalateAt = new Date(now);
            autoEscalateAt.setHours(autoEscalateAt.getHours() + 24);

            escalated.push({
                requestId: request.id,
                currentLevel,
                maxLevel: 3,
                escalatedTo,
                reason: `Pending for ${Math.round(hoursPending)} hours without action`,
                deadline: new Date(request.start_date),
                autoEscalateAt: currentLevel < 3 ? autoEscalateAt : null
            });

            // Update request with escalation info (if we had an escalation_level field)
            // For now, just track in response
        }

        return { success: true, escalated };

    } catch (error) {
        console.error("Auto-escalation error:", error);
        return { success: false, error: "Failed to process escalations" };
    }
}

// ============================================================================
// 7. COMPENSATION CALCULATOR
// Calculates comp-off days from overtime and holiday work
// ============================================================================

export async function calculateCompensation(): Promise<{
    success: boolean;
    compensation?: CompensationCalc;
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const workDays = (employee.company?.work_days as number[]) || [1, 2, 3, 4, 5];

        // Get attendance records
        const attendance = await prisma.attendance.findMany({
            where: {
                emp_id: employee.emp_id,
                date: { gte: ninetyDaysAgo }
            }
        });

        // Get holidays
        const holidays = await prisma.holiday.findMany({
            where: {
                company_id: employee.org_id,
                date: { gte: ninetyDaysAgo }
            }
        });

        const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

        let overtimeHours = 0;
        let weekendDays = 0;
        let holidayWork = 0;

        for (const att of attendance) {
            if (!att.check_in || !att.check_out) continue;

            const hours = (new Date(att.check_out).getTime() - new Date(att.check_in).getTime()) / (1000 * 60 * 60);
            const dayOfWeek = new Date(att.date).getDay() || 7;
            const dateStr = new Date(att.date).toISOString().split('T')[0];

            // Overtime (> 9 hours)
            if (hours > 9) {
                overtimeHours += hours - 8;
            }

            // Weekend work
            if (!workDays.includes(dayOfWeek)) {
                weekendDays++;
            }

            // Holiday work
            if (holidayDates.has(dateStr)) {
                holidayWork++;
            }
        }

        // Calculate earned comp-off:
        // - 8 hours overtime = 0.5 comp-off day
        // - Weekend work = 1 comp-off day
        // - Holiday work = 1.5 comp-off days
        const earnedCompOff = Math.round(
            (overtimeHours / 16) + weekendDays + (holidayWork * 1.5)
        );

        return {
            success: true,
            compensation: {
                employeeId: employee.emp_id,
                overtimeHours: Math.round(overtimeHours),
                weekendDays,
                holidayWork,
                earnedCompOff,
                pendingApproval: 0, // Would need comp-off tracking table
                expiringDays: earnedCompOff > 0 ? [{ 
                    days: earnedCompOff, 
                    expiresOn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                }] : []
            }
        };

    } catch (error) {
        console.error("Compensation calculation error:", error);
        return { success: false, error: "Failed to calculate compensation" };
    }
}

// ============================================================================
// 8. YEAR-END LEAVE OPTIMIZER
// Suggests optimal usage of remaining leave balance
// ============================================================================

export async function optimizeYearEndLeave(): Promise<{
    success: boolean;
    optimization?: YearEndOptimization;
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const currentYear = new Date().getFullYear();
        const carryForwardMax = employee.company?.carry_forward_max || 5;

        // Get leave balance
        const balance = await prisma.leaveBalance.findFirst({
            where: {
                emp_id: employee.emp_id,
                year: currentYear
            }
        });

        if (!balance) {
            return {
                success: true,
                optimization: {
                    remainingBalance: 0,
                    expiringDays: 0,
                    carryForwardMax,
                    optimalUsage: [],
                    potentialLoss: 0,
                    recommendation: 'No leave balance found for current year'
                }
            };
        }

        const remaining = Number(balance.annual_entitlement) + Number(balance.carried_forward) - Number(balance.used_days) - Number(balance.pending_days);
        const expiringDays = Math.max(0, remaining - carryForwardMax);

        // Get holidays for optimal planning
        const holidays = await prisma.holiday.findMany({
            where: {
                company_id: employee.org_id,
                date: {
                    gte: new Date(),
                    lte: new Date(currentYear, 11, 31)
                }
            }
        });

        const optimalUsage: YearEndOptimization['optimalUsage'] = [];

        // Suggest using expiring days first
        if (expiringDays > 0) {
            // Find best windows around holidays
            for (const holiday of holidays) {
                const holidayDate = new Date(holiday.date);
                const dayOfWeek = holidayDate.getDay() || 7;

                if (dayOfWeek === 4 || dayOfWeek === 2) { // Thursday or Tuesday
                    optimalUsage.push({
                        date: holiday.date.toISOString().split('T')[0],
                        days: 1,
                        reason: `Long weekend around ${holiday.name}`
                    });
                }
            }

            // If still have expiring days, suggest year-end break
            const usedSoFar = optimalUsage.reduce((sum, o) => sum + o.days, 0);
            if (expiringDays > usedSoFar) {
                optimalUsage.push({
                    date: `${currentYear}-12-23`,
                    days: Math.min(expiringDays - usedSoFar, 5),
                    reason: 'Year-end break (expiring balance)'
                });
            }
        }

        let recommendation = '';
        if (expiringDays === 0) {
            recommendation = `Great! Your ${remaining} days will carry forward. No action needed.`;
        } else if (expiringDays <= 3) {
            recommendation = `Use ${expiringDays} days before year-end to avoid losing them.`;
        } else {
            recommendation = `Urgent: ${expiringDays} days will expire! Plan to use them immediately.`;
        }

        return {
            success: true,
            optimization: {
                remainingBalance: Math.round(remaining),
                expiringDays,
                carryForwardMax,
                optimalUsage: optimalUsage.slice(0, 5),
                potentialLoss: expiringDays,
                recommendation
            }
        };

    } catch (error) {
        console.error("Year-end optimization error:", error);
        return { success: false, error: "Failed to optimize year-end leave" };
    }
}

// ============================================================================
// 9. SMART NOTIFICATION ENGINE
// Context-aware, prioritized notifications
// ============================================================================

export type SmartNotification = {
    id: string;
    type: 'critical' | 'warning' | 'info' | 'success';
    category: 'leave' | 'attendance' | 'policy' | 'team' | 'personal';
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    priority: number; // 1-100, higher is more urgent
    expiresAt?: Date;
    metadata?: Record<string, any>;
};

export async function getSmartNotifications(): Promise<{
    success: boolean;
    notifications?: SmartNotification[];
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const notifications: SmartNotification[] = [];
        const now = new Date();
        const currentYear = now.getFullYear();

        // 1. Check for expiring leave balance
        const balance = await prisma.leaveBalance.findFirst({
            where: { emp_id: employee.emp_id, year: currentYear }
        });

        if (balance) {
            const remaining = Number(balance.annual_entitlement) - Number(balance.used_days);
            const carryMax = employee.company?.carry_forward_max || 5;
            const expiring = Math.max(0, remaining - carryMax);
            
            const monthsLeft = 12 - now.getMonth();
            
            if (expiring > 0 && monthsLeft <= 3) {
                notifications.push({
                    id: 'expiring-balance',
                    type: 'critical',
                    category: 'personal',
                    title: `${expiring} Leave Days Expiring`,
                    message: `You have ${expiring} days that will expire at year-end. Plan to use them!`,
                    actionUrl: '/employee/leave/apply',
                    actionLabel: 'Apply Now',
                    priority: 90,
                    metadata: { expiringDays: expiring }
                });
            }
        }

        // 2. Check for pending requests needing action (HR)
        if (employee.role === 'hr' || employee.role === 'admin') {
            const pendingCount = await prisma.leaveRequest.count({
                where: {
                    status: 'pending',
                    employee: { org_id: employee.org_id }
                }
            });

            if (pendingCount > 0) {
                const urgentCount = await prisma.leaveRequest.count({
                    where: {
                        status: 'pending',
                        employee: { org_id: employee.org_id },
                        start_date: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
                    }
                });

                notifications.push({
                    id: 'pending-approvals',
                    type: urgentCount > 0 ? 'critical' : 'warning',
                    category: 'leave',
                    title: `${pendingCount} Pending Approval${pendingCount > 1 ? 's' : ''}`,
                    message: urgentCount > 0 
                        ? `${urgentCount} request${urgentCount > 1 ? 's' : ''} starting within 3 days!`
                        : 'Review pending leave requests',
                    actionUrl: '/hr/leave-requests',
                    actionLabel: 'Review Now',
                    priority: urgentCount > 0 ? 95 : 70
                });
            }
        }

        // 3. Check for team coverage warnings
        const teamOnLeave = await prisma.leaveRequest.count({
            where: {
                status: 'approved',
                start_date: { lte: now },
                end_date: { gte: now },
                employee: {
                    org_id: employee.org_id,
                    department: employee.department
                }
            }
        });

        const teamSize = await prisma.employee.count({
            where: { org_id: employee.org_id, department: employee.department }
        });

        if (teamSize > 0 && (teamOnLeave / teamSize) > 0.3) {
            notifications.push({
                id: 'low-coverage',
                type: 'warning',
                category: 'team',
                title: 'Low Team Coverage Today',
                message: `${teamOnLeave} of ${teamSize} team members on leave`,
                priority: 60
            });
        }

        // 4. Upcoming holiday reminder
        const nextHoliday = await prisma.holiday.findFirst({
            where: {
                company_id: employee.org_id,
                date: { gte: now }
            },
            orderBy: { date: 'asc' }
        });

        if (nextHoliday) {
            const daysUntil = Math.ceil((new Date(nextHoliday.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7) {
                notifications.push({
                    id: 'upcoming-holiday',
                    type: 'info',
                    category: 'policy',
                    title: `${nextHoliday.name} in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
                    message: `Office closed on ${new Date(nextHoliday.date).toLocaleDateString()}`,
                    priority: 30
                });
            }
        }

        // Sort by priority
        notifications.sort((a, b) => b.priority - a.priority);

        return { success: true, notifications };

    } catch (error) {
        console.error("Smart notifications error:", error);
        return { success: false, error: "Failed to get notifications" };
    }
}

// ============================================================================
// 10. TEAM SYNERGY ANALYZER
// Analyzes which team combinations work best
// ============================================================================

export type TeamSynergy = {
    combination: string[];
    synergyScore: number;
    collaborationCount: number;
    conflictCount: number;
    recommendation: string;
};

export async function analyzeTeamSynergy(): Promise<{
    success: boolean;
    synergies?: TeamSynergy[];
    insights?: string[];
    error?: string;
}> {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee?.org_id) {
            return { success: false, error: "Employee not found" };
        }

        const orgId = employee.org_id;
        const department = employee.department || 'General';

        // Get team members
        const teamMembers = await prisma.employee.findMany({
            where: { org_id: orgId, department },
            include: {
                leave_requests: {
                    where: { status: 'approved' }
                }
            }
        });

        const synergies: TeamSynergy[] = [];
        const insights: string[] = [];

        // Analyze leave overlap patterns
        for (let i = 0; i < teamMembers.length; i++) {
            for (let j = i + 1; j < teamMembers.length; j++) {
                const emp1 = teamMembers[i];
                const emp2 = teamMembers[j];

                let overlapCount = 0;
                let complementCount = 0;

                // Check for leave overlaps
                for (const leave1 of emp1.leave_requests) {
                    for (const leave2 of emp2.leave_requests) {
                        const start1 = new Date(leave1.start_date);
                        const end1 = new Date(leave1.end_date);
                        const start2 = new Date(leave2.start_date);
                        const end2 = new Date(leave2.end_date);

                        if (start1 <= end2 && end1 >= start2) {
                            overlapCount++;
                        } else {
                            complementCount++;
                        }
                    }
                }

                // Calculate synergy score
                // Lower overlap = higher synergy (they cover for each other)
                const totalInteractions = overlapCount + complementCount;
                const synergyScore = totalInteractions > 0
                    ? Math.round((complementCount / totalInteractions) * 100)
                    : 50;

                if (totalInteractions >= 2) { // Only include if enough data
                    synergies.push({
                        combination: [
                            `${emp1.first_name} ${emp1.last_name}`,
                            `${emp2.first_name} ${emp2.last_name}`
                        ],
                        synergyScore,
                        collaborationCount: complementCount,
                        conflictCount: overlapCount,
                        recommendation: synergyScore > 70
                            ? 'Great coverage pair - coordinate for backup'
                            : synergyScore < 30
                            ? 'Frequent overlap - avoid same leave periods'
                            : 'Moderate synergy'
                    });
                }
            }
        }

        // Generate insights
        const highSynergy = synergies.filter(s => s.synergyScore > 70);
        const lowSynergy = synergies.filter(s => s.synergyScore < 30);

        if (highSynergy.length > 0) {
            insights.push(`${highSynergy.length} team pairs show excellent coverage coordination`);
        }
        if (lowSynergy.length > 0) {
            insights.push(`${lowSynergy.length} pairs frequently take leave together - consider staggering`);
        }
        if (synergies.length === 0) {
            insights.push('Not enough leave data to analyze team synergy patterns');
        }

        // Sort by synergy score
        synergies.sort((a, b) => b.synergyScore - a.synergyScore);

        return { success: true, synergies: synergies.slice(0, 10), insights };

    } catch (error) {
        console.error("Team synergy error:", error);
        return { success: false, error: "Failed to analyze team synergy" };
    }
}
