"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import EmployeeLayout from '@/components/employee/EmployeeLayout';

export default function ProfilePage() {
    const { user } = useUser();

    return (
        <EmployeeLayout>
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
                    <p className="text-slate-400">Manage your personal information and preferences.</p>
                </header>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 mb-6">
                    <div className="flex items-center gap-6 mb-8">
                        <img
                            src={user?.imageUrl}
                            alt={user?.firstName || 'User'}
                            className="w-24 h-24 rounded-full border-4 border-slate-700"
                        />
                        <div>
                            <h2 className="text-2xl font-bold text-white">{user?.fullName}</h2>
                            <p className="text-purple-400">{user?.primaryEmailAddress?.emailAddress}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/50 p-4 rounded-lg">
                            <label className="text-xs text-slate-500 uppercase block mb-1">Employee ID</label>
                            <div className="text-white font-medium">EMP-{user?.id.slice(-6)}</div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg">
                            <label className="text-xs text-slate-500 uppercase block mb-1">Department</label>
                            <div className="text-white font-medium">Engineering</div>
                        </div>
                    </div>
                </div>
            </div>
        </EmployeeLayout>
    );
}
