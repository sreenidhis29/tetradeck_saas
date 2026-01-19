'use client';

import AttendanceMonitor from "@/components/hr/AttendanceMonitor";

export default function AttendancePage() {
    return (
        <div className="max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Attendance Monitoring</h1>
                <p className="text-slate-400">Track employee check-ins and manage attendance records.</p>
            </header>

            <AttendanceMonitor />
        </div>
    );
}
