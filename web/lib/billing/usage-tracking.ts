/**
 * 📊 USAGE TRACKING & ANALYTICS
 * 
 * Metered billing support + analytics dashboard data.
 * Tracks: API calls, employees, reports, logins, etc.
 */

import { prisma } from '@/lib/prisma';

export type UsageEvent = 
    | 'employee_added'
    | 'employee_removed'
    | 'leave_request'
    | 'leave_approved'
    | 'attendance_checkin'
    | 'report_generated'
    | 'api_call'
    | 'login'
    | 'ai_analysis'
    | 'document_upload';

interface UsageStats {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
}

interface OrgAnalytics {
    employees: {
        total: number;
        active: number;
        newThisMonth: number;
    };
    usage: {
        leaveRequests: UsageStats;
        attendanceRecords: UsageStats;
        apiCalls: UsageStats;
        logins: UsageStats;
    };
    trends: {
        date: string;
        employees: number;
        leaveRequests: number;
        logins: number;
    }[];
}

/**
 * Track a usage event
 */
export async function trackUsage(
    orgId: string,
    event: UsageEvent,
    quantity: number = 1,
    metadata?: Record<string, any>
): Promise<void> {
    try {
        // Use audit log as usage record since UsageRecord may not exist in schema yet
        await prisma.auditLog.create({
            data: {
                action: `USAGE_${event.toUpperCase()}`,
                entity_type: 'usage',
                entity_id: `${event}_${Date.now()}`,
                actor_type: 'system',
                actor_id: 'usage_tracker',
                target_org: orgId,
                details: {
                    event,
                    quantity,
                    ...metadata,
                },
            },
        });
    } catch (error) {
        console.error('Failed to track usage:', error);
    }
}

/**
 * Get usage count for a specific event
 */
export async function getUsageCount(
    orgId: string,
    event: UsageEvent,
    since?: Date
): Promise<number> {
    const where: any = {
        target_org: orgId,
        action: `USAGE_${event.toUpperCase()}`,
    };

    if (since) {
        where.created_at = { gte: since };
    }

    const count = await prisma.auditLog.count({ where });
    return count;
}

/**
 * Get comprehensive analytics for an organization
 */
export async function getOrgAnalytics(orgId: string): Promise<OrgAnalytics> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    
    const startOfMonth = new Date(now);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Employee stats
    const [totalEmployees, activeEmployees, newEmployees] = await Promise.all([
        prisma.employee.count({ where: { org_id: orgId } }),
        prisma.employee.count({ where: { org_id: orgId, is_active: true } }),
        prisma.employee.count({
            where: {
                org_id: orgId,
                hire_date: { gte: startOfMonth },
            },
        }),
    ]);

    // Leave request stats
    const leaveStats = await getEventStats(orgId, 'LeaveRequest', startOfToday, startOfWeek, startOfMonth);
    
    // Attendance stats  
    const attendanceStats = await getEventStats(orgId, 'Attendance', startOfToday, startOfWeek, startOfMonth);

    // API call stats (from audit log)
    const apiStats = await getUsageEventStats(orgId, 'api_call', startOfToday, startOfWeek, startOfMonth);
    
    // Login stats
    const loginStats = await getUsageEventStats(orgId, 'login', startOfToday, startOfWeek, startOfMonth);

    // 30-day trend data
    const trends = await getTrendData(orgId, 30);

    return {
        employees: {
            total: totalEmployees,
            active: activeEmployees,
            newThisMonth: newEmployees,
        },
        usage: {
            leaveRequests: leaveStats,
            attendanceRecords: attendanceStats,
            apiCalls: apiStats,
            logins: loginStats,
        },
        trends,
    };
}

async function getEventStats(
    orgId: string,
    entityType: string,
    today: Date,
    week: Date,
    month: Date
): Promise<UsageStats> {
    const baseWhere = { target_org: orgId, entity_type: entityType };

    const [total, todayCount, weekCount, monthCount] = await Promise.all([
        prisma.auditLog.count({ where: baseWhere }),
        prisma.auditLog.count({ where: { ...baseWhere, created_at: { gte: today } } }),
        prisma.auditLog.count({ where: { ...baseWhere, created_at: { gte: week } } }),
        prisma.auditLog.count({ where: { ...baseWhere, created_at: { gte: month } } }),
    ]);

    return { total, today: todayCount, thisWeek: weekCount, thisMonth: monthCount };
}

async function getUsageEventStats(
    orgId: string,
    event: UsageEvent,
    today: Date,
    week: Date,
    month: Date
): Promise<UsageStats> {
    const action = `USAGE_${event.toUpperCase()}`;
    const baseWhere = { target_org: orgId, action };

    const [total, todayCount, weekCount, monthCount] = await Promise.all([
        prisma.auditLog.count({ where: baseWhere }),
        prisma.auditLog.count({ where: { ...baseWhere, created_at: { gte: today } } }),
        prisma.auditLog.count({ where: { ...baseWhere, created_at: { gte: week } } }),
        prisma.auditLog.count({ where: { ...baseWhere, created_at: { gte: month } } }),
    ]);

    return { total, today: todayCount, thisWeek: weekCount, thisMonth: monthCount };
}

async function getTrendData(orgId: string, days: number) {
    const trends: { date: string; employees: number; leaveRequests: number; logins: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get counts for this day
        const [employees, leaveRequests, logins] = await Promise.all([
            prisma.employee.count({
                where: {
                    org_id: orgId,
                    hire_date: { lte: endOfDay },
                    is_active: true,
                },
            }),
            prisma.auditLog.count({
                where: {
                    target_org: orgId,
                    entity_type: 'LeaveRequest',
                    created_at: { gte: startOfDay, lte: endOfDay },
                },
            }),
            prisma.auditLog.count({
                where: {
                    target_org: orgId,
                    action: 'USAGE_LOGIN',
                    created_at: { gte: startOfDay, lte: endOfDay },
                },
            }),
        ]);

        trends.push({ date: dateStr, employees, leaveRequests, logins });
    }

    return trends;
}

/**
 * Get usage summary for billing display
 */
export async function getUsageSummary(orgId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [employees, apiCalls, reports, logins] = await Promise.all([
        prisma.employee.count({ where: { org_id: orgId, is_active: true } }),
        getUsageCount(orgId, 'api_call', startOfMonth),
        getUsageCount(orgId, 'report_generated', startOfMonth),
        getUsageCount(orgId, 'login', startOfMonth),
    ]);

    return {
        employees: { current: employees },
        apiCalls: { current: apiCalls },
        reports: { current: reports },
        logins: { current: logins },
    };
}
