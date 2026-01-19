/**
 * 🔒 ENTERPRISE GDPR & DATA PRIVACY MODULE
 * ========================================
 * Implements: Right to Erasure, Data Export, Consent Management, Retention Policies
 * 
 * PILLAR 10: PRIVACY & COMPLIANCE
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-logger';

// ============================================================================
// 1. DATA SUBJECT REQUEST TYPES
// ============================================================================

export type DataSubjectRequestType = 
    | 'ACCESS'          // Right to access personal data
    | 'RECTIFICATION'   // Right to correct data
    | 'ERASURE'         // Right to be forgotten
    | 'PORTABILITY'     // Right to data export
    | 'RESTRICTION'     // Right to limit processing
    | 'OBJECTION';      // Right to object to processing

export interface DataSubjectRequest {
    id: string;
    employeeId: string;
    requestType: DataSubjectRequestType;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
    requestedAt: Date;
    completedAt?: Date;
    processedBy?: string;
    notes?: string;
    responseData?: any;
}

// Request tracking store
const dataSubjectRequests: DataSubjectRequest[] = [];

// ============================================================================
// 2. RIGHT TO ACCESS - Data Export
// ============================================================================

export interface PersonalDataExport {
    exportId: string;
    employeeId: string;
    exportedAt: Date;
    format: 'JSON' | 'CSV';
    sections: string[];
    data: {
        profile: any;
        attendance: any[];
        leaveRequests: any[];
        leaveBalances: any[];
        auditLogs: any[];
    };
    checksum: string;
}

/**
 * Exports all personal data for an employee (GDPR Article 15)
 */
export async function exportPersonalData(
    employeeId: string,
    format: 'JSON' | 'CSV' = 'JSON'
): Promise<PersonalDataExport> {
    console.log(`[GDPR] Exporting personal data for employee: ${employeeId}`);
    
    const exportId = `export_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Fetch all personal data
    const employee = await prisma.employee.findUnique({
        where: { emp_id: employeeId },
        include: {
            company: {
                select: { name: true, industry: true }
            }
        }
    });
    
    if (!employee) {
        throw new Error(`Employee not found: ${employeeId}`);
    }
    
    // Fetch related data
    const [attendance, leaveRequests, leaveBalances, auditLogs] = await Promise.all([
        prisma.attendance.findMany({
            where: { emp_id: employeeId },
            orderBy: { check_in: 'desc' },
            take: 1000
        }),
        prisma.leaveRequest.findMany({
            where: { emp_id: employeeId },
            orderBy: { created_at: 'desc' }
        }),
        prisma.leaveBalance.findMany({
            where: { emp_id: employeeId }
        }),
        prisma.auditLog.findMany({
            where: { actor_id: employeeId },
            orderBy: { created_at: 'desc' },
            take: 500
        })
    ]);
    
    // Sanitize sensitive fields
    const sanitizedProfile = {
        emp_id: employee.emp_id,
        full_name: employee.full_name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        work_location: employee.work_location,
        country_code: employee.country_code,
        hire_date: employee.hire_date,
        is_active: employee.is_active,
        company: employee.company
    };
    
    const exportData = {
        profile: sanitizedProfile,
        attendance: attendance.map(a => ({
            date: a.date,
            checkIn: a.check_in,
            checkOut: a.check_out,
            workHours: a.total_hours,
            status: a.status
        })),
        leaveRequests: leaveRequests.map(lr => ({
            requestId: lr.request_id,
            type: lr.leave_type,
            startDate: lr.start_date,
            endDate: lr.end_date,
            days: lr.total_days,
            status: lr.status,
            reason: lr.reason,
            createdAt: lr.created_at
        })),
        leaveBalances: leaveBalances.map(lb => ({
            type: lb.leave_type,
            year: lb.year,
            entitlement: lb.annual_entitlement,
            used: lb.used_days,
            pending: lb.pending_days,
            remaining: Number(lb.annual_entitlement) - Number(lb.used_days) - Number(lb.pending_days)
        })),
        auditLogs: auditLogs.map(log => ({
            action: log.action,
            entityType: log.entity_type,
            createdAt: log.created_at
        }))
    };
    
    const exportJson = JSON.stringify(exportData, null, 2);
    const checksum = crypto.createHash('sha256').update(exportJson).digest('hex');
    
    const result: PersonalDataExport = {
        exportId,
        employeeId,
        exportedAt: new Date(),
        format,
        sections: ['profile', 'attendance', 'leaveRequests', 'leaveBalances', 'auditLogs'],
        data: exportData,
        checksum
    };
    
    // Log the data access
    await createAuditLog({
        actor_id: employeeId,
        actor_type: 'user',
        action: 'GDPR_DATA_EXPORT',
        entity_type: 'Employee',
        entity_id: employeeId,
        target_org: employee.org_id || 'system',
        details: {
            exportId,
            sections: result.sections,
            recordCounts: {
                attendance: attendance.length,
                leaveRequests: leaveRequests.length,
                auditLogs: auditLogs.length
            }
        }
    });
    
    console.log(`[GDPR] Data export completed: ${exportId}`);
    
    return result;
}

// ============================================================================
// 3. RIGHT TO ERASURE - Data Anonymization
// ============================================================================

export interface ErasureResult {
    requestId: string;
    employeeId: string;
    erasedAt: Date;
    affectedRecords: Record<string, number>;
    retainedForLegal: string[];
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
    notes: string;
}

/**
 * Anonymizes personal data (GDPR Article 17 - Right to be Forgotten)
 * Note: Some data must be retained for legal/regulatory requirements
 */
export async function erasePersonalData(
    employeeId: string,
    requestedBy: string,
    legalRetentionOverride: boolean = false
): Promise<ErasureResult> {
    console.log(`[GDPR] Processing erasure request for: ${employeeId}`);
    
    const requestId = `erasure_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const employee = await prisma.employee.findUnique({
        where: { emp_id: employeeId }
    });
    
    if (!employee) {
        throw new Error(`Employee not found: ${employeeId}`);
    }
    
    const affectedRecords: Record<string, number> = {};
    const retainedForLegal: string[] = [];
    
    // Generate anonymized identifiers
    const anonymizedId = `ANON_${crypto.randomBytes(8).toString('hex')}`;
    const anonymizedEmail = `${anonymizedId}@anonymized.local`;
    
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Anonymize employee record (but retain for HR/legal records)
            await tx.employee.update({
                where: { emp_id: employeeId },
                data: {
                    full_name: 'Anonymized User',
                    email: anonymizedEmail,
                    is_active: false,
                    // Keep: emp_id, org_id, hire_date for legal/payroll records
                }
            });
            affectedRecords['employee'] = 1;
            
            // 2. Count attendance records (no PII fields to anonymize in current schema)
            const attendanceCount = await tx.attendance.count({
                where: { emp_id: employeeId }
            });
            affectedRecords['attendance'] = attendanceCount;
            retainedForLegal.push('attendance_records'); // Required for payroll reconciliation
            
            // 3. Anonymize leave requests (keep for aggregate reporting)
            const leaveUpdated = await tx.leaveRequest.updateMany({
                where: { emp_id: employeeId },
                data: {
                    reason: '[REDACTED - GDPR ERASURE]'
                }
            });
            affectedRecords['leaveRequests'] = leaveUpdated.count;
            retainedForLegal.push('leave_dates_and_types'); // Required for compliance
            
            // 4. Audit logs are NEVER deleted (legal requirement)
            // But we anonymize the actor reference
            const auditUpdated = await tx.auditLog.updateMany({
                where: { actor_id: employeeId },
                data: {
                    actor_id: anonymizedId
                }
            });
            affectedRecords['auditLogs'] = auditUpdated.count;
            retainedForLegal.push('audit_trail'); // Legal requirement - 7 years
        });
        
        // Create erasure audit record
        await createAuditLog({
            actor_id: requestedBy,
            actor_type: 'user',
            action: 'GDPR_DATA_ERASURE',
            entity_type: 'Employee',
            entity_id: employeeId,
            target_org: employee.org_id || 'system',
            details: {
                requestId,
                anonymizedTo: anonymizedId,
                affectedRecords,
                retainedForLegal
            }
        });
        
        // Track the request
        dataSubjectRequests.push({
            id: requestId,
            employeeId,
            requestType: 'ERASURE',
            status: 'COMPLETED',
            requestedAt: new Date(),
            completedAt: new Date(),
            processedBy: requestedBy,
            notes: `Data anonymized to: ${anonymizedId}`
        });
        
        console.log(`[GDPR] Erasure completed: ${requestId}`);
        
        return {
            requestId,
            employeeId,
            erasedAt: new Date(),
            affectedRecords,
            retainedForLegal,
            status: 'COMPLETED',
            notes: `Personal data anonymized. Employee ID changed to ${anonymizedId}`
        };
        
    } catch (error) {
        console.error(`[GDPR] Erasure failed:`, error);
        return {
            requestId,
            employeeId,
            erasedAt: new Date(),
            affectedRecords,
            retainedForLegal,
            status: 'FAILED',
            notes: `Erasure failed: ${(error as Error).message}`
        };
    }
}

// ============================================================================
// 4. CONSENT MANAGEMENT
// ============================================================================

export interface ConsentRecord {
    id: string;
    employeeId: string;
    consentType: 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'DATA_PROCESSING' | 'MARKETING' | 'ANALYTICS';
    version: string;
    granted: boolean;
    grantedAt: Date;
    expiresAt?: Date;
    ipAddress?: string;
    userAgent?: string;
}

const consentStore: ConsentRecord[] = [];

/**
 * Records user consent
 */
export function recordConsent(
    employeeId: string,
    consentType: ConsentRecord['consentType'],
    granted: boolean,
    options: {
        version?: string;
        ipAddress?: string;
        userAgent?: string;
        expiresInDays?: number;
    } = {}
): ConsentRecord {
    const consent: ConsentRecord = {
        id: crypto.randomUUID(),
        employeeId,
        consentType,
        version: options.version || '1.0.0',
        granted,
        grantedAt: new Date(),
        expiresAt: options.expiresInDays 
            ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
            : undefined,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
    };
    
    consentStore.push(consent);
    
    console.log(`[GDPR] Consent recorded: ${consentType} = ${granted} for ${employeeId}`);
    
    return consent;
}

/**
 * Checks if user has valid consent for a specific type
 */
export function hasValidConsent(
    employeeId: string,
    consentType: ConsentRecord['consentType']
): boolean {
    const now = new Date();
    const consent = consentStore
        .filter(c => c.employeeId === employeeId && c.consentType === consentType)
        .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())[0];
    
    if (!consent) return false;
    if (!consent.granted) return false;
    if (consent.expiresAt && consent.expiresAt < now) return false;
    
    return true;
}

/**
 * Gets all consents for an employee
 */
export function getEmployeeConsents(employeeId: string): ConsentRecord[] {
    return consentStore.filter(c => c.employeeId === employeeId);
}

/**
 * Withdraws consent
 */
export function withdrawConsent(
    employeeId: string,
    consentType: ConsentRecord['consentType']
): ConsentRecord | null {
    // Record withdrawal as a new consent entry with granted=false
    return recordConsent(employeeId, consentType, false, {
        version: 'withdrawal'
    });
}

// ============================================================================
// 5. DATA RETENTION POLICIES
// ============================================================================

export interface RetentionPolicy {
    id: string;
    dataType: string;
    retentionPeriodDays: number;
    legalBasis: string;
    autoDelete: boolean;
    notifyBeforeDeleteDays: number;
}

const defaultRetentionPolicies: RetentionPolicy[] = [
    {
        id: 'pol_employee',
        dataType: 'employee_records',
        retentionPeriodDays: 2555, // 7 years after termination
        legalBasis: 'Legal obligation - Employment records',
        autoDelete: false,
        notifyBeforeDeleteDays: 90
    },
    {
        id: 'pol_attendance',
        dataType: 'attendance_records',
        retentionPeriodDays: 1095, // 3 years
        legalBasis: 'Legal obligation - Payroll records',
        autoDelete: true,
        notifyBeforeDeleteDays: 30
    },
    {
        id: 'pol_leave',
        dataType: 'leave_requests',
        retentionPeriodDays: 1095, // 3 years
        legalBasis: 'Legal obligation - HR records',
        autoDelete: true,
        notifyBeforeDeleteDays: 30
    },
    {
        id: 'pol_audit',
        dataType: 'audit_logs',
        retentionPeriodDays: 2555, // 7 years
        legalBasis: 'Legal obligation - Compliance audit trail',
        autoDelete: false,
        notifyBeforeDeleteDays: 180
    },
    {
        id: 'pol_consent',
        dataType: 'consent_records',
        retentionPeriodDays: 2555, // 7 years
        legalBasis: 'Legal obligation - GDPR consent proof',
        autoDelete: false,
        notifyBeforeDeleteDays: 180
    }
];

export function getRetentionPolicies(): RetentionPolicy[] {
    return [...defaultRetentionPolicies];
}

export function getRetentionPolicy(dataType: string): RetentionPolicy | undefined {
    return defaultRetentionPolicies.find(p => p.dataType === dataType);
}

// ============================================================================
// 6. DATA SUBJECT REQUEST MANAGEMENT
// ============================================================================

export function createDataSubjectRequest(
    employeeId: string,
    requestType: DataSubjectRequestType
): DataSubjectRequest {
    const request: DataSubjectRequest = {
        id: crypto.randomUUID(),
        employeeId,
        requestType,
        status: 'PENDING',
        requestedAt: new Date()
    };
    
    dataSubjectRequests.push(request);
    
    console.log(`[GDPR] Data subject request created: ${request.id} (${requestType})`);
    
    return request;
}

export function getDataSubjectRequests(
    filters?: { employeeId?: string; status?: DataSubjectRequest['status'] }
): DataSubjectRequest[] {
    return dataSubjectRequests.filter(req => {
        if (filters?.employeeId && req.employeeId !== filters.employeeId) return false;
        if (filters?.status && req.status !== filters.status) return false;
        return true;
    });
}

export function updateDataSubjectRequest(
    requestId: string,
    update: Partial<Pick<DataSubjectRequest, 'status' | 'processedBy' | 'notes' | 'responseData'>>
): DataSubjectRequest | null {
    const request = dataSubjectRequests.find(r => r.id === requestId);
    if (!request) return null;
    
    Object.assign(request, update);
    
    if (update.status === 'COMPLETED') {
        request.completedAt = new Date();
    }
    
    return request;
}

// ============================================================================
// 7. COMPLIANCE DASHBOARD DATA
// ============================================================================

export function getComplianceStatus(): {
    totalEmployees: number;
    dataSubjectRequests: {
        pending: number;
        completed: number;
        total: number;
    };
    consentStats: Record<string, { granted: number; withdrawn: number }>;
    retentionPolicies: number;
    lastAudit?: Date;
} {
    const consentStats: Record<string, { granted: number; withdrawn: number }> = {};
    
    for (const consent of consentStore) {
        if (!consentStats[consent.consentType]) {
            consentStats[consent.consentType] = { granted: 0, withdrawn: 0 };
        }
        if (consent.granted) {
            consentStats[consent.consentType].granted++;
        } else {
            consentStats[consent.consentType].withdrawn++;
        }
    }
    
    return {
        totalEmployees: 0, // Would come from DB
        dataSubjectRequests: {
            pending: dataSubjectRequests.filter(r => r.status === 'PENDING').length,
            completed: dataSubjectRequests.filter(r => r.status === 'COMPLETED').length,
            total: dataSubjectRequests.length
        },
        consentStats,
        retentionPolicies: defaultRetentionPolicies.length,
        lastAudit: new Date()
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    // Data Export
    exportPersonalData,
    
    // Data Erasure
    erasePersonalData,
    
    // Consent Management
    recordConsent,
    hasValidConsent,
    getEmployeeConsents,
    withdrawConsent,
    
    // Retention Policies
    getRetentionPolicies,
    getRetentionPolicy,
    
    // Data Subject Requests
    createDataSubjectRequest,
    getDataSubjectRequests,
    updateDataSubjectRequest,
    
    // Compliance
    getComplianceStatus
};
