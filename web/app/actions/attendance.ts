"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface AttendanceEntry {
  type: string;
  time: string;
}

export interface TodayAttendance {
  id: string | null;
  status: "not_checked_in" | "checked_in" | "on_break";
  checkIn: string | null;
  checkOut: string | null;
  activities: AttendanceEntry[];
}

// Get today's attendance for the current employee
export async function getTodayAttendance(): Promise<{
  success: boolean;
  data?: TodayAttendance;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const employee = await prisma.employee.findFirst({
      where: { clerk_id: userId },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        emp_id: employee.emp_id,
        date: today,
      },
    });

    // Build activities list
    const activities: AttendanceEntry[] = [];
    if (attendance?.check_in) {
      activities.push({ type: "Check In", time: attendance.check_in.toISOString() });
    }
    if (attendance?.check_out) {
      activities.push({ type: "Check Out", time: attendance.check_out.toISOString() });
    }

    // Determine status
    let status: TodayAttendance["status"] = "not_checked_in";
    if (attendance?.check_in && !attendance?.check_out) {
      // Check if on break by looking at status field
      status = attendance.status === "ON_BREAK" ? "on_break" : "checked_in";
    }

    return {
      success: true,
      data: {
        id: attendance?.id || null,
        status,
        checkIn: attendance?.check_in?.toISOString() || null,
        checkOut: attendance?.check_out?.toISOString() || null,
        activities: activities.reverse(),
      },
    };
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return { success: false, error: "Failed to fetch attendance" };
  }
}

// Clock in
export async function clockIn(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const employee = await prisma.employee.findFirst({
      where: { clerk_id: userId },
      include: { company: true },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    // Get company work schedule settings
    const workStartTime = employee.company?.work_start_time || "09:00";
    const gracePeriodMins = employee.company?.grace_period_mins || 15;
    const workDays = (employee.company?.work_days as number[]) || [1, 2, 3, 4, 5];
    
    // Check if today is a work day (1=Mon, 7=Sun)
    const todayDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    if (!workDays.includes(todayDayOfWeek)) {
      return { success: false, error: "Today is not a scheduled work day" };
    }

    // Determine status based on company work start time + grace period
    const [startHour, startMin] = workStartTime.split(':').map(Number);
    const lateThreshold = new Date(today);
    lateThreshold.setHours(startHour, startMin + gracePeriodMins, 0, 0);
    const status = now > lateThreshold ? "LATE" : "PRESENT";

    // Use upsert to prevent race conditions - atomic operation
    try {
      const existing = await prisma.attendance.findUnique({
        where: {
          emp_id_date: {
            emp_id: employee.emp_id,
            date: today,
          },
        },
      });

      if (existing?.check_in) {
        return { success: false, error: "Already clocked in today" };
      }

      await prisma.attendance.upsert({
        where: {
          emp_id_date: {
            emp_id: employee.emp_id,
            date: today,
          },
        },
        create: {
          emp_id: employee.emp_id,
          date: today,
          check_in: now,
          status,
        },
        update: {
          check_in: now,
          status,
        },
      });
    } catch (dbError: any) {
      // Handle unique constraint violation (race condition fallback)
      if (dbError?.code === 'P2002') {
        return { success: false, error: "Already clocked in today" };
      }
      throw dbError;
    }

    revalidatePath("/employee/attendance");
    return { success: true };
  } catch (error) {
    console.error("Error clocking in:", error);
    return { success: false, error: "Failed to clock in" };
  }
}

// Clock out
export async function clockOut(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const employee = await prisma.employee.findFirst({
      where: { clerk_id: userId },
      include: { company: true },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const attendance = await prisma.attendance.findFirst({
      where: {
        emp_id: employee.emp_id,
        date: today,
      },
    });

    if (!attendance) {
      return { success: false, error: "Not clocked in today" };
    }

    if (attendance.check_out) {
      return { success: false, error: "Already clocked out" };
    }

    // Get company settings for half-day calculation
    const halfDayHours = Number(employee.company?.half_day_hours) || 4;
    const fullDayHours = Number(employee.company?.full_day_hours) || 8;

    // Calculate total hours
    const checkIn = attendance.check_in!;
    const diffMs = now.getTime() - checkIn.getTime();
    const totalHours = diffMs / (1000 * 60 * 60);

    // Determine final status based on company settings
    let status = attendance.status;
    if (totalHours < halfDayHours) {
      status = "HALF_DAY";
    } else if (totalHours >= fullDayHours) {
      status = status === "LATE" ? "LATE" : "PRESENT"; // Keep LATE if they were late
    }

    await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        check_out: now,
        total_hours: Math.round(totalHours * 100) / 100,
        status,
      },
    });

    revalidatePath("/employee/attendance");
    return { success: true };
  } catch (error) {
    console.error("Error clocking out:", error);
    return { success: false, error: "Failed to clock out" };
  }
}

// Start break
export async function startBreak(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const employee = await prisma.employee.findFirst({
      where: { clerk_id: userId },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        emp_id: employee.emp_id,
        date: today,
      },
    });

    if (!attendance || attendance.check_out) {
      return { success: false, error: "Not currently checked in" };
    }

    await prisma.attendance.update({
      where: { id: attendance.id },
      data: { status: "ON_BREAK" },
    });

    revalidatePath("/employee/attendance");
    return { success: true };
  } catch (error) {
    console.error("Error starting break:", error);
    return { success: false, error: "Failed to start break" };
  }
}

// End break
export async function endBreak(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const employee = await prisma.employee.findFirst({
      where: { clerk_id: userId },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        emp_id: employee.emp_id,
        date: today,
      },
    });

    if (!attendance || attendance.status !== "ON_BREAK") {
      return { success: false, error: "Not currently on break" };
    }

    await prisma.attendance.update({
      where: { id: attendance.id },
      data: { status: "PRESENT" },
    });

    revalidatePath("/employee/attendance");
    return { success: true };
  } catch (error) {
    console.error("Error ending break:", error);
    return { success: false, error: "Failed to end break" };
  }
}

// Get attendance history
export async function getAttendanceHistory(days: number = 30): Promise<{
  success: boolean;
  data?: Array<{
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    totalHours: number | null;
    status: string;
  }>;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const employee = await prisma.employee.findFirst({
      where: { clerk_id: userId },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const attendances = await prisma.attendance.findMany({
      where: {
        emp_id: employee.emp_id,
        date: { gte: startDate },
      },
      orderBy: { date: "desc" },
    });

    return {
      success: true,
      data: attendances.map((a: { date: Date; check_in: Date | null; check_out: Date | null; total_hours: unknown; status: string }) => ({
        date: a.date.toISOString(),
        checkIn: a.check_in?.toISOString() || null,
        checkOut: a.check_out?.toISOString() || null,
        totalHours: a.total_hours ? Number(a.total_hours) : null,
        status: a.status,
      })),
    };
  } catch (error) {
    console.error("Error fetching attendance history:", error);
    return { success: false, error: "Failed to fetch attendance history" };
  }
}
