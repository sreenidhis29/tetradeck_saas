'use client';

import { getCompanyActivity } from "@/app/actions/hr";

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

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

    const getIcon = (action: string) => {
        if (action.includes('login')) return '🔓';
        if (action.includes('leave')) return '🏖️';
        if (action.includes('approve')) return '✅';
        if (action.includes('reject')) return '❌';
        if (action.includes('join')) return '👋';
        return '📝';
    };

    return (
        <div className="glass-panel p-6 h-full border-l-4 border-l-cyan-500/20">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Live Activity Feed
            </h3>

            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                {activities.length > 0 ? (
                    activities.map((log) => (
                        <div key={log.id} className="flex gap-3 items-start p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-sm">
                            <span className="text-lg mt-0.5">{getIcon(log.action)}</span>
                            <div>
                                <p className="text-slate-300">
                                    <span className="font-bold text-cyan-400">{log.actor_name || 'System'}</span>
                                    {' '}{log.change_summary || log.action.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-slate-500 font-mono mt-1">
                                    {new Date(log.created_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-500">
                        <p>No recent activity</p>
                    </div>
                )}
            </div>
        </div>
    );
}
