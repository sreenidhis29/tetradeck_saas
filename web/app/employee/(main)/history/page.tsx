'use client';

import { useState, useEffect } from 'react';
import { getLeaveHistory, getAttendanceRecords, getTodayAttendance, getHolidays, checkIn, checkOut } from "@/app/actions/employee";
import AttendanceCalendar from "@/components/employee/AttendanceCalendar";
import CheckInRecords from "@/components/employee/CheckInRecords";
import { CalendarDays, History, Clock, AlertCircle } from 'lucide-react';

type TabType = 'calendar' | 'history' | 'checkin';

export default function HistoryPage() {
    const [activeTab, setActiveTab] = useState<TabType>('calendar');
    const [requests, setRequests] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [holidays, setHolidays] = useState<any[]>([]);
    const [todayStatus, setTodayStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [historyRes, attendanceRes, todayRes, holidaysRes] = await Promise.all([
                getLeaveHistory(),
                getAttendanceRecords(60),
                getTodayAttendance(),
                getHolidays()
            ]);

            if (historyRes.success && historyRes.requests) {
                setRequests(historyRes.requests);
            }
            if (attendanceRes.success && attendanceRes.records) {
                setAttendanceRecords(attendanceRes.records);
            }
            if (todayRes.success) {
                setTodayStatus({
                    checked_in: todayRes.checked_in,
                    checked_out: todayRes.checked_out,
                    check_in_time: todayRes.check_in_time,
                    check_out_time: todayRes.check_out_time
                });
            }
            if (holidaysRes.success && holidaysRes.holidays) {
                setHolidays(holidaysRes.holidays);
            }
        } catch (error) {
            console.error("Failed to load data:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCheckIn = async () => {
        setActionLoading(true);
        setMessage(null);
        try {
            const result = await checkIn();
            if (result.success) {
                setMessage({ type: 'success', text: result.message || 'Checked in successfully!' });
                setTodayStatus((prev: any) => ({
                    ...prev,
                    checked_in: true,
                    check_in_time: result.check_in_time
                }));
                // Reload attendance records
                const attendanceRes = await getAttendanceRecords(60);
                if (attendanceRes.success && attendanceRes.records) {
                    setAttendanceRecords(attendanceRes.records);
                }
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to check in' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred' });
        }
        setActionLoading(false);
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        setMessage(null);
        try {
            const result = await checkOut();
            if (result.success) {
                setMessage({ type: 'success', text: `${result.message} - Total: ${result.total_hours} hours` });
                setTodayStatus((prev: any) => ({
                    ...prev,
                    checked_out: true,
                    check_out_time: result.check_out_time
                }));
                // Reload attendance records
                const attendanceRes = await getAttendanceRecords(60);
                if (attendanceRes.success && attendanceRes.records) {
                    setAttendanceRecords(attendanceRes.records);
                }
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to check out' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred' });
        }
        setActionLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'rejected': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            case 'escalated': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const tabs = [
        { id: 'calendar' as TabType, label: 'Calendar', icon: CalendarDays },
        { id: 'checkin' as TabType, label: 'Check-in Records', icon: Clock },
        { id: 'history' as TabType, label: 'Leave History', icon: History },
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">My Leave History</h1>
                <p className="text-slate-400">Track status and details of all your leave requests.</p>
            </header>

            {/* Message Toast */}
            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                    message.type === 'success' 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                    <AlertCircle className="w-5 h-5" />
                    <span>{message.text}</span>
                    <button 
                        onClick={() => setMessage(null)}
                        className="ml-auto text-current hover:opacity-70"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="glass-panel p-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    {/* Calendar Tab */}
                    {activeTab === 'calendar' && (
                        <AttendanceCalendar
                            attendanceRecords={attendanceRecords}
                            leaveRecords={requests.map(r => ({
                                start_date: r.start_date,
                                end_date: r.end_date,
                                leave_type: r.type,
                                status: r.status,
                                is_half_day: r.is_half_day || r.type?.toLowerCase().includes('half')
                            }))}
                            holidays={holidays}
                            todayStatus={todayStatus}
                            onCheckIn={handleCheckIn}
                            onCheckOut={handleCheckOut}
                        />
                    )}

                    {/* Check-in Records Tab */}
                    {activeTab === 'checkin' && (
                        <CheckInRecords records={attendanceRecords} loading={actionLoading} />
                    )}

                    {/* Leave History Tab */}
                    {activeTab === 'history' && (
                        requests.length > 0 ? (
                            <div className="glass-panel overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-700 bg-slate-800/50">
                                            <th className="p-4 text-slate-400 font-medium text-sm">Leave Type</th>
                                            <th className="p-4 text-slate-400 font-medium text-sm">Dates</th>
                                            <th className="p-4 text-slate-400 font-medium text-sm">Duration</th>
                                            <th className="p-4 text-slate-400 font-medium text-sm">Reason</th>
                                            <th className="p-4 text-slate-400 font-medium text-sm text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {requests.map((req) => (
                                            <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4 font-medium text-white">{req.type}</td>
                                                <td className="p-4 text-slate-300 text-sm">
                                                    {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 text-slate-300 text-sm">{req.total_days} days</td>
                                                <td className="p-4 text-slate-400 text-sm italic">"{req.reason}"</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(req.status)}`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="glass-panel p-16 text-center border-dashed">
                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl">📅</span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">No Leave History</h3>
                                <p className="text-slate-500">You haven't submitted any leave requests yet.</p>
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    );
}
