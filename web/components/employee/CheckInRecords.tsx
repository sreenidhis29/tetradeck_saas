'use client';

import { useState } from 'react';
import { Clock, LogIn, LogOut, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface CheckInRecord {
    id: string;
    date: string;
    check_in: string | null;
    check_out: string | null;
    total_hours: number | null;
    status: string;
}

interface CheckInRecordsProps {
    records: CheckInRecord[];
    loading?: boolean;
}

export default function CheckInRecords({ records, loading }: CheckInRecordsProps) {
    const getStatusIcon = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PRESENT':
                return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            case 'LATE':
                return <AlertCircle className="w-4 h-4 text-amber-400" />;
            case 'ABSENT':
                return <XCircle className="w-4 h-4 text-rose-400" />;
            case 'HALF_DAY':
                return <Clock className="w-4 h-4 text-orange-400" />;
            default:
                return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PRESENT':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'LATE':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'ABSENT':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            case 'HALF_DAY':
                return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            default:
                return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const formatTime = (dateString: string | null) => {
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="glass-panel p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    Recent Check-ins
                </h3>
                <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Recent Check-in Records
            </h3>

            {records.length === 0 ? (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-slate-500">No check-in records yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {records.slice(0, 10).map((record) => (
                        <div
                            key={record.id}
                            className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(record.status)}
                                </div>
                                
                                <div>
                                    <p className="text-white font-medium">{formatDate(record.date)}</p>
                                    <p className="text-slate-500 text-sm">
                                        {new Date(record.date).toLocaleDateString('en-US', { 
                                            weekday: 'long',
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric' 
                                        })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="flex items-center gap-2 text-sm">
                                        <LogIn className="w-4 h-4 text-emerald-400" />
                                        <span className="text-slate-300">{formatTime(record.check_in)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <LogOut className="w-4 h-4 text-rose-400" />
                                        <span className="text-slate-300">{formatTime(record.check_out)}</span>
                                    </div>
                                </div>

                                <div className="text-right min-w-[60px]">
                                    {record.total_hours !== null && (
                                        <p className="text-cyan-400 font-medium">
                                            {Number(record.total_hours).toFixed(1)}h
                                        </p>
                                    )}
                                </div>

                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(record.status)}`}>
                                    {record.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
