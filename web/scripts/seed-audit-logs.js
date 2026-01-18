const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

async function seedAuditLogs() {
    const prisma = new PrismaClient();
    
    try {
        console.log('Seeding real audit logs...');
        
        // Get real employees from the database
        const employees = await prisma.employee.findMany({
            take: 10,
            select: {
                emp_id: true,
                full_name: true,
                role: true,
                org_id: true
            }
        });
        
        if (employees.length === 0) {
            console.log('No employees found in database. Cannot seed audit logs.');
            return;
        }
        
        console.log(`Found ${employees.length} employees`);
        
        // Get real leave requests
        const leaveRequests = await prisma.leaveRequest.findMany({
            take: 20,
            select: {
                request_id: true,
                emp_id: true,
                leave_type: true,
                status: true,
                start_date: true,
                end_date: true
            }
        });
        
        console.log(`Found ${leaveRequests.length} leave requests`);
        
        // Get org_id from first employee
        const orgId = employees[0]?.org_id;
        
        if (!orgId) {
            console.log('No org_id found. Checking companies...');
            const company = await prisma.company.findFirst();
            if (!company) {
                console.log('No company found. Cannot seed audit logs.');
                return;
            }
        }
        
        const targetOrg = orgId || (await prisma.company.findFirst())?.id;
        
        if (!targetOrg) {
            console.log('No target organization found. Cannot seed audit logs.');
            return;
        }
        
        console.log(`Using target org: ${targetOrg}`);
        
        // Define realistic audit actions
        const auditEvents = [];
        const now = new Date();
        
        // Generate audit logs based on real data
        employees.forEach((emp, idx) => {
            // Login event
            auditEvents.push({
                action: 'USER_LOGIN',
                entity_type: 'Session',
                entity_id: `session_${crypto.randomBytes(8).toString('hex')}`,
                actor_id: emp.emp_id,
                target_org: targetOrg,
                details: {
                    actor_type: 'user',
                    actor_role: emp.role,
                    resource_name: `Login from ${emp.full_name}`,
                    ip_address: `192.168.1.${100 + idx}`,
                    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    request_id: `req_${crypto.randomBytes(4).toString('hex')}`,
                    integrity_hash: `sha256:${crypto.randomBytes(16).toString('hex')}`
                },
                created_at: new Date(now.getTime() - (idx * 3600000)) // Stagger by hours
            });
        });
        
        // Leave request events
        leaveRequests.forEach((lr, idx) => {
            const employee = employees.find(e => e.emp_id === lr.emp_id) || employees[0];
            const hrEmployee = employees.find(e => e.role === 'hr_manager') || employees[0];
            
            // Leave created event
            auditEvents.push({
                action: 'LEAVE_REQUEST_CREATED',
                entity_type: 'LeaveRequest',
                entity_id: lr.request_id,
                actor_id: lr.emp_id,
                target_org: targetOrg,
                details: {
                    actor_type: 'user',
                    actor_role: employee?.role || 'employee',
                    resource_name: `${lr.leave_type} Leave Request`,
                    new_state: {
                        status: 'pending',
                        leave_type: lr.leave_type,
                        start_date: lr.start_date,
                        end_date: lr.end_date
                    },
                    request_id: `req_${crypto.randomBytes(4).toString('hex')}`,
                    integrity_hash: `sha256:${crypto.randomBytes(16).toString('hex')}`
                },
                created_at: new Date(now.getTime() - (idx * 2 * 3600000))
            });
            
            // AI Analysis event - use HR employee as actor (since AI actor doesn't exist)
            const decision = lr.status === 'approved' ? 'approved' : lr.status === 'rejected' ? 'rejected' : 'pending_review';
            const confidence = 0.75 + Math.random() * 0.24;
            
            auditEvents.push({
                action: 'LEAVE_REQUEST_ANALYZED',
                entity_type: 'LeaveRequest',
                entity_id: lr.request_id,
                actor_id: hrEmployee.emp_id, // Use real employee ID for FK constraint
                target_org: targetOrg,
                details: {
                    actor_type: 'ai',
                    actor_role: 'ai_service',
                    actor_name: 'Constraint Engine', // Store actual AI actor name in details
                    resource_name: `AI Analysis: ${lr.leave_type} Leave`,
                    decision: decision,
                    decision_reason: decision === 'approved' 
                        ? 'All business rules satisfied. Sufficient leave balance and team coverage maintained.'
                        : decision === 'rejected'
                            ? 'Insufficient leave balance or team coverage constraint violated.'
                            : 'Requires manual review due to policy edge case.',
                    confidence_score: confidence,
                    model_version: 'constraint-engine-v2.1.0',
                    rules_evaluated: ['RULE001', 'RULE002', 'RULE003', 'RULE004', 'RULE005'],
                    request_id: `req_${crypto.randomBytes(4).toString('hex')}`,
                    integrity_hash: `sha256:${crypto.randomBytes(16).toString('hex')}`
                },
                created_at: new Date(now.getTime() - (idx * 2 * 3600000) + 60000) // 1 min after creation
            });
            
            // Status update event if approved/rejected
            if (lr.status === 'approved' || lr.status === 'rejected') {
                auditEvents.push({
                    action: lr.status === 'approved' ? 'LEAVE_REQUEST_APPROVED' : 'LEAVE_REQUEST_REJECTED',
                    entity_type: 'LeaveRequest',
                    entity_id: lr.request_id,
                    actor_id: hrEmployee.emp_id,
                    target_org: targetOrg,
                    details: {
                        actor_type: 'user',
                        actor_role: hrEmployee.role,
                        resource_name: `${lr.leave_type} Leave - ${lr.status}`,
                        previous_state: { status: 'pending' },
                        new_state: { status: lr.status },
                        request_id: `req_${crypto.randomBytes(4).toString('hex')}`,
                        integrity_hash: `sha256:${crypto.randomBytes(16).toString('hex')}`
                    },
                    created_at: new Date(now.getTime() - (idx * 2 * 3600000) + 120000) // 2 min after creation
                });
            }
        });
        
        // Add system events - use first employee as actor for FK constraint
        const systemActor = employees[0];
        
        auditEvents.push({
            action: 'ATTENDANCE_REMINDER_SENT',
            entity_type: 'Notification',
            entity_id: `notif_${crypto.randomBytes(8).toString('hex')}`,
            actor_id: systemActor.emp_id,
            target_org: targetOrg,
            details: {
                actor_type: 'system',
                actor_role: 'system',
                actor_name: 'System Scheduler',
                resource_name: 'Morning Check-in Reminder',
                request_id: `req_${crypto.randomBytes(4).toString('hex')}`,
                integrity_hash: `sha256:${crypto.randomBytes(16).toString('hex')}`
            },
            created_at: new Date(now.getTime() - 7200000)
        });
        
        auditEvents.push({
            action: 'SCHEDULED_TASK_RUN',
            entity_type: 'System',
            entity_id: 'task_leave_balance_sync',
            actor_id: systemActor.emp_id,
            target_org: targetOrg,
            details: {
                actor_type: 'system',
                actor_role: 'system',
                actor_name: 'System Scheduler',
                resource_name: 'Leave Balance Synchronization',
                request_id: `req_${crypto.randomBytes(4).toString('hex')}`,
                integrity_hash: `sha256:${crypto.randomBytes(16).toString('hex')}`
            },
            created_at: new Date(now.getTime() - 3600000)
        });
        
        console.log(`Creating ${auditEvents.length} audit log entries...`);
        
        // Insert all audit events
        for (const event of auditEvents) {
            await prisma.auditLog.create({
                data: event
            });
        }
        
        console.log('✓ Successfully seeded audit logs!');
        
        // Verify
        const count = await prisma.auditLog.count();
        console.log(`Total audit logs in database: ${count}`);
        
    } catch (error) {
        console.error('Error seeding audit logs:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedAuditLogs();
