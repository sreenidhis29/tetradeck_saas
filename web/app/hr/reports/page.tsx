"use client";

import React from 'react';
import DashboardLayout from '@/components/hr/DashboardLayout';

export default function ReportsPage() {
    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Reports & Analytics</h1>
                    <p className="text-slate-400">Deep insights into your organization's performance.</p>
                </header>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-10 text-center">
                    <p className="text-slate-500 italic">Analytics module coming soon.</p>
                </div>
            </div>
        </DashboardLayout>
    );
}
