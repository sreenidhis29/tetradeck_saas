import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Verify HR role
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            select: { role: true, org_id: true }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
        }

        if (employee.role !== 'hr' && employee.role !== 'admin') {
            return NextResponse.json({ success: false, error: "Unauthorized - HR access required" }, { status: 403 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get leave statistics - filter by employee's organization through employee relation
        const [totalRequests, approved, rejected, pending] = await Promise.all([
            prisma.leaveRequest.count({ where: { employee: { org_id: employee.org_id } } }),
            prisma.leaveRequest.count({ where: { employee: { org_id: employee.org_id }, status: 'approved' } }),
            prisma.leaveRequest.count({ where: { employee: { org_id: employee.org_id }, status: 'rejected' } }),
            prisma.leaveRequest.count({ where: { employee: { org_id: employee.org_id }, status: 'pending' } })
        ]);

        // Get employee statistics
        const [totalEmployees, onLeaveToday] = await Promise.all([
            prisma.employee.count({ where: { org_id: employee.org_id } }),
            prisma.leaveRequest.count({
                where: {
                    employee: { org_id: employee.org_id },
                    status: 'approved',
                    start_date: { lte: today },
                    end_date: { gte: today }
                }
            })
        ]);

        // Get attendance statistics for today
        let activeToday = 0;
        let lateArrivals = 0;
        let earlyDepartures = 0;
        let avgAttendance = 0;

        try {
            const attendanceRecords = await prisma.attendance.findMany({
                where: {
                    date: {
                        gte: today,
                        lt: tomorrow
                    },
                    employee: {
                        org_id: employee.org_id
                    }
                }
            });

            activeToday = attendanceRecords.filter(r => r.check_in).length;
            
            // Count late arrivals (after 9:30 AM)
            lateArrivals = attendanceRecords.filter(r => {
                if (!r.check_in) return false;
                const checkIn = new Date(r.check_in);
                return checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 30);
            }).length;

            // Count early departures (before 5:00 PM)
            earlyDepartures = attendanceRecords.filter(r => {
                if (!r.check_out) return false;
                const checkOut = new Date(r.check_out);
                return checkOut.getHours() < 17;
            }).length;

            // Calculate average attendance rate over last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const last30DaysAttendance = await prisma.attendance.count({
                where: {
                    date: { gte: thirtyDaysAgo },
                    check_in: { not: null },
                    employee: { org_id: employee.org_id }
                }
            });

            // Expected: totalEmployees * 22 working days (approx)
            const expectedDays = totalEmployees * 22;
            avgAttendance = expectedDays > 0 ? Math.round((last30DaysAttendance / expectedDays) * 100) : 0;
            avgAttendance = Math.min(avgAttendance, 100); // Cap at 100%

        } catch (e) {
            // Attendance table might not exist or have different schema
            console.log("Attendance stats not available:", e);
        }

        // Calculate average processing time for approved/rejected requests
        let avgProcessingTime = "N/A";
        try {
            const processedRequests = await prisma.leaveRequest.findMany({
                where: {
                    employee: { org_id: employee.org_id },
                    status: { in: ['approved', 'rejected'] }
                },
                select: { created_at: true, updated_at: true }
            });

            if (processedRequests.length > 0) {
                const totalHours = processedRequests.reduce((sum, req) => {
                    const created = new Date(req.created_at).getTime();
                    const updated = new Date(req.updated_at!).getTime();
                    return sum + (updated - created) / (1000 * 60 * 60);
                }, 0);
                const avgHours = totalHours / processedRequests.length;
                
                if (avgHours < 24) {
                    avgProcessingTime = `${Math.round(avgHours)}h`;
                } else {
                    avgProcessingTime = `${Math.round(avgHours / 24)}d`;
                }
            }
        } catch (e) {
            console.log("Could not calculate processing time:", e);
        }

        return NextResponse.json({
            success: true,
            data: {
                leaveStats: {
                    totalRequests,
                    approved,
                    rejected,
                    pending,
                    avgProcessingTime
                },
                attendanceStats: {
                    avgAttendance,
                    lateArrivals,
                    earlyDepartures
                },
                employeeStats: {
                    totalEmployees,
                    activeToday,
                    onLeave: onLeaveToday
                }
            }
        });

    } catch (error) {
        console.error("[API] Reports GET Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate reports" },
            { status: 500 }
        );
    }
}
