import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ShieldCheck, Calendar, Activity, TrendingUp, AlertCircle, CheckCircle, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { EmployeeQuickActions } from "@/components/hr/EmployeeQuickActions";

export default async function EmployeeDeepDivePage({ params }: { params: { id: string } }) {
    // 1. Fetch Data
    const employee = await prisma.employee.findUnique({
        where: { emp_id: params.id },
        include: {
            leave_balances: true,
            leave_requests: {
                orderBy: { created_at: 'desc' },
                take: 5
            },
            company: true
        }
    });

    if (!employee) return notFound();

    // 2. Metrics
    const balance = employee.leave_balances.find(b => b.leave_type === 'Annual') || {
        annual_entitlement: 0, used_days: 0, pending_days: 0
    };
    const utilization = (Number(balance.used_days) / Number(balance.annual_entitlement)) * 100 || 0;

    // Calculate actual reliability metrics from leave requests
    const approvedCount = employee.leave_requests.filter(r => r.status === 'approved').length;
    const totalRequests = employee.leave_requests.length;
    
    // Calculate average advance notice (days between request creation and start date)
    const advanceNotices = employee.leave_requests
        .filter(r => r.created_at && r.start_date)
        .map(r => {
            const created = new Date(r.created_at);
            const start = new Date(r.start_date);
            return Math.max(0, Math.floor((start.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
        });
    const avgAdvanceNotice = advanceNotices.length > 0 
        ? Math.round(advanceNotices.reduce((a, b) => a + b, 0) / advanceNotices.length)
        : null;

    // Calculate average leave duration
    const leaveDurations = employee.leave_requests
        .filter(r => r.total_days)
        .map(r => Number(r.total_days));
    const avgDuration = leaveDurations.length > 0
        ? (leaveDurations.reduce((a, b) => a + b, 0) / leaveDurations.length).toFixed(1)
        : null;

    // Generate real AI insights based on actual data
    const insights: { type: 'positive' | 'neutral' | 'warning'; text: string }[] = [];
    
    if (avgAdvanceNotice !== null) {
        if (avgAdvanceNotice >= 14) {
            insights.push({
                type: 'positive',
                text: `Consistently requests leaves ${avgAdvanceNotice} days in advance on average. Low risk of operational disruption.`
            });
        } else if (avgAdvanceNotice >= 7) {
            insights.push({
                type: 'neutral',
                text: `Average advance notice is ${avgAdvanceNotice} days. Consider encouraging earlier requests.`
            });
        } else if (avgAdvanceNotice > 0) {
            insights.push({
                type: 'warning',
                text: `Average advance notice is only ${avgAdvanceNotice} days. May cause scheduling challenges.`
            });
        }
    }

    if (avgDuration !== null) {
        insights.push({
            type: 'neutral',
            text: `Average leave duration is ${avgDuration} days per request.`
        });
    }

    if (totalRequests > 0 && approvedCount === totalRequests) {
        insights.push({
            type: 'positive',
            text: `All ${totalRequests} leave requests have been approved. Excellent compliance with leave policies.`
        });
    }

    if (insights.length === 0) {
        insights.push({
            type: 'neutral',
            text: 'Not enough leave history to generate insights. Patterns will appear after more requests.'
        });
    }

    return (
        <div className="min-h-screen text-white p-8">
            {/* Header Profile */}
            <div className="flex items-center gap-6 mb-10">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#00f2ff] to-purple-500 p-1">
                    <div className="w-full h-full bg-black rounded-full flex items-center justify-center text-3xl font-bold">
                        {employee.full_name.charAt(0)}
                    </div>
                </div>
                <div>
                    <h1 className="text-4xl font-bold mb-1">{employee.full_name}</h1>
                    <div className="flex items-center gap-4 text-slate-400">
                        <span className="flex items-center gap-1"><ShieldCheck size={16} className="text-[#00f2ff]" /> {employee.position || 'Employee'}</span>
                        <span className="w-1 h-1 bg-slate-600 rounded-full" />
                        <span>{employee.department || 'General'}</span>
                        <span className="w-1 h-1 bg-slate-600 rounded-full" />
                        <span className="font-mono text-xs border border-slate-700 px-2 py-0.5 rounded text-slate-500">ID: {employee.emp_id}</span>
                    </div>
                </div>

                <div className="ml-auto glass-panel px-8 py-4 text-right">
                    <div className="text-sm text-slate-500 uppercase tracking-widest mb-1">Leave Requests</div>
                    <div className="text-4xl font-bold text-[#00f2ff]">{totalRequests}<span className="text-lg text-slate-500"> total</span></div>
                    <div className="text-xs text-slate-500 mt-1">{approvedCount} approved</div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT: Stats & Balance */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Balance Cards */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-10 bg-[#00f2ff]/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-[#00f2ff]/10 transition-all" />
                            <div className="text-slate-500 text-sm mb-2 uppercase">Annual Balance</div>
                            <div className="text-3xl font-bold text-white">
                                {Number(balance.annual_entitlement) - Number(balance.used_days)}
                                <span className="text-sm text-slate-500 font-normal ml-2">/ {Number(balance.annual_entitlement)}</span>
                            </div>
                            <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#00f2ff]" style={{ width: `${utilization}%` }} />
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-10 bg-purple-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-purple-500/10 transition-all" />
                            <div className="text-slate-500 text-sm mb-2 uppercase">Used Days</div>
                            <div className="text-3xl font-bold text-white">{Number(balance.used_days)}</div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-10 bg-orange-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-orange-500/10 transition-all" />
                            <div className="text-slate-500 text-sm mb-2 uppercase">Pending</div>
                            <div className="text-3xl font-bold text-orange-400">{Number(balance.pending_days)}</div>
                        </div>
                    </div>

                    {/* Recent Activity / History Table */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Activity size={18} className="text-purple-400" /> Recent Leave Requests</h3>
                        </div>
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-white/5 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Dates</th>
                                    <th className="p-4">Days</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">AI Rec</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {employee.leave_requests.map(req => (
                                    <tr key={req.request_id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-white capitalize">{req.leave_type}</td>
                                        <td className="p-4 font-mono text-xs">{(req.start_date as Date).toLocaleDateString()} &rarr; {(req.end_date as Date).toLocaleDateString()}</td>
                                        <td className="p-4">{Number(req.total_days)}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                                                req.status === 'pending' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="p-4 flex items-center gap-2">
                                            {req.ai_recommendation === 'approve' ?
                                                <span className="text-emerald-500 flex gap-1 items-center"><ShieldCheck size={12} /> PASS</span> :
                                                <span className="text-orange-500 flex gap-1 items-center"><AlertCircle size={12} /> REVIEW</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                                {employee.leave_requests.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center italic opacity-50">No leave history found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT: AI Insights */}
                <div className="space-y-6">
                    <div className="bg-[#00f2ff]/5 border border-[#00f2ff]/20 p-6 rounded-2xl">
                        <h3 className="text-[#00f2ff] font-bold mb-4 flex items-center gap-2"><Sparkles size={18} /> AI Insights</h3>
                        <ul className="space-y-4 text-sm text-slate-300">
                            {insights.map((insight, idx) => (
                                <li key={idx} className="flex gap-3 items-start">
                                    {insight.type === 'positive' ? (
                                        <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                                    ) : insight.type === 'warning' ? (
                                        <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                                    ) : (
                                        <TrendingUp size={16} className="text-purple-400 mt-0.5 shrink-0" />
                                    )}
                                    <span>{insight.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl">
                        <h3 className="font-bold mb-4 text-white">Quick Actions</h3>
                        <EmployeeQuickActions 
                            employeeId={employee.emp_id}
                            employeeName={employee.full_name}
                            leaveBalances={employee.leave_balances.map(b => ({
                                leave_type: b.leave_type,
                                annual_entitlement: Number(b.annual_entitlement),
                                used_days: Number(b.used_days),
                                pending_days: Number(b.pending_days)
                            }))}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
