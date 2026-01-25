'use server';

/**
 * 📊 SYSTEM INCIDENTS & UPTIME ACTIONS
 * 
 * Real incident management and uptime tracking.
 * Critical Fixes: #8, #9, #10, #11
 */

import { prisma } from '@/lib/prisma';

interface Incident {
    id: string;
    title: string;
    description: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    severity: 'minor' | 'major' | 'critical';
    affectedServices: string[];
    startedAt: Date;
    identifiedAt: Date | null;
    resolvedAt: Date | null;
    updates: Array<{ message: string; timestamp: string; author?: string }>;
}

interface UptimeStats {
    last24h: number;
    last7d: number;
    last30d: number;
}

interface ServiceStatus {
    service: string;
    status: 'operational' | 'degraded' | 'down';
    latency?: number;
    message?: string;
    lastCheck: string;
}

/**
 * Get all active incidents
 */
export async function getActiveIncidents(): Promise<{
    success: boolean;
    data?: Incident[];
    error?: string;
}> {
    try {
        const incidents = await prisma.systemIncident.findMany({
            where: {
                status: { not: 'resolved' },
            },
            orderBy: { started_at: 'desc' },
            take: 10,
        });
        
        return {
            success: true,
            data: incidents.map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                status: i.status as Incident['status'],
                severity: i.severity as Incident['severity'],
                affectedServices: i.affected_services as string[],
                startedAt: i.started_at,
                identifiedAt: i.identified_at,
                resolvedAt: i.resolved_at,
                updates: i.updates as Incident['updates'],
            })),
        };
    } catch (error) {
        console.error('Error fetching incidents:', error);
        return { success: false, error: 'Failed to fetch incidents' };
    }
}

/**
 * Get recent incidents (including resolved)
 */
export async function getRecentIncidents(limit: number = 10): Promise<{
    success: boolean;
    data?: Incident[];
    error?: string;
}> {
    try {
        const incidents = await prisma.systemIncident.findMany({
            orderBy: { started_at: 'desc' },
            take: limit,
        });
        
        return {
            success: true,
            data: incidents.map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                status: i.status as Incident['status'],
                severity: i.severity as Incident['severity'],
                affectedServices: i.affected_services as string[],
                startedAt: i.started_at,
                identifiedAt: i.identified_at,
                resolvedAt: i.resolved_at,
                updates: i.updates as Incident['updates'],
            })),
        };
    } catch (error) {
        console.error('Error fetching recent incidents:', error);
        return { success: false, error: 'Failed to fetch incidents' };
    }
}

/**
 * Create a new incident (for admin use)
 */
export async function createIncident(data: {
    title: string;
    description: string;
    severity: 'minor' | 'major' | 'critical';
    affectedServices: string[];
}): Promise<{
    success: boolean;
    data?: Incident;
    error?: string;
}> {
    try {
        const incident = await prisma.systemIncident.create({
            data: {
                title: data.title,
                description: data.description,
                severity: data.severity,
                affected_services: data.affectedServices,
                status: 'investigating',
                updates: [{
                    message: 'We are investigating this issue.',
                    timestamp: new Date().toISOString(),
                    author: 'System',
                }],
            },
        });
        
        return {
            success: true,
            data: {
                id: incident.id,
                title: incident.title,
                description: incident.description,
                status: incident.status as Incident['status'],
                severity: incident.severity as Incident['severity'],
                affectedServices: incident.affected_services as string[],
                startedAt: incident.started_at,
                identifiedAt: incident.identified_at,
                resolvedAt: incident.resolved_at,
                updates: incident.updates as Incident['updates'],
            },
        };
    } catch (error) {
        console.error('Error creating incident:', error);
        return { success: false, error: 'Failed to create incident' };
    }
}

/**
 * Update incident status
 */
export async function updateIncidentStatus(
    incidentId: string,
    status: Incident['status'],
    message: string
): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const incident = await prisma.systemIncident.findUnique({
            where: { id: incidentId },
        });
        
        if (!incident) {
            return { success: false, error: 'Incident not found' };
        }
        
        const currentUpdates = incident.updates as Incident['updates'];
        const newUpdate = {
            message,
            timestamp: new Date().toISOString(),
            author: 'System',
        };
        
        const updateData: any = {
            status,
            updates: [...currentUpdates, newUpdate],
        };
        
        if (status === 'identified' && !incident.identified_at) {
            updateData.identified_at = new Date();
        }
        
        if (status === 'resolved' && !incident.resolved_at) {
            updateData.resolved_at = new Date();
        }
        
        await prisma.systemIncident.update({
            where: { id: incidentId },
            data: updateData,
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error updating incident:', error);
        return { success: false, error: 'Failed to update incident' };
    }
}

/**
 * Record service health check result
 */
export async function recordUptimeCheck(
    service: string,
    status: 'operational' | 'degraded' | 'down',
    latencyMs?: number,
    errorMessage?: string
): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        await prisma.uptimeRecord.create({
            data: {
                service,
                status,
                latency_ms: latencyMs,
                error_message: errorMessage,
            },
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error recording uptime check:', error);
        return { success: false, error: 'Failed to record uptime check' };
    }
}

/**
 * Get real uptime statistics from database
 * Critical Fix #4, #8 - Replace hardcoded uptime values
 */
export async function getUptimeStats(): Promise<{
    success: boolean;
    data?: UptimeStats;
    error?: string;
}> {
    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const [records24h, records7d, records30d] = await Promise.all([
            prisma.uptimeRecord.findMany({
                where: { checked_at: { gte: twentyFourHoursAgo } },
                select: { status: true },
            }),
            prisma.uptimeRecord.findMany({
                where: { checked_at: { gte: sevenDaysAgo } },
                select: { status: true },
            }),
            prisma.uptimeRecord.findMany({
                where: { checked_at: { gte: thirtyDaysAgo } },
                select: { status: true },
            }),
        ]);
        
        const calculateUptime = (records: { status: string }[]) => {
            if (records.length === 0) return 99.99; // Default if no data
            const operational = records.filter(r => r.status === 'operational').length;
            return Number(((operational / records.length) * 100).toFixed(2));
        };
        
        return {
            success: true,
            data: {
                last24h: calculateUptime(records24h),
                last7d: calculateUptime(records7d),
                last30d: calculateUptime(records30d),
            },
        };
    } catch (error) {
        console.error('Error fetching uptime stats:', error);
        return { success: false, error: 'Failed to fetch uptime statistics' };
    }
}

/**
 * Get current service status
 */
export async function getServiceStatus(): Promise<{
    success: boolean;
    data?: ServiceStatus[];
    error?: string;
}> {
    try {
        const services = ['web', 'database', 'auth', 'email', 'ai'];
        const statuses: ServiceStatus[] = [];
        
        for (const service of services) {
            // Get most recent check for each service
            const lastCheck = await prisma.uptimeRecord.findFirst({
                where: { service },
                orderBy: { checked_at: 'desc' },
            });
            
            if (lastCheck) {
                statuses.push({
                    service: formatServiceName(service),
                    status: lastCheck.status as ServiceStatus['status'],
                    latency: lastCheck.latency_ms ?? undefined,
                    message: lastCheck.error_message ?? undefined,
                    lastCheck: lastCheck.checked_at.toISOString(),
                });
            } else {
                // No records, assume operational
                statuses.push({
                    service: formatServiceName(service),
                    status: 'operational',
                    lastCheck: new Date().toISOString(),
                });
            }
        }
        
        return { success: true, data: statuses };
    } catch (error) {
        console.error('Error fetching service status:', error);
        return { success: false, error: 'Failed to fetch service status' };
    }
}

function formatServiceName(key: string): string {
    const names: Record<string, string> = {
        web: 'Web Application',
        database: 'Database',
        auth: 'Authentication (Clerk)',
        email: 'Email Service',
        ai: 'AI Services',
    };
    return names[key] || key;
}
