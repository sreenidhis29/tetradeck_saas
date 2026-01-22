/**
 * 📊 PUBLIC STATUS PAGE WITH SLA
 * 
 * This is what enterprise buyers check before signing contracts.
 * Shows uptime, service health, SLA guarantees, and incident history.
 * 
 * Access: /status (public, no auth required)
 */

import { getSystemStatus } from '@/lib/status/health';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ExternalLink, Shield, Zap, Award } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every minute

// SLA Configuration by Tier
const SLA_TIERS = {
    FREE: { uptime: 95.0, support: 'Community', responseTime: null },
    STARTER: { uptime: 99.0, support: 'Email (48h)', responseTime: '48 hours' },
    GROWTH: { uptime: 99.5, support: 'Priority (24h)', responseTime: '24 hours' },
    ENTERPRISE: { uptime: 99.9, support: '24/7 Phone', responseTime: '1 hour' },
};

export default async function StatusPage() {
    const status = await getSystemStatus();

    const statusConfig = {
        operational: {
            icon: CheckCircle2,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/30',
            label: 'All Systems Operational',
        },
        degraded: {
            icon: AlertTriangle,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/30',
            label: 'Degraded Performance',
        },
        outage: {
            icon: XCircle,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            label: 'Service Outage',
        },
    };

    const config = statusConfig[status.overall];
    const StatusIcon = config.icon;

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="border-b border-white/10">
                <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tighter">Continuum</h1>
                        <span className="text-slate-500">Status</span>
                    </div>
                    <a 
                        href="https://continuum.hr"
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        Go to Continuum <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-12">
                {/* Overall Status Banner */}
                <div className={`${config.bg} ${config.border} border rounded-2xl p-8 mb-8`}>
                    <div className="flex items-center gap-4">
                        <StatusIcon className={`w-12 h-12 ${config.color}`} />
                        <div>
                            <h2 className={`text-2xl font-bold ${config.color}`}>
                                {config.label}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">
                                Last checked: {new Date().toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Uptime Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Last 24 Hours', value: status.uptime.last24h },
                        { label: 'Last 7 Days', value: status.uptime.last7d },
                        { label: 'Last 30 Days', value: status.uptime.last30d },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-green-400">{stat.value}%</p>
                            <p className="text-slate-400 text-sm">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* SLA Guarantees */}
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="w-6 h-6 text-purple-400" />
                        <h3 className="text-xl font-bold">Service Level Agreements</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {Object.entries(SLA_TIERS).map(([tier, sla]) => (
                            <div key={tier} className="bg-white/5 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    {tier === 'ENTERPRISE' && <Award className="w-4 h-4 text-amber-400" />}
                                    <h4 className="font-semibold">{tier}</h4>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Uptime</span>
                                        <span className="font-bold text-green-400">{sla.uptime}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Support</span>
                                        <span className="text-white">{sla.support}</span>
                                    </div>
                                    {sla.responseTime && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Response</span>
                                            <span className="text-white">{sla.responseTime}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-slate-400 text-xs mt-4">
                        * SLA credits apply when uptime falls below guaranteed levels. Enterprise customers receive 10x credit for downtime.
                    </p>
                </div>

                {/* Service Status */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-white/10">
                        <h3 className="font-semibold">Service Status</h3>
                    </div>
                    <div className="divide-y divide-white/10">
                        {status.services.map((service, i) => {
                            const serviceConfig = statusConfig[service.status === 'down' ? 'outage' : service.status];
                            const ServiceIcon = serviceConfig.icon;

                            return (
                                <div key={i} className="px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <ServiceIcon className={`w-5 h-5 ${serviceConfig.color}`} />
                                        <span>{service.service}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {service.latency && (
                                            <span className="text-slate-500 text-sm flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {service.latency}ms
                                            </span>
                                        )}
                                        <span className={`text-sm ${serviceConfig.color}`}>
                                            {service.status === 'operational' ? 'Operational' : 
                                             service.status === 'degraded' ? 'Degraded' : 'Down'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Incidents */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10">
                        <h3 className="font-semibold">Recent Incidents</h3>
                    </div>
                    <div className="p-6">
                        {status.incidents.length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                                <p className="text-slate-400">No incidents in the past 90 days</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {status.incidents.map((incident) => (
                                    <div 
                                        key={incident.id}
                                        className="border border-white/10 rounded-xl p-4"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold">{incident.title}</h4>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                incident.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                incident.severity === 'major' ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {incident.severity}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-sm">
                                            {incident.affectedServices.join(', ')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Subscribe to Updates */}
                <div className="mt-8 text-center">
                    <p className="text-slate-400 mb-4">
                        Get notified about system status changes
                    </p>
                    <a 
                        href="mailto:status@continuum.hr"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        Subscribe to Updates
                    </a>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 mt-12">
                <div className="max-w-4xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
                    <p>© {new Date().getFullYear()} Continuum. All rights reserved.</p>
                    <p className="mt-2">
                        <a href="/security" className="hover:text-white">Security</a>
                        {' • '}
                        <a href="/privacy" className="hover:text-white">Privacy</a>
                        {' • '}
                        <a href="/terms" className="hover:text-white">Terms</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
