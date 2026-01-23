import { getHRDashboardStats } from "@/app/actions/hr";
import Link from 'next/link';
import ActivityFeed from '@/components/ActivityFeed';
import { redirect } from "next/navigation";

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
                        <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-4">Setup Required</h1>
                    <p className="text-slate-400 mb-6">{res.error || "Your account needs to be connected to an organization. Please complete the onboarding process."}</p>
                    <div className="flex flex-col gap-3">
                        <Link 
                            href="/onboarding?intent=hr" 
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium"
                        >
                            Complete Onboarding
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

    return (
        <div>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Operations Center</h1>
                    <p className="text-slate-400">Organization: <span className="text-white font-semibold">{companyName}</span></p>
                </div>
                <div className="glass-panel px-4 py-2 flex gap-4 text-sm font-mono text-slate-300">
                    <span>Server: <span className="text-green-400">Node-Main</span></span>
                    <span>Status: <span className="text-green-400">Operational</span></span>
                    <Link href="/hr/welcome?tutorial=1" className="text-cyan-400 hover:text-cyan-300">Open Guide</Link>
                </div>
            </header>

            {/* Metrics Grid */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
                <MetricCard title="Total Employees" value={totalEmployees.toString()} />
                <MetricCard title="On Leave Today" value={activeLeaves.toString()} />
                <MetricCard title="Pending Approvals" value={pendingLeaves.toString()} highlight={pendingLeaves > 0} />
                <MetricCard title="Total Requests" value={(pendingLeaves + activeLeaves).toString()} />
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <section className="md:col-span-2">
                    {/* Needs Attention Queue */}
                    <div className="flex justify-between items-end mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {needsAttention.length > 0 ? (
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                            ) : (
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            )}
                            Needs Attention ({needsAttention.length})
                        </h2>
                        <Link href="/hr/leave-requests" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium">View All</Link>
                    </div>

                    <div className="grid gap-4">
                        {needsAttention.length > 0 ? (
                            needsAttention.map((req) => (
                                <div key={req.id} className="glass-panel p-4 flex justify-between items-center border-l-4 border-l-orange-500">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-white">{req.employeeName}</h3>
                                            <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 uppercase font-mono tracking-wider">{req.type}</span>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            Requested {req.days} days starting {new Date(req.startDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Link
                                        href={`/hr/leave-requests?id=${req.id}`}
                                        className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium text-sm transition-colors"
                                    >
                                        Review
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="glass-panel p-8 text-center text-slate-500 italic">
                                No requests currently awaiting attention.
                            </div>
                        )}
                    </div>
                </section>

                <section className="md:col-span-1 h-full">
                    <ActivityFeed />
                </section>
            </div>
        </div>
    );
}

function MetricCard({ title, value, highlight = false }: { title: string, value: string, highlight?: boolean }) {
    return (
        <div className="glass-panel p-6 group hover:border-cyan-500/30 transition-all duration-300">
            <p className="text-slate-400 text-sm mb-2 font-mono uppercase tracking-tighter">{title}</p>
            <p className={`text-3xl font-bold ${highlight ? 'text-orange-400' : 'text-white'}`}>{value}</p>
        </div>
    );
}
