'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getLeaveRequests, updateLeaveRequestStatus } from "@/app/actions/hr";

export default function LeaveRequestsPage() {
    const { getToken } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending'>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await getLeaveRequests(filter);
            if (res.success && res.requests) {
                setRequests(res.requests);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const handleAction = async (requestId: string, action: 'approved' | 'rejected') => {
        setProcessingId(requestId);
        try {
            const res = await updateLeaveRequestStatus(requestId, action);
            if (res.success) {
                // Remove from local list or update status
                setRequests(prev => prev.filter(r => r.request_id !== requestId));
                alert(`Request ${action} successfully`);
            } else {
                alert('Error: ' + res.error);
            }
        } catch (error) {
            console.error('Action error:', error);
            alert('Failed to process request');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="min-h-screen">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Leave Management</h1>
                    <p className="text-slate-400">Review and authorize employee leave requests</p>
                </div>
                <div className="flex gap-2 p-1 bg-slate-900/50 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'pending' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        History
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 glass-panel border-dashed">
                    <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-400 font-mono text-sm">Querying Database...</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {requests.length > 0 ? (
                        requests.map((req) => (
                            <div key={req.request_id || req.id} className="glass-panel p-6 hover:border-slate-700 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                            <span className="text-lg font-bold text-cyan-400">{req.employee_name?.charAt(0) || 'E'}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-lg font-bold text-white">{req.employee_name}</h3>
                                                <span className="text-xs text-slate-500 font-mono">#{req.request_id}</span>
                                                {req.is_half_day && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full uppercase tracking-wider">
                                                        ⚡ Half-Day Priority
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <span className="text-slate-600 font-medium uppercase text-[10px]">Type:</span>
                                                    <span className="text-cyan-400">{req.leave_type}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="text-slate-600 font-medium uppercase text-[10px]">Dates:</span>
                                                    {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="text-slate-600 font-medium uppercase text-[10px]">Total:</span>
                                                    {req.total_days} days
                                                </span>
                                            </div>
                                            {req.reason && (
                                                <p className="mt-3 text-sm text-slate-300 bg-slate-800/50 p-3 rounded border border-slate-700/50 italic">
                                                    "{req.reason}"
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* AI Analysis Section */}
                                    {req.ai_analysis && (req.ai_analysis as any).violations?.length > 0 && (
                                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                            <h4 className="text-red-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                                                <span>⚠️ Constraint Violations</span>
                                            </h4>
                                            <ul className="space-y-1">
                                                {(req.ai_analysis as any).violations.map((v: any, idx: number) => (
                                                    <li key={idx} className="text-sm text-slate-300 flex gap-2">
                                                        <span className="text-red-500">•</span>
                                                        <span>
                                                            <strong className="text-white">{v.rule_name}:</strong> {v.message.replace('❌ ', '')}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {filter === 'pending' ? (
                                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50 justify-end">
                                            <button
                                                disabled={processingId === req.request_id}
                                                onClick={() => handleAction(req.request_id, 'approved')}
                                                className="px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded-lg hover:bg-emerald-600 hover:text-white transition-all text-sm font-bold disabled:opacity-50"
                                            >
                                                {processingId === req.request_id ? 'Wait...' : 'Approve Request'}
                                            </button>
                                            <button
                                                disabled={processingId === req.request_id}
                                                onClick={() => handleAction(req.request_id, 'rejected')}
                                                className="px-4 py-2 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded-lg hover:bg-rose-600 hover:text-white transition-all text-sm font-bold disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mt-4 flex justify-end">
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                req.status === 'rejected' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                    'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                                }`}>
                                                {req.status}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center p-16 glass-panel border-dashed">
                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                <span className="text-3xl">☕</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">Queue Clear</h3>
                            <p className="text-slate-400">There are no {filter} requests at the moment.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
