'use client';

import { getCompanyActivity } from "@/app/actions/hr";
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Activity, LogIn, Plane, Check, X, UserPlus, FileText, RefreshCw } from 'lucide-react';

export default function ActivityFeed() {
    const { getToken } = useAuth();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActivity = async () => {
        try {
            const res = await getCompanyActivity();
            if (res.success && res.activities) {
                setActivities(res.activities);
            }
        } catch (error) {
            console.error('Error fetching activity:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivity();
        const interval = setInterval(fetchActivity, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [getToken]);

    const getActivityConfig = (action: string) => {
        if (action.includes('login')) return { icon: LogIn, color: 'cyan', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' };
        if (action.includes('leave')) return { icon: Plane, color: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
        if (action.includes('approve')) return { icon: Check, color: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        if (action.includes('reject')) return { icon: X, color: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
        if (action.includes('join')) return { icon: UserPlus, color: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
        return { icon: FileText, color: 'slate', bg: 'bg-white/5', border: 'border-white/10' };
    };

    const formatTimeAgo = (date: string) => {
        const now = new Date();
        const then = new Date(date);
        const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
        
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="glass-card h-full">
            <div className="p-5 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-white">Live Activity</h3>
                            <p className="text-xs text-white/40">Real-time updates</p>
                        </div>
                    </div>
                    <button 
                        onClick={fetchActivity}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                {activities.length > 0 ? (
                    activities.map((log, index) => {
                        const config = getActivityConfig(log.action);
                        const Icon = config.icon;
                        
                        return (
                            <div 
                                key={log.id} 
                                className={`group relative flex gap-3 items-start p-3 rounded-xl ${config.bg} border ${config.border} hover:bg-white/[0.03] transition-all duration-200`}
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-4 h-4 text-${config.color}-400`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white/80 leading-relaxed">
                                        <span className="font-medium text-white">{log.actor_name || 'System'}</span>
                                        {' '}<span className="text-white/50">{log.change_summary || log.action.replace(/_/g, ' ')}</span>
                                    </p>
                                    <p className="text-[11px] text-white/30 mt-1 font-medium">
                                        {formatTimeAgo(log.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-white/20" />
                        </div>
                        <p className="text-sm text-white/30">No recent activity</p>
                    </div>
                )}
            </div>
        </div>
    );
}
