"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { Clock, Calendar, FileText, Activity } from 'lucide-react';

export default function EmployeeDashboard() {
    const { user } = useUser();

    return (
        <EmployeeLayout>
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {user?.firstName}</h1>
                    <p className="text-slate-400">Here's your daily overview.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: 'Leave Balance', value: '12 Days', icon: <Calendar />, color: 'bg-blue-500' },
                        { label: 'Attendance', value: '98%', icon: <Clock />, color: 'bg-emerald-500' },
                        { label: 'Pending Requests', value: '2', icon: <FileText />, color: 'bg-amber-500' },
                        { label: 'Performance', value: 'On Track', icon: <Activity />, color: 'bg-purple-500' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${stat.color}/20 text-white`}>
                                    {React.cloneElement(stat.icon as any, { size: 24, className: `text-${stat.color.split('-')[1]}-400` })}
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">{stat.label}</div>
                                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8 text-center">
                    <h2 className="text-xl font-bold text-white mb-2">Recent Activity</h2>
                    <p className="text-slate-500">No recent activity to show.</p>
                </div>
            </div>
        </EmployeeLayout>
    );
}
