"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AttendancePage() {
    return (
        <div className="max-w-6xl mx-auto">
            <header className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-2">Attendance Console</h1>
                <p className="text-slate-400">Track your check-ins and hours.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="glass-panel p-8 md:col-span-2">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="text-sm text-slate-500 uppercase tracking-widest mb-1">Current Status</div>
                            <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                                <CheckCircle2 size={24} /> Checked In
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-slate-500 uppercase tracking-widest mb-1">Session Duration</div>
                            <div className="text-3xl font-mono text-white">05:24:12</div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button className="flex-1 bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors">
                            Clock Out
                        </button>
                        <button className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-2xl border border-white/10 hover:bg-slate-700 transition-colors">
                            Take a Break
                        </button>
                    </div>
                </div>

                <div className="glass-panel p-8">
                    <h2 className="text-lg font-bold text-white mb-6">Recent Activity</h2>
                    <div className="space-y-4">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="flex gap-4 p-3 bg-slate-900/50 rounded-xl border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">Check In</div>
                                    <div className="text-xs text-slate-500">Today, 09:00 AM</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass-panel p-12 text-center border-dashed border-2 border-white/5">
                <AlertCircle size={48} className="text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-500">Full logs under maintenance</h3>
                <p className="text-slate-600">The attendance visualization module is being upgraded.</p>
            </div>
        </div>
    );
}
