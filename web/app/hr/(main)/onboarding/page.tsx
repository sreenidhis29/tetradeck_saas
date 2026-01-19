"use client";

import React from 'react';
import DashboardLayout from '@/components/hr/DashboardLayout';

export default function OnboardingPage() {
    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Onboarding</h1>
                    <p className="text-slate-400">Track and manage new hire onboarding workflows.</p>
                </header>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-10 text-center">
                    <p className="text-slate-500 italic">Onboarding module coming soon.</p>
                </div>
            </div>
        </DashboardLayout>
    );
}
