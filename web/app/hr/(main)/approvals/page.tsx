"use client";

import React, { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import DashboardLayout from '@/components/hr/DashboardLayout';
import { Check, X, Clock, User, Calendar } from 'lucide-react';

export default function ApprovalsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);



    const { user } = useUser();
    const { getToken } = useAuth();

    const fetchRequests = async () => {
        try {
            const token = await getToken();
            const res = await fetch('http://localhost:5000/api/leaves/pending', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            }
        } catch (error) {
            console.error('Failed to fetch requests', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
        try {
            const token = await getToken();
            const endpoint = action === 'approve'
                ? `http://localhost:5000/api/leaves/approve/${requestId}`
                : `http://localhost:5000/api/leaves/reject/${requestId}`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    approvedBy: user?.fullName || 'HR User'
                })
            });
            if (res.ok) {
                // Optimistic update
                setRequests(prev => prev.filter(r => r.request_id !== requestId));
            } else {
                alert('Action failed');
            }
        } catch (error) {
            console.error(error);
            alert('Error performing action');
        }
    };



    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Pending Approvals</h1>
                    <p className="text-slate-400">Review leave requests escalated by the AI engine.</p>
                </header>

                {loading ? (
                    <div className="text-white">Loading...</div>
                ) : (
                    <div className="grid gap-4">
                        {requests.length === 0 && (
                            <div className="text-slate-500 text-center py-10 bg-slate-800/30 rounded-xl">
                                No pending requests
                            </div>
                        )}
                        {requests.map((req) => (
                            <div key={req.request_id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 backdrop-blur-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center">

                                <div className="flex items-center gap-4 min-w-[200px]">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white text-lg">
                                        {req.employee_name?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{req.employee_name}</div>
                                        <div className="text-sm text-slate-400">{req.department}</div>
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                                    <div className="bg-slate-900/50 p-3 rounded-lg">
                                        <div className="text-xs text-slate-500 uppercase mb-1">Type</div>
                                        <div className="font-medium text-white flex items-center gap-2">
                                            <Clock size={14} className="text-purple-400" />
                                            {req.leave_type}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg">
                                        <div className="text-xs text-slate-500 uppercase mb-1">Duration</div>
                                        <div className="font-medium text-white flex items-center gap-2">
                                            <Calendar size={14} className="text-blue-400" />
                                            {req.total_days} Days
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg col-span-2">
                                        <div className="text-xs text-slate-500 uppercase mb-1">Reason</div>
                                        <div className="font-medium text-slate-300 truncate" title={req.reason}>
                                            {req.reason}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 min-w-[140px]">
                                    <button
                                        onClick={() => handleAction(req.request_id, 'approve')}
                                        className="p-3 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors tooltip"
                                        title="Approve"
                                    >
                                        <Check size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleAction(req.request_id, 'reject')}
                                        className="p-3 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors tooltip"
                                        title="Reject"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
