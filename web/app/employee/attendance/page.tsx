"use client";

import React from 'react';
import EmployeeLayout from '@/components/employee/EmployeeLayout';

export default function AttendancePage() {
    return (
        <EmployeeLayout>
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Attendance</h1>
                    <p className="text-slate-400">View your attendance logs and check-in history.</p>
                </header>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-10 text-center">
                    <p className="text-slate-500 italic">Attendance module coming soon.</p>
                </div>
            </div>
        </EmployeeLayout>
    );
}
