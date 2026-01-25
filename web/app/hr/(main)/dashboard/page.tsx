import { getHRDashboardStats } from "@/app/actions/hr";
import Link from 'next/link';
import ActivityFeed from '@/components/ActivityFeed';
import { redirect } from "next/navigation";
import { Users, Calendar, Clock, TrendingUp, ArrowRight, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

// Force dynamic since we're fetching data that changes frequently
export const dynamic = 'force-dynamic';

export default async function HRDashboard() {
    const res = await getHRDashboardStats();

    if (!res.success || !res.data) {
        // Handle error state gracefully with better recovery options
        return (
            <div className="p-8 text-white flex flex-col items-center justify-center min-h-[60vh]">
                <div className="max-w-md text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-amber-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-4">Setup Required</h1>
                    <p className="text-slate-400 mb-6">{res.error || "Your account needs to be connected to an organization. Please complete the onboarding process."}</p>
                    <div className="flex flex-col gap-3">
                        <Link 
                            href="/onboarding?intent=hr" 
                            className="btn-primary inline-flex items-center justify-center gap-2"
                        >
                            Complete Onboarding
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link 
                            href="/sign-in" 
                            className="text-sm text-slate-500 hover:text-slate-300"
                        >
                            Sign in with a different account
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const { companyName, totalEmployees, pendingLeaves, activeLeaves, needsAttention } = res.data;
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <header className="relative">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-xs text-purple-400 font-medium">Operations Center</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{greeting} 👋</h1>
                        <p className="text-white/50">
                            Managing <span className="text-white font-medium">{companyName}</span> • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Link 
                            href="/hr/dashboard/advanced" 
                            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 hover:border-red-400/50 transition-all"
                        >
                            <Sparkles className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-300 font-medium">Command Center</span>
                        </Link>
                        <Link 
                            href="/hr/dashboard/ai-insights" 
                            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 hover:border-purple-400/50 transition-all"
                        >
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-purple-300 font-medium">AI Insights</span>
                        </Link>
                        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <div className="relative">
                                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                            </div>
                            <span className="text-sm text-emerald-400 font-medium">All Systems Operational</span>
                        </div>
                        <Link href="/hr/welcome?tutorial=1" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all">
                            Open Guide
                        </Link>
                    </div>
                </div>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <MetricCard 
                    title="Total Employees" 
                    value={totalEmployees.toString()} 
                    icon={Users}
                    trend="+2 this week"
                    color="purple"
                />
                <MetricCard 
                    title="On Leave Today" 
                    value={activeLeaves.toString()} 
                    icon={Calendar}
                    subtext={activeLeaves > 0 ? "Currently away" : "Everyone's here"}
                    color="cyan"
                />
                <MetricCard 
                    title="Pending Approvals" 
                    value={pendingLeaves.toString()} 
                    icon={Clock}
                    highlight={pendingLeaves > 0}
                    subtext={pendingLeaves > 0 ? "Needs attention" : "All caught up"}
                    color="amber"
                />
                <MetricCard 
                    title="Approval Rate" 
                    value="94%"
                    icon={TrendingUp}
                    trend="+5% this month"
                    color="emerald"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Needs Attention Section */}
                <section className="lg:col-span-2">
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${needsAttention.length > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                                    {needsAttention.length > 0 ? (
                                        <AlertCircle className="w-5 h-5 text-amber-400" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Needs Attention</h2>
                                    <p className="text-sm text-white/40">{needsAttention.length} pending requests</p>
                                </div>
                            </div>
                            <Link href="/hr/leave-requests" className="group flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors">
                                View All
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {needsAttention.length > 0 ? (
                                needsAttention.map((req, index) => (
                                    <div 
                                        key={req.id} 
                                        className="group relative p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-amber-500/20 transition-all duration-200"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        {/* Priority Indicator */}
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-amber-500"></div>
                                        
                                        <div className="flex items-center justify-between pl-3">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-white font-semibold text-sm">
                                                    {req.employeeName.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <h3 className="font-semibold text-white">{req.employeeName}</h3>
                                                        <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-[10px] text-white/50 uppercase font-medium tracking-wider">
                                                            {req.type}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-white/40">
                                                        {req.days} days • Starting {new Date(req.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <Link
                                                href={`/hr/leave-requests?id=${req.id}`}
                                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-300 transition-all duration-200"
                                            >
                                                Review
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-1">All caught up!</h3>
                                    <p className="text-sm text-white/40">No requests currently awaiting attention</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Activity Feed */}
                <section className="lg:col-span-1">
                    <ActivityFeed />
                </section>
            </div>
        </div>
    );
}

function MetricCard({ 
    title, 
    value, 
    icon: Icon,
    highlight = false,
    trend,
    subtext,
    color = 'purple'
}: { 
    title: string;
    value: string;
    icon: any;
    highlight?: boolean;
    trend?: string;
    subtext?: string;
    color?: 'purple' | 'cyan' | 'amber' | 'emerald';
}) {
    const colorClasses = {
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400',
        cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-400',
        amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400',
        emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
    };

    return (
        <div className="group stat-card hover:border-white/10">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorClasses[color]} border flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <span className="text-[11px] text-emerald-400 font-medium px-2 py-1 rounded-md bg-emerald-500/10">
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-1">{title}</p>
            <p className={`text-3xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p>
            {subtext && (
                <p className={`text-xs mt-1 ${highlight ? 'text-amber-400/60' : 'text-white/30'}`}>{subtext}</p>
            )}
        </div>
    );
}
