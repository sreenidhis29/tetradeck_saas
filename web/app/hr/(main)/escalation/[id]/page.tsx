'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEscalationDetail, updateLeaveRequestStatus } from '@/app/actions/hr';
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle, MessageCircle, Loader2 } from 'lucide-react';

export default function EscalationDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [escalation, setEscalation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await getEscalationDetail(params.id);
                if (result.success && result.escalation) {
                    setEscalation(result.escalation);
                } else {
                    setError(result.error || 'Escalation not found');
                }
            } catch (err) {
                setError('Failed to load escalation');
            }
            setLoading(false);
        };
        fetchData();
    }, [params.id]);

    const handleAction = async (action: 'approved' | 'rejected') => {
        setActionLoading(true);
        try {
            const result = await updateLeaveRequestStatus(params.id, action);
            if (result.success) {
                router.push('/hr/leave-requests');
            } else {
                setError(result.error || 'Action failed');
            }
        } catch (err) {
            setError('Failed to process action');
        }
        setActionLoading(false);
    };

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                    <p className="text-slate-400">Loading escalation details...</p>
                </div>
            </div>
        );
    }

    if (error || !escalation) {
        return (
            <div className="p-8 max-w-4xl mx-auto min-h-screen">
                <div className="glass-panel p-12 text-center">
                    <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Escalation Not Found</h2>
                    <p className="text-slate-400 mb-6">{error || 'The requested escalation could not be found.'}</p>
                    <button 
                        onClick={() => router.push('/hr/leave-requests')}
                        className="px-6 py-3 bg-cyan-500 text-black font-bold rounded-xl hover:bg-cyan-400"
                    >
                        Back to Leave Requests
                    </button>
                </div>
            </div>
        );
    }

    // Parse AI analysis if available
    const aiAnalysis = escalation.ai_analysis || {};
    const violations = aiAnalysis.violations || [];
    const confidence = aiAnalysis.confidence || escalation.ai_confidence || 0.5;

    return (
        <div className="p-8 max-w-4xl mx-auto min-h-screen">
            <div className="mb-8">
                <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>
                <h1 className="text-3xl font-bold text-white">Escalation Review #{escalation.request_id}</h1>
                {escalation.is_half_day && (
                    <span className="inline-block mt-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-sm font-bold">
                        ⚡ Half-Day Priority Request
                    </span>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Left: Request Details */}
                <div className="md:col-span-2 space-y-6">
                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Request Details</h2>
                        <div className="grid grid-cols-2 gap-y-4 text-sm">
                            <div>
                                <span className="block text-slate-400">Employee</span>
                                <span className="text-white font-medium">{escalation.employee_name}</span>
                            </div>
                            <div>
                                <span className="block text-slate-400">Leave Type</span>
                                <span className="text-white font-medium">{escalation.leave_type}</span>
                            </div>
                            <div>
                                <span className="block text-slate-400">Duration</span>
                                <span className="text-white font-medium">
                                    {new Date(escalation.start_date).toLocaleDateString()} - {new Date(escalation.end_date).toLocaleDateString()} 
                                    ({escalation.total_days} days)
                                </span>
                            </div>
                            <div>
                                <span className="block text-slate-400">Submitted</span>
                                <span className="text-white font-medium">
                                    {new Date(escalation.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-slate-400">Reason</span>
                                <p className="text-white mt-1 bg-slate-800/50 p-3 rounded-lg border border-white/5">
                                    "{escalation.reason || 'No reason provided'}"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Violation Analysis */}
                    {violations.length > 0 && (
                        <div className="glass-panel p-6 border border-red-500/30 bg-red-500/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertTriangle className="w-24 h-24 text-red-500" />
                            </div>

                            <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Policy Violations Detected
                            </h2>

                            <div className="space-y-4">
                                {violations.map((v: any, idx: number) => (
                                    <div key={idx} className="bg-black/30 p-4 rounded-lg border border-red-500/20">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-lg font-bold text-white">{v.rule_name}</span>
                                            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">{v.rule_id}</span>
                                        </div>
                                        <p className="text-red-300">{v.message?.replace('❌ ', '')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h2 className="text-lg font-bold text-white mb-4">AI Recommendation</h2>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-2 flex-grow bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${confidence > 0.5 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                    style={{ width: `${confidence * 100}%` }}
                                />
                            </div>
                            <span className={`font-bold ${confidence > 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {escalation.ai_recommendation === 'approve' ? 'Approve' : 'Reject'} ({Math.round(confidence * 100)}%)
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-6">
                            {violations.length > 0 
                                ? `This request violates ${violations.length} policy rule(s). Manual review is required.`
                                : 'AI recommends approval based on policy compliance.'}
                        </p>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => handleAction('rejected')}
                                disabled={actionLoading}
                                className="w-full py-3 bg-red-500/10 border border-red-500/50 text-red-400 font-bold rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                Reject Request
                            </button>
                            <button 
                                onClick={() => handleAction('approved')}
                                disabled={actionLoading}
                                className="w-full py-3 bg-green-500/10 border border-green-500/50 text-green-400 font-bold rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Approve (Override)
                            </button>
                            <button 
                                className="w-full py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Ask for Clarification
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
