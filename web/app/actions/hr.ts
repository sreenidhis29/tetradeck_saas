"use server";

import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function getHRDashboardStats() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        // 1. Get Logged-In HR Employee
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee || !employee.company) {
            return { success: false, error: "No organization found." };
        }

        const orgId = employee.company.id;

        // 2. Aggregate Stats
        const [totalEmployees, pendingLeaves, activeLeaves] = await Promise.all([
            // Total Employees
            prisma.employee.count({
                where: {
                    org_id: orgId,
                    clerk_id: { not: user.id } // Exclude the admin themselves
                }
            }),
            // Pending Requests (Pending + Escalated)
            prisma.leaveRequest.count({
                where: {
                    employee: { org_id: orgId },
                    status: { in: ['pending', 'escalated'] }
                }
            }),
            // On Leave Today (Approvals intersecting today)
            prisma.leaveRequest.count({
                where: {
                    employee: { org_id: orgId },
                    status: "approved",
                    start_date: { lte: new Date() },
                    end_date: { gte: new Date() }
                }
            })
        ]);

        // 3. Get Recent Pending Requests (Needs Attention)
        const needsAttention = await prisma.leaveRequest.findMany({
            where: {
                employee: { org_id: orgId },
                status: { in: ['pending', 'escalated'] }
            },
            take: 3,
            orderBy: { created_at: 'asc' },
            include: {
                employee: {
                    select: {
                        full_name: true,
                        position: true
                    }
                }
            }
        });

        return {
            success: true,
            data: {
                companyName: employee.company.name,
                totalEmployees,
                pendingLeaves,
                activeLeaves,
                needsAttention: needsAttention.map(req => ({
                    id: req.request_id, // Fixed: request_id not id
                    employeeName: req.employee.full_name,
                    position: req.employee.position,
                    type: req.leave_type,
                    days: req.total_days.toString(), // Decimal to string
                    startDate: req.start_date
                }))
            }
        };

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return { success: false, error: "Failed to fetch dashboard data." };
    }
}

export async function getCompanyDetails() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: { company: true }
        });

        if (!employee || !employee.company) {
            return { success: false, error: "No organization found." };
        }

        return { success: true, company: employee.company, employee: employee };
    } catch (error) {
        return { success: false, error: "Failed to fetch company details." };
    }
}

/* =========================================================================
   3. ACTIVITY FEED
   Fetches recent audit logs for the company.
   ========================================================================= */
export async function getCompanyActivity() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true }
        });

        if (!employee || !employee.org_id) {
            return { success: false, error: "No organization found." };
        }

        const activities = await prisma.auditLog.findMany({
            where: { target_org: employee.org_id },
            orderBy: { created_at: 'desc' },
            take: 20,
            include: {
                actor: {
                    select: { full_name: true }
                }
            }
        });

        return {
            success: true,
            activities: activities.map(log => ({
                id: log.id,
                action: log.action,
                created_at: log.created_at,
                actor_name: log.actor?.full_name || (log.details as any)?.actor_name || 'System',
                change_summary: (log.details as any)?.summary || log.action
            }))
        };
    } catch (error) {
        console.error("Activity Feed Error:", error);
        return { success: false, error: "Failed to fetch activity." };
    }
}

/* =========================================================================
   4. LEAVE REQUESTS
   Fetches filtered leave requests.
   ========================================================================= */
export async function getLeaveRequests(filter: 'all' | 'pending') {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true }
        });

        if (!employee || !employee.org_id) {
            return { success: false, error: "No organization found." };
        }

        const whereClause: any = {
            employee: { org_id: employee.org_id } // Filter by company
        };

        // FIX: "Pending" should include "Escalated" so HR can act on them
        // "All" is treated as History (Approved/Rejected)
        if (filter === 'pending') {
            whereClause.status = { in: ['pending', 'escalated'] };
        } else {
            // History tab: Show resolved requests
            whereClause.status = { in: ['approved', 'rejected'] };
        }

        const requests = await prisma.leaveRequest.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' },
            include: {
                employee: {
                    select: { full_name: true }
                }
            }
        });

        return {
            success: true,
            requests: requests.map(req => ({
                request_id: req.request_id,
                employee_name: req.employee.full_name,
                leave_type: req.leave_type,
                start_date: req.start_date,
                end_date: req.end_date,
                total_days: req.total_days.toString(),
                reason: req.reason,
                status: req.status,
                is_half_day: req.is_half_day || false,
                ai_analysis: req.ai_analysis_json // Pass full AI results
            }))
        };
    } catch (error) {
        console.error("Leave Requests Error:", error);
        return { success: false, error: "Failed to fetch leave requests." };
    }
}

/* =========================================================================
   4B. GET ESCALATION DETAIL
   Get details of a specific escalated request by ID
   ========================================================================= */
export async function getEscalationDetail(requestId: string) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const request = await prisma.leaveRequest.findUnique({
            where: { request_id: requestId },
            include: {
                employee: {
                    select: { full_name: true, department: true, email: true }
                }
            }
        });

        if (!request) {
            return { success: false, error: "Request not found" };
        }

        return {
            success: true,
            escalation: {
                request_id: request.request_id,
                employee_name: request.employee.full_name,
                department: request.employee.department,
                email: request.employee.email,
                leave_type: request.leave_type,
                start_date: request.start_date,
                end_date: request.end_date,
                total_days: Number(request.total_days),
                reason: request.reason,
                status: request.status,
                is_half_day: request.is_half_day || false,
                ai_recommendation: request.ai_recommendation,
                ai_confidence: request.ai_confidence ? Number(request.ai_confidence) : 0.5,
                ai_analysis: request.ai_analysis_json,
                created_at: request.created_at
            }
        };
    } catch (error) {
        console.error("Escalation Detail Error:", error);
        return { success: false, error: "Failed to fetch escalation details" };
    }
}

/* =========================================================================
   5. UPDATE REQUEST STATUS
   Approve or Reject a leave request with email notification.
   ========================================================================= */
import { revalidatePath } from "next/cache";
import { sendLeaveApprovalEmail, sendLeaveRejectionEmail } from "@/lib/email-service";

export async function updateLeaveRequestStatus(
    requestId: string, 
    status: 'approved' | 'rejected',
    hrReason?: string
) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        // 1. Get HR employee making the decision
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { full_name: true }
        });

        // 2. Fetch Request Details FIRST to get days/type for balance update
        const request = await prisma.leaveRequest.findUnique({
            where: { request_id: requestId },
            include: { employee: true }
        });

        if (!request) return { success: false, error: "Request not found" };

        const currentYear = new Date().getFullYear();
        const leaveTypeKey = request.leave_type.toLowerCase().replace(" leave", "") === "annual" ? "vacation" :
            request.leave_type.toLowerCase().replace(" leave", "");

        // Generate explanation for the decision
        const decisionReason = hrReason || (status === 'approved' 
            ? `Leave request approved by HR. Your ${request.leave_type} from ${request.start_date.toLocaleDateString()} to ${request.end_date.toLocaleDateString()} has been confirmed.`
            : `Leave request declined. Please contact HR for more information or submit a new request with adjusted dates.`);

        // 3. Perform Transaction: Update Request + Update Balance
        await prisma.$transaction(async (tx) => {
            // A. Update Status with reason stored in reason field (since hr_notes doesn't exist in schema)
            await tx.leaveRequest.update({
                where: { request_id: requestId },
                data: {
                    status: status,
                    current_approver: status === 'approved' ? 'Resolved' : null,
                    // Store decision reason in ai_analysis_json for reference
                    ai_analysis_json: {
                        ...(request.ai_analysis_json as object || {}),
                        hr_decision: decisionReason,
                        decided_at: new Date().toISOString()
                    }
                }
            });

            // B. Update Balance
            const currentBalance = await tx.leaveBalance.findFirst({
                where: {
                    emp_id: request.emp_id,
                    leave_type: leaveTypeKey,
                    year: currentYear
                }
            });

            if (status === 'approved') {
                if (currentBalance) {
                    // Move Pending -> Used
                    await tx.leaveBalance.update({
                        where: { balance_id: currentBalance.balance_id },
                        data: {
                            pending_days: { decrement: request.total_days },
                            used_days: { increment: request.total_days }
                        }
                    });
                } else {
                    // Create new record with used_days
                    await tx.leaveBalance.create({
                        data: {
                            emp_id: request.emp_id,
                            country_code: request.country_code,
                            leave_type: leaveTypeKey,
                            year: currentYear,
                            annual_entitlement: 20,
                            carried_forward: 0,
                            used_days: request.total_days,
                            pending_days: 0
                        }
                    });
                }
            } else {
                // Rejected: Remove from Pending if it exists
                if (currentBalance) {
                    await tx.leaveBalance.update({
                        where: { balance_id: currentBalance.balance_id },
                        data: {
                            pending_days: { decrement: request.total_days }
                        }
                    });
                }
            }

            // C. Log Activity with explanation
            await tx.auditLog.create({
                data: {
                    action: status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
                    entity_type: 'LeaveRequest',
                    entity_id: requestId,
                    actor_id: request.employee.emp_id,
                    target_org: request.employee.org_id!,
                    details: {
                        status: status,
                        reason: decisionReason,
                        decided_by: hrEmployee?.full_name || 'HR System',
                        leave_type: request.leave_type,
                        days: Number(request.total_days)
                    }
                }
            });
        });

        // 4. Send Email Notification (async, non-blocking)
        const emailPromise = status === 'approved'
            ? sendLeaveApprovalEmail(
                { email: request.employee.email, full_name: request.employee.full_name },
                {
                    leaveType: request.leave_type,
                    startDate: request.start_date.toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    }),
                    endDate: request.end_date.toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    }),
                    totalDays: Number(request.total_days),
                    approvedBy: hrEmployee?.full_name || 'HR System',
                    reason: decisionReason
                }
            )
            : sendLeaveRejectionEmail(
                { email: request.employee.email, full_name: request.employee.full_name },
                {
                    leaveType: request.leave_type,
                    startDate: request.start_date.toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    }),
                    endDate: request.end_date.toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    }),
                    rejectedBy: hrEmployee?.full_name || 'HR System',
                    reason: decisionReason
                }
            );

        // Don't await email - let it send in background
        emailPromise.catch(err => console.error('Email send failed:', err));

        revalidatePath('/hr/leave-requests');
        revalidatePath('/hr/dashboard');

        return { 
            success: true, 
            explanation: `Leave request ${status}. Email notification sent to ${request.employee.email}. Reason: ${decisionReason}`
        };
    } catch (error) {
        console.error("Update Status Error:", error);
        return { success: false, error: "Failed to update status." };
    }
}

/* =========================================================================
   6. EMPLOYEE MANAGEMENT
   Fetch all employees for the company.
   ========================================================================= */
export async function getCompanyEmployees() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true }
        });

        if (!employee || !employee.org_id) {
            return { success: false, error: "No organization found." };
        }

        const employees = await prisma.employee.findMany({
            where: {
                org_id: employee.org_id,
                role: { notIn: ['hr', 'admin'] }
            },
            orderBy: { full_name: 'asc' },
            include: {
                company: true
            }
        });

        return {
            success: true,
            employees: employees.map(emp => ({
                emp_id: emp.emp_id,
                full_name: emp.full_name,
                email: emp.email,
                department: emp.department || 'Unassigned',
                position: emp.position || 'Employee',
                location: emp.work_location || 'Remote',
                join_date: emp.hire_date,
                status: emp.is_active ? 'Active' : 'Inactive'
            }))
        };
    } catch (error) {
        console.error("Fetch Employees Error:", error);
        return { success: false, error: "Failed to fetch employees." };
    }
}

// ============================================================
// ATTENDANCE MONITORING FOR HR
// ============================================================

export async function getMissingCheckIns() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!hrEmployee || !hrEmployee.org_id) {
            return { success: false, error: "No organization found." };
        }

        if (!['hr', 'admin', 'manager'].includes(hrEmployee.role?.toLowerCase() || '')) {
            return { success: false, error: "Unauthorized: HR access required" };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active employees in the organization
        const allEmployees = await prisma.employee.findMany({
            where: {
                org_id: hrEmployee.org_id,
                is_active: true
            },
            select: {
                emp_id: true,
                full_name: true,
                email: true,
                department: true
            }
        });

        // Get employees who have checked in today
        const checkedInToday = await prisma.attendance.findMany({
            where: {
                date: today,
                check_in: { not: null }
            },
            select: {
                emp_id: true
            }
        });

        // Get employees on approved leave today
        const onLeaveToday = await prisma.leaveRequest.findMany({
            where: {
                status: 'approved',
                start_date: { lte: today },
                end_date: { gte: today }
            },
            select: {
                emp_id: true
            }
        });

        const checkedInIds = new Set(checkedInToday.map(a => a.emp_id));
        const onLeaveIds = new Set(onLeaveToday.map(l => l.emp_id));

        // Filter employees who haven't checked in and are not on leave
        const missingCheckIns = allEmployees.filter(emp => 
            !checkedInIds.has(emp.emp_id) && !onLeaveIds.has(emp.emp_id)
        );

        return {
            success: true,
            missing: missingCheckIns,
            total: allEmployees.length,
            checkedIn: checkedInIds.size,
            onLeave: onLeaveIds.size
        };
    } catch (error) {
        console.error("Missing Check-ins Error:", error);
        return { success: false, error: "Failed to fetch missing check-ins" };
    }
}

export async function markEmployeeAbsent(empId: string, markAsLeave: boolean) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true, full_name: true }
        });

        if (!hrEmployee || !['hr', 'admin', 'manager'].includes(hrEmployee.role?.toLowerCase() || '')) {
            return { success: false, error: "Unauthorized: HR access required" };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (markAsLeave) {
            // Create a casual leave request for the employee
            const employee = await prisma.employee.findUnique({
                where: { emp_id: empId },
                include: { leave_balances: { where: { leave_type: 'casual' } } }
            });

            if (!employee) {
                return { success: false, error: "Employee not found" };
            }

            // Create leave request with all required fields
            await prisma.leaveRequest.create({
                data: {
                    request_id: `ABSENT-${Date.now()}`,
                    emp_id: empId,
                    country_code: employee.country_code || 'IN',
                    leave_type: 'Casual Leave',
                    start_date: today,
                    end_date: today,
                    total_days: 1,
                    working_days: 1,
                    reason: `Marked absent by HR (${hrEmployee.full_name})`,
                    status: 'approved',
                    ai_recommendation: 'approve',
                    ai_confidence: 1.0
                }
            });

            // Update leave balance using the unique composite key
            const casualBalance = await prisma.leaveBalance.findUnique({
                where: {
                    emp_id_leave_type_year: {
                        emp_id: empId,
                        leave_type: 'casual',
                        year: new Date().getFullYear()
                    }
                }
            });

            if (casualBalance) {
                await prisma.leaveBalance.update({
                    where: { balance_id: casualBalance.balance_id },
                    data: { used_days: { increment: 1 } }
                });
            }

            // Create attendance record as absent
            await prisma.attendance.upsert({
                where: {
                    emp_id_date: { emp_id: empId, date: today }
                },
                create: {
                    emp_id: empId,
                    date: today,
                    status: 'ABSENT'
                },
                update: {
                    status: 'ABSENT'
                }
            });

            return { success: true, message: `${employee.full_name} marked absent under Casual Leave` };
        } else {
            // Just mark attendance as present (HR confirmed they're working)
            const now = new Date();
            
            await prisma.attendance.upsert({
                where: {
                    emp_id_date: { emp_id: empId, date: today }
                },
                create: {
                    emp_id: empId,
                    date: today,
                    check_in: now,
                    status: 'PRESENT'
                },
                update: {
                    check_in: now,
                    status: 'PRESENT'
                }
            });

            return { success: true, message: "Employee marked as present" };
        }
    } catch (error) {
        console.error("Mark Absent Error:", error);
        return { success: false, error: "Failed to mark employee" };
    }
}

export async function getAttendanceOverview() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        const hrEmployee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true }
        });

        if (!hrEmployee || !hrEmployee.org_id) {
            return { success: false, error: "No organization found." };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalEmployees,
            presentToday,
            lateToday,
            absentToday,
            onLeaveToday
        ] = await Promise.all([
            prisma.employee.count({
                where: { org_id: hrEmployee.org_id, is_active: true }
            }),
            prisma.attendance.count({
                where: { date: today, status: 'PRESENT' }
            }),
            prisma.attendance.count({
                where: { date: today, status: 'LATE' }
            }),
            prisma.attendance.count({
                where: { date: today, status: 'ABSENT' }
            }),
            prisma.leaveRequest.count({
                where: {
                    status: 'approved',
                    start_date: { lte: today },
                    end_date: { gte: today }
                }
            })
        ]);

        return {
            success: true,
            overview: {
                totalEmployees,
                presentToday,
                lateToday,
                absentToday,
                onLeaveToday,
                notCheckedIn: totalEmployees - presentToday - lateToday - absentToday - onLeaveToday
            }
        };
    } catch (error) {
        console.error("Attendance Overview Error:", error);
        return { success: false, error: "Failed to fetch attendance overview" };
    }
}
