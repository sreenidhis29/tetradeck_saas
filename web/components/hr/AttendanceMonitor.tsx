'use client';

import { useState, useEffect } from 'react';
import { getMissingCheckIns, markEmployeeAbsent, getAttendanceOverview } from "@/app/actions/hr";
import { Users, Clock, UserCheck, UserX, AlertTriangle, CheckCircle, XCircle, Coffee } from 'lucide-react';

interface MissingEmployee {
    emp_id: string;
    full_name: string;
    email: string;
    department: string | null;
}

interface AttendanceOverview {
    totalEmployees: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    onLeaveToday: number;
    notCheckedIn: number;
}

export default function AttendanceMonitor() {
    const [missing, setMissing] = useState<MissingEmployee[]>([]);
    const [overview, setOverview] = useState<AttendanceOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [missingRes, overviewRes] = await Promise.all([
                getMissingCheckIns(),
                getAttendanceOverview()
            ]);

            if (missingRes.success && missingRes.missing) {
                setMissing(missingRes.missing);
            }
            if (overviewRes.success && overviewRes.overview) {
                setOverview(overviewRes.overview);
            }
        } catch (error) {
            console.error("Failed to load attendance data:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        // Refresh every 5 minutes
        const interval = setInterval(loadData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkAbsent = async (empId: string, empName: string, markAsLeave: boolean) => {
        setActionLoading(empId);
        setMessage(null);
        try {
            const result = await markEmployeeAbsent(empId, markAsLeave);
            if (result.success) {
                setMessage({ type: 'success', text: result.message || 'Action completed' });
                // Remove from missing list
                setMissing(prev => prev.filter(e => e.emp_id !== empId));
                // Reload overview
                const overviewRes = await getAttendanceOverview();
                if (overviewRes.success && overviewRes.overview) {
                    setOverview(overviewRes.overview);
                }
            } else {
                setMessage({ type: 'error', text: result.error || 'Action failed' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred' });
        }
        setActionLoading(null);
    };

    if (loading) {
        return (
            <div className="glass-panel p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Message Toast */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                    message.type === 'success' 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-auto text-current hover:opacity-70">✕</button>
                </div>
            )}

            {/* Overview Stats */}
            {overview && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="glass-panel p-4 text-center">
                        <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{overview.totalEmployees}</p>
                        <p className="text-xs text-slate-500">Total</p>
                    </div>
                    <div className="glass-panel p-4 text-center border-emerald-500/20">
                        <UserCheck className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-emerald-400">{overview.presentToday}</p>
                        <p className="text-xs text-slate-500">Present</p>
                    </div>
                    <div className="glass-panel p-4 text-center border-amber-500/20">
                        <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-amber-400">{overview.lateToday}</p>
                        <p className="text-xs text-slate-500">Late</p>
                    </div>
                    <div className="glass-panel p-4 text-center border-rose-500/20">
                        <UserX className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-rose-400">{overview.absentToday}</p>
                        <p className="text-xs text-slate-500">Absent</p>
                    </div>
                    <div className="glass-panel p-4 text-center border-purple-500/20">
                        <Coffee className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-purple-400">{overview.onLeaveToday}</p>
                        <p className="text-xs text-slate-500">On Leave</p>
                    </div>
                    <div className="glass-panel p-4 text-center border-orange-500/20">
                        <AlertTriangle className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-orange-400">{overview.notCheckedIn}</p>
                        <p className="text-xs text-slate-500">Not Checked In</p>
                    </div>
                </div>
            )}

            {/* Missing Check-ins Section */}
            <div className="glass-panel p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Missing Check-ins Today
                    </h3>
                    <button
                        onClick={loadData}
                        className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                        <Clock className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {missing.length === 0 ? (
                    <div className="text-center py-8">
                        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                        <h4 className="text-white font-medium mb-2">All Clear!</h4>
                        <p className="text-slate-500">Everyone has checked in or is on approved leave.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {missing.map((employee) => (
                            <div
                                key={employee.emp_id}
                                className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-amber-500/20"
                            >
                                <div>
                                    <p className="text-white font-medium">{employee.full_name}</p>
                                    <p className="text-slate-500 text-sm">
                                        {employee.department || 'No Department'} • {employee.email}
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleMarkAbsent(employee.emp_id, employee.full_name, false)}
                                        disabled={actionLoading === employee.emp_id}
                                        className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        Mark Present
                                    </button>
                                    <button
                                        onClick={() => handleMarkAbsent(employee.emp_id, employee.full_name, true)}
                                        disabled={actionLoading === employee.emp_id}
                                        className="px-3 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <UserX className="w-4 h-4" />
                                        Mark Absent (Casual Leave)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                    <p className="text-slate-400 text-sm">
                        <strong className="text-white">Note:</strong> Employees marked absent will have 1 day deducted from their Casual Leave balance. 
                        You can also mark them as present if they're working but forgot to check in.
                    </p>
                </div>
            </div>
        </div>
    );
}
