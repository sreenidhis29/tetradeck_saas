/**
 * Attendance Reminder API Route
 * 
 * Schedule:
 * - Check-in time: 9:00 AM
 * - Check-out time: 4:00 PM (16:00)
 * - Check-in reminders: 9:10 AM (first), 10:00 AM (final)
 * - Check-out reminders: 3:00 PM (early), 4:10 PM (final)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
    sendCheckInReminderEmail, 
    sendCheckOutReminderEmail, 
    sendHRMissingCheckInsEmail 
} from "@/lib/email-service";

// Standard work times
const STANDARD_CHECK_IN_HOUR = 9;   // 9:00 AM
const STANDARD_CHECK_OUT_HOUR = 16; // 4:00 PM (16:00)

// Reminder schedules (hours and minutes)
const REMINDER_TIMES = {
    checkIn: [
        { hour: 9, minute: 10, reminderNumber: 1 as const },   // First reminder at 9:10 AM
        { hour: 10, minute: 0, reminderNumber: 2 as const }    // Final reminder at 10:00 AM
    ],
    checkOut: [
        { hour: 15, minute: 0, reminderNumber: 1 as const },   // Early reminder at 3:00 PM
        { hour: 16, minute: 10, reminderNumber: 2 as const }   // Final reminder at 4:10 PM
    ]
};

/**
 * Check if current time is within a reminder window (±5 minutes)
 */
function isWithinReminderWindow(targetHour: number, targetMinute: number, now: Date): boolean {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Convert to minutes for easier comparison
    const targetMinutes = targetHour * 60 + targetMinute;
    const currentMinutes = currentHour * 60 + currentMinute;
    
    // Allow 5 minute window
    return Math.abs(currentMinutes - targetMinutes) <= 5;
}

/**
 * Get which reminder number to send based on current time
 */
function getCheckInReminderNumber(now: Date): 1 | 2 | null {
    for (const schedule of REMINDER_TIMES.checkIn) {
        if (isWithinReminderWindow(schedule.hour, schedule.minute, now)) {
            return schedule.reminderNumber;
        }
    }
    return null;
}

function getCheckOutReminderNumber(now: Date): 1 | 2 | null {
    for (const schedule of REMINDER_TIMES.checkOut) {
        if (isWithinReminderWindow(schedule.hour, schedule.minute, now)) {
            return schedule.reminderNumber;
        }
    }
    return null;
}

/**
 * API Route Handler
 */
export async function POST(req: NextRequest) {
    const explanation: string[] = [];
    
    try {
        // Verify cron secret for security
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;
        
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ 
                error: "Unauthorized",
                explanation: "Invalid or missing CRON_SECRET authentication" 
            }, { status: 401 });
        }

        const body = await req.json();
        const { action, forceReminderNumber } = body;

        // Get today's date (UTC for consistency)
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const today = new Date(todayStr + 'T00:00:00.000Z');
        
        explanation.push(`Processing ${action} at ${now.toLocaleTimeString()}`);

        // ============================================================
        // CHECK-IN REMINDER
        // Triggers at 9:10 AM (first) and 10:00 AM (final)
        // ============================================================
        if (action === "check_in_reminder") {
            const reminderNumber = forceReminderNumber || getCheckInReminderNumber(now);
            
            if (!reminderNumber) {
                const nextReminder = REMINDER_TIMES.checkIn
                    .map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')}`)
                    .join(' or ');
                explanation.push(`Not within check-in reminder window. Reminders are sent at ${nextReminder}`);
                return NextResponse.json({ 
                    success: false,
                    message: "Not within reminder window",
                    explanation: explanation.join('. ')
                });
            }

            explanation.push(`Sending reminder #${reminderNumber} (${reminderNumber === 1 ? 'First - 9:10 AM' : 'Final - 10:00 AM'})`);

            // Get all active employees
            const allEmployees = await prisma.employee.findMany({
                where: { is_active: true },
                select: { emp_id: true, email: true, full_name: true }
            });
            explanation.push(`Found ${allEmployees.length} active employees`);

            // Get employees who already checked in
            const checkedIn = await prisma.attendance.findMany({
                where: { date: today, check_in: { not: null } },
                select: { emp_id: true }
            });
            explanation.push(`${checkedIn.length} employees already checked in`);

            // Get employees on approved leave today
            const onLeave = await prisma.leaveRequest.findMany({
                where: {
                    status: 'approved',
                    start_date: { lte: today },
                    end_date: { gte: today }
                },
                select: { emp_id: true }
            });
            explanation.push(`${onLeave.length} employees on approved leave`);

            const checkedInIds = new Set(checkedIn.map(a => a.emp_id));
            const onLeaveIds = new Set(onLeave.map(l => l.emp_id));

            // Filter to employees who need reminders
            const missingEmployees = allEmployees.filter(e => 
                !checkedInIds.has(e.emp_id) && !onLeaveIds.has(e.emp_id)
            );
            explanation.push(`${missingEmployees.length} employees need reminders`);

            // Send reminders
            let sentCount = 0;
            const errors: string[] = [];
            
            for (const emp of missingEmployees) {
                const result = await sendCheckInReminderEmail(emp, reminderNumber);
                if (result.success) {
                    sentCount++;
                } else {
                    errors.push(`${emp.full_name}: ${result.error}`);
                }
            }

            explanation.push(`Successfully sent ${sentCount} of ${missingEmployees.length} reminders`);
            if (errors.length > 0) {
                explanation.push(`Errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
            }

            return NextResponse.json({ 
                success: true, 
                message: `Sent ${sentCount} check-in reminders`,
                reminderNumber,
                missing: missingEmployees.length,
                sent: sentCount,
                explanation: explanation.join('. ')
            });
        }

        // ============================================================
        // CHECK-OUT REMINDER
        // Triggers at 3:00 PM (early) and 4:10 PM (final)
        // ============================================================
        if (action === "check_out_reminder") {
            const reminderNumber = forceReminderNumber || getCheckOutReminderNumber(now);
            
            if (!reminderNumber) {
                const nextReminder = REMINDER_TIMES.checkOut
                    .map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')}`)
                    .join(' or ');
                explanation.push(`Not within check-out reminder window. Reminders are sent at ${nextReminder}`);
                return NextResponse.json({ 
                    success: false,
                    message: "Not within reminder window",
                    explanation: explanation.join('. ')
                });
            }

            explanation.push(`Sending reminder #${reminderNumber} (${reminderNumber === 1 ? 'Early - 3:00 PM' : 'Final - 4:10 PM'})`);

            // Get employees who checked in but haven't checked out
            const missingCheckouts = await prisma.attendance.findMany({
                where: {
                    date: today,
                    check_in: { not: null },
                    check_out: null
                },
                include: {
                    employee: {
                        select: { email: true, full_name: true }
                    }
                }
            });

            explanation.push(`${missingCheckouts.length} employees checked in but haven't checked out`);

            let sentCount = 0;
            const errors: string[] = [];
            
            for (const att of missingCheckouts) {
                const result = await sendCheckOutReminderEmail({
                    email: att.employee.email,
                    full_name: att.employee.full_name,
                    check_in_time: att.check_in!.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        hour12: true 
                    })
                }, reminderNumber);
                
                if (result.success) {
                    sentCount++;
                } else {
                    errors.push(`${att.employee.full_name}: ${result.error}`);
                }
            }

            explanation.push(`Successfully sent ${sentCount} of ${missingCheckouts.length} reminders`);

            return NextResponse.json({
                success: true,
                message: `Sent ${sentCount} check-out reminders`,
                reminderNumber,
                missing: missingCheckouts.length,
                sent: sentCount,
                explanation: explanation.join('. ')
            });
        }

        // ============================================================
        // HR NOTIFICATION
        // Sent after final check-in reminder (after 10:00 AM)
        // ============================================================
        if (action === "hr_notification") {
            // Get HR employees
            const hrEmployees = await prisma.employee.findMany({
                where: { role: { in: ['hr', 'admin'] }, is_active: true },
                select: { email: true, full_name: true }
            });

            if (hrEmployees.length === 0) {
                explanation.push("No HR employees found in system");
                return NextResponse.json({ 
                    message: "No HR employees found",
                    explanation: explanation.join('. ')
                });
            }

            explanation.push(`Found ${hrEmployees.length} HR staff to notify`);

            // Get missing employees
            const allEmployees = await prisma.employee.findMany({
                where: { is_active: true },
                select: { emp_id: true, full_name: true, department: true }
            });

            const checkedIn = await prisma.attendance.findMany({
                where: { date: today, check_in: { not: null } },
                select: { emp_id: true }
            });

            const onLeave = await prisma.leaveRequest.findMany({
                where: {
                    status: 'approved',
                    start_date: { lte: today },
                    end_date: { gte: today }
                },
                select: { emp_id: true }
            });

            const checkedInIds = new Set(checkedIn.map(a => a.emp_id));
            const onLeaveIds = new Set(onLeave.map(l => l.emp_id));

            const missingEmployees = allEmployees.filter(e => 
                !checkedInIds.has(e.emp_id) && !onLeaveIds.has(e.emp_id)
            );

            if (missingEmployees.length === 0) {
                explanation.push("All employees accounted for (checked in or on leave)");
                return NextResponse.json({ 
                    message: "No missing employees to report",
                    explanation: explanation.join('. ')
                });
            }

            explanation.push(`${missingEmployees.length} employees missing without approved leave`);

            // Send to all HR
            let sentCount = 0;
            for (const hr of hrEmployees) {
                const result = await sendHRMissingCheckInsEmail(
                    hr.email,
                    missingEmployees.map(e => ({ name: e.full_name, department: e.department }))
                );
                if (result.success) sentCount++;
            }

            explanation.push(`Notified ${sentCount} HR staff`);

            return NextResponse.json({
                success: true,
                message: `Notified ${sentCount} HR staff about ${missingEmployees.length} missing employees`,
                explanation: explanation.join('. ')
            });
        }

        return NextResponse.json({ 
            error: "Invalid action",
            explanation: "Valid actions are: check_in_reminder, check_out_reminder, hr_notification"
        }, { status: 400 });

    } catch (error) {
        console.error("Attendance reminder error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ 
            error: "Internal server error",
            explanation: `System error: ${errorMessage}. Please check server logs for details.`
        }, { status: 500 });
    }
}

/**
 * GET handler - Shows service status and schedule
 */
export async function GET() {
    const now = new Date();
    const checkInReminder = getCheckInReminderNumber(now);
    const checkOutReminder = getCheckOutReminderNumber(now);

    return NextResponse.json({
        status: "Attendance reminder service active",
        currentTime: now.toLocaleTimeString(),
        schedule: {
            standardCheckIn: `${STANDARD_CHECK_IN_HOUR}:00 AM`,
            standardCheckOut: `${STANDARD_CHECK_OUT_HOUR > 12 ? STANDARD_CHECK_OUT_HOUR - 12 : STANDARD_CHECK_OUT_HOUR}:00 PM`,
            checkInReminders: [
                { time: "9:10 AM", type: "First reminder", triggered: checkInReminder === 1 },
                { time: "10:00 AM", type: "Final reminder", triggered: checkInReminder === 2 }
            ],
            checkOutReminders: [
                { time: "3:00 PM", type: "Early reminder", triggered: checkOutReminder === 1 },
                { time: "4:10 PM", type: "Final reminder", triggered: checkOutReminder === 2 }
            ]
        },
        endpoints: {
            check_in_reminder: "POST with action='check_in_reminder' - Send check-in reminders (9:10 AM / 10:00 AM)",
            check_out_reminder: "POST with action='check_out_reminder' - Send check-out reminders (3:00 PM / 4:10 PM)",
            hr_notification: "POST with action='hr_notification' - Notify HR about missing employees"
        },
        explanation: "This service sends automated attendance reminders. Set up a cron job to call these endpoints at the specified times."
    });
}
