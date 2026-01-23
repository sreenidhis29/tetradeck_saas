"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, AlertCircle, LogIn, LogOut, Coffee, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { 
    getTodayAttendance, 
    clockIn, 
    clockOut, 
    startBreak, 
    endBreak,
    type AttendanceEntry 
} from '@/app/actions/attendance';

type AttendanceStatus = 'not_checked_in' | 'checked_in' | 'on_break';

export default function AttendancePage() {
    const [status, setStatus] = useState<AttendanceStatus>('not_checked_in');
    const [sessionStart, setSessionStart] = useState<Date | null>(null);
    const [sessionDuration, setSessionDuration] = useState('00:00:00');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [activities, setActivities] = useState<Array<{type: string, time: Date}>>([]);

    // Fetch today's attendance on mount
    const fetchAttendance = useCallback(async () => {
        const result = await getTodayAttendance();
        if (result.success && result.data) {
            setStatus(result.data.status);
            if (result.data.checkIn) {
                setSessionStart(new Date(result.data.checkIn));
            }
            setActivities(
                result.data.activities.map((a: AttendanceEntry) => ({
                    type: a.type,
                    time: new Date(a.time),
                }))
            );
        }
        setInitialLoading(false);
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    // Update timer
    useEffect(() => {
        if ((status === 'checked_in' || status === 'on_break') && sessionStart) {
            const interval = setInterval(() => {
                const diff = Date.now() - sessionStart.getTime();
                const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
                const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                setSessionDuration(`${hours}:${minutes}:${seconds}`);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [status, sessionStart]);

    const handleCheckIn = async () => {
        setLoading(true);
        const result = await clockIn();
        if (result.success) {
            setStatus('checked_in');
            setSessionStart(new Date());
            setActivities(prev => [{type: 'Check In', time: new Date()}, ...prev]);
            toast.success('Checked in successfully!');
        } else {
            toast.error(result.error || 'Failed to check in');
        }
        setLoading(false);
    };

    const handleCheckOut = async () => {
        setLoading(true);
        const result = await clockOut();
        if (result.success) {
            setStatus('not_checked_in');
            setSessionStart(null);
            setSessionDuration('00:00:00');
            setActivities(prev => [{type: 'Check Out', time: new Date()}, ...prev]);
            toast.success('Checked out successfully!');
        } else {
            toast.error(result.error || 'Failed to check out');
        }
        setLoading(false);
    };

    const handleTakeBreak = async () => {
        setLoading(true);
        const result = await startBreak();
        if (result.success) {
            setStatus('on_break');
            setActivities(prev => [{type: 'Break Started', time: new Date()}, ...prev]);
            toast.info('Break started. Enjoy!');
        } else {
            toast.error(result.error || 'Failed to start break');
        }
        setLoading(false);
    };

    const handleResumeWork = async () => {
        setLoading(true);
        const result = await endBreak();
        if (result.success) {
            setStatus('checked_in');
            setActivities(prev => [{type: 'Break Ended', time: new Date()}, ...prev]);
            toast.success('Welcome back!');
        } else {
            toast.error(result.error || 'Failed to end break');
        }
        setLoading(false);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    if (initialLoading) {
        return (
            <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
            </div>
        );
    }

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
                            <div className={`text-2xl font-bold flex items-center gap-2 ${
                                status === 'checked_in' ? 'text-emerald-400' : 
                                status === 'on_break' ? 'text-amber-400' : 'text-slate-400'
                            }`}>
                                {status === 'checked_in' && <><CheckCircle2 size={24} /> Checked In</>}
                                {status === 'on_break' && <><Coffee size={24} /> On Break</>}
                                {status === 'not_checked_in' && <><Clock size={24} /> Not Checked In</>}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-slate-500 uppercase tracking-widest mb-1">Session Duration</div>
                            <div className="text-3xl font-mono text-white">{sessionDuration}</div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {status === 'not_checked_in' && (
                            <button 
                                onClick={handleCheckIn}
                                disabled={loading}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <LogIn size={20} /> Check In
                            </button>
                        )}
                        {status === 'checked_in' && (
                            <>
                                <button 
                                    onClick={handleCheckOut}
                                    disabled={loading}
                                    className="flex-1 bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <LogOut size={20} /> Clock Out
                                </button>
                                <button 
                                    onClick={handleTakeBreak}
                                    disabled={loading}
                                    className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-2xl border border-white/10 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Coffee size={20} /> Take a Break
                                </button>
                            </>
                        )}
                        {status === 'on_break' && (
                            <button 
                                onClick={handleResumeWork}
                                disabled={loading}
                                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Play size={20} /> Resume Work
                            </button>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-8">
                    <h2 className="text-lg font-bold text-white mb-6">Recent Activity</h2>
                    <div className="space-y-4">
                        {activities.length === 0 ? (
                            <p className="text-slate-500 text-sm">No activity yet today</p>
                        ) : activities.slice(0, 5).map((activity, i) => (
                            <div key={i} className="flex gap-4 p-3 bg-slate-900/50 rounded-xl border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">{activity.type}</div>
                                    <div className="text-xs text-slate-500">Today, {formatTime(activity.time)}</div>
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
