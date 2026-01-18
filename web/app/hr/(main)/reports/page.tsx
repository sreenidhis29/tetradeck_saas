"use client";

import { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, RefreshCw, Calendar, Users, TrendingUp, FileText } from 'lucide-react';

interface ReportData {
    leaveStats: {
        totalRequests: number;
        approved: number;
        rejected: number;
        pending: number;
        avgProcessingTime: string;
    };
    attendanceStats: {
        avgAttendance: number;
        lateArrivals: number;
        earlyDepartures: number;
    };
    employeeStats: {
        totalEmployees: number;
        activeToday: number;
        onLeave: number;
    };
}

export default function ReportsPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchReports() {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch('/api/reports');
                
                if (!response.ok) {
                    throw new Error('Failed to load reports');
                }
                
                const result = await response.json();
                if (result.success) {
                    setData(result.data);
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } catch (err) {
                console.error('Error fetching reports:', err);
                setError('Unable to load reports. Please try again later.');
            } finally {
                setLoading(false);
            }
        }
        fetchReports();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                <p className="text-slate-400">Loading analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <h1 className="text-3xl font-bold text-white mb-8">Analytics & Reports</h1>
                <div className="glass-panel p-12 text-center">
                    <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Service Unavailable</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div>
                <h1 className="text-3xl font-bold text-white mb-8">Analytics & Reports</h1>
                <div className="glass-panel p-12 text-center">
                    <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Data Available</h2>
                    <p className="text-slate-400">Reports will appear once there is activity in the system.</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-8">Analytics & Reports</h1>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                            <FileText size={20} />
                        </div>
                        <span className="text-slate-400 text-sm">Total Leave Requests</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{data.leaveStats.totalRequests}</div>
                </div>
                
                <div className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                            <Users size={20} />
                        </div>
                        <span className="text-slate-400 text-sm">Employees</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{data.employeeStats.totalEmployees}</div>
                </div>
                
                <div className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-slate-400 text-sm">Avg Attendance</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{data.attendanceStats.avgAttendance}%</div>
                </div>
                
                <div className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                            <Calendar size={20} />
                        </div>
                        <span className="text-slate-400 text-sm">On Leave Today</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{data.employeeStats.onLeave}</div>
                </div>
            </div>

            {/* Leave Stats Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Leave Request Breakdown</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Approved</span>
                            <span className="text-emerald-400 font-bold">{data.leaveStats.approved}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500" 
                                style={{ width: `${(data.leaveStats.approved / data.leaveStats.totalRequests) * 100 || 0}%` }}
                            />
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Pending</span>
                            <span className="text-amber-400 font-bold">{data.leaveStats.pending}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-amber-500" 
                                style={{ width: `${(data.leaveStats.pending / data.leaveStats.totalRequests) * 100 || 0}%` }}
                            />
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Rejected</span>
                            <span className="text-red-400 font-bold">{data.leaveStats.rejected}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-red-500" 
                                style={{ width: `${(data.leaveStats.rejected / data.leaveStats.totalRequests) * 100 || 0}%` }}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Attendance Overview</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-400">Active Today</span>
                            <span className="text-white font-bold">{data.employeeStats.activeToday} employees</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-400">Late Arrivals</span>
                            <span className="text-amber-400 font-bold">{data.attendanceStats.lateArrivals}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-400">Early Departures</span>
                            <span className="text-orange-400 font-bold">{data.attendanceStats.earlyDepartures}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-400">Avg Processing Time</span>
                            <span className="text-cyan-400 font-bold">{data.leaveStats.avgProcessingTime}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
