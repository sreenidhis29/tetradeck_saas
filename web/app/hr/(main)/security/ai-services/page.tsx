"use client";

import { useState, useEffect, useCallback } from "react";
import { 
    RefreshCw, 
    Activity, 
    CheckCircle, 
    XCircle, 
    AlertTriangle,
    Cpu,
    Database,
    Clock,
    Zap,
    Server,
    BarChart3,
    PlayCircle,
    PauseCircle
} from "lucide-react";

interface AIServiceStatus {
    name: string;
    description: string;
    endpoint: string;
    status: 'online' | 'offline' | 'degraded' | 'checking';
    lastCheck: string | null;
    responseTime: number | null;
    version: string | null;
    details: Record<string, any>;
}

const AI_SERVICES: Omit<AIServiceStatus, 'status' | 'lastCheck' | 'responseTime' | 'version' | 'details'>[] = [
    {
        name: "Leave Constraint Engine",
        description: "Evaluates leave requests against company policies and team constraints",
        endpoint: "http://127.0.0.1:8001/health"
    },
    {
        name: "Attendance Reminder Service",
        description: "Sends automated check-in/out reminders to employees",
        endpoint: "/api/attendance/reminder"
    },
    {
        name: "Leave Analysis API",
        description: "Analyzes leave requests using NLP and constraint satisfaction",
        endpoint: "/api/leaves/analyze"
    }
];

export default function AIServicesPage() {
    const [services, setServices] = useState<AIServiceStatus[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

    const refreshAllServices = useCallback(async () => {
        setIsRefreshing(true);
        
        // Set all to checking state
        setServices(AI_SERVICES.map(s => ({
            ...s,
            status: 'checking' as const,
            lastCheck: null,
            responseTime: null,
            version: null,
            details: {}
        })));

        try {
            // Use the API endpoint to check all services
            const response = await fetch('/api/ai/health', {
                method: 'GET',
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                setServices(data.services.map((s: any) => ({
                    name: s.name,
                    description: s.description,
                    endpoint: s.endpoint,
                    status: s.status,
                    lastCheck: s.lastCheck,
                    responseTime: s.responseTime,
                    version: s.version,
                    details: s.details
                })));
            } else {
                // Fallback to offline status
                setServices(AI_SERVICES.map(s => ({
                    ...s,
                    status: 'offline' as const,
                    lastCheck: new Date().toISOString(),
                    responseTime: null,
                    version: null,
                    details: { error: 'API unavailable' }
                })));
            }
        } catch (error) {
            // On error, set all services to offline
            setServices(AI_SERVICES.map(s => ({
                ...s,
                status: 'offline' as const,
                lastCheck: new Date().toISOString(),
                responseTime: null,
                version: null,
                details: { error: error instanceof Error ? error.message : 'Connection failed' }
            })));
        }
        
        setLastRefreshTime(new Date());
        setIsRefreshing(false);
    }, []);

    // Initial load
    useEffect(() => {
        refreshAllServices();
    }, [refreshAllServices]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        
        const interval = setInterval(refreshAllServices, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshAllServices]);

    const getStatusIcon = (status: AIServiceStatus['status']) => {
        switch (status) {
            case 'online':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'offline':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'degraded':
                return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case 'checking':
                return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
        }
    };

    const getStatusBadge = (status: AIServiceStatus['status']) => {
        const styles = {
            online: 'bg-green-500/20 text-green-400 border-green-500/30',
            offline: 'bg-red-500/20 text-red-400 border-red-500/30',
            degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            checking: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        };
        
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
                {status.toUpperCase()}
            </span>
        );
    };

    const onlineCount = services.filter(s => s.status === 'online').length;
    const offlineCount = services.filter(s => s.status === 'offline').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">AI Services</h1>
                    <p className="text-slate-400 mt-1">Monitor and manage AI engine health and status</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                            autoRefresh 
                                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                    >
                        {autoRefresh ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                        Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
                    </button>
                    <button
                        onClick={refreshAllServices}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh All
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Server className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Total Services</p>
                            <p className="text-2xl font-bold text-white">{services.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Online</p>
                            <p className="text-2xl font-bold text-green-400">{onlineCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Degraded</p>
                            <p className="text-2xl font-bold text-amber-400">{degradedCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Offline</p>
                            <p className="text-2xl font-bold text-red-400">{offlineCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Last Refresh */}
            {lastRefreshTime && (
                <div className="flex items-center gap-2 mb-4 text-slate-500 text-sm">
                    <Clock className="w-4 h-4" />
                    Last checked: {lastRefreshTime.toLocaleTimeString()}
                </div>
            )}

            {/* Service Cards */}
            <div className="space-y-4">
                {services.map((service, idx) => (
                    <div 
                        key={idx}
                        className={`bg-slate-800/50 border rounded-xl p-6 transition-all ${
                            service.status === 'offline' 
                                ? 'border-red-500/30' 
                                : service.status === 'degraded' 
                                    ? 'border-amber-500/30' 
                                    : 'border-slate-700/50'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${
                                    service.status === 'online' ? 'bg-green-500/10' :
                                    service.status === 'offline' ? 'bg-red-500/10' :
                                    service.status === 'degraded' ? 'bg-amber-500/10' :
                                    'bg-blue-500/10'
                                }`}>
                                    <Cpu className={`w-6 h-6 ${
                                        service.status === 'online' ? 'text-green-400' :
                                        service.status === 'offline' ? 'text-red-400' :
                                        service.status === 'degraded' ? 'text-amber-400' :
                                        'text-blue-400'
                                    }`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                                        {getStatusBadge(service.status)}
                                    </div>
                                    <p className="text-slate-400 text-sm mt-1">{service.description}</p>
                                    <p className="text-slate-500 text-xs mt-2 font-mono">{service.endpoint}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                {getStatusIcon(service.status)}
                            </div>
                        </div>

                        {/* Metrics */}
                        {service.status !== 'checking' && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-4 gap-4">
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Response Time</p>
                                    <p className={`text-lg font-mono ${
                                        service.responseTime === null ? 'text-red-400' :
                                        service.responseTime > 2000 ? 'text-amber-400' :
                                        'text-green-400'
                                    }`}>
                                        {service.responseTime !== null ? `${service.responseTime}ms` : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Version</p>
                                    <p className="text-lg font-mono text-slate-300">
                                        {service.version || 'Unknown'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Last Check</p>
                                    <p className="text-sm text-slate-300">
                                        {service.lastCheck ? new Date(service.lastCheck).toLocaleTimeString() : 'Never'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Details</p>
                                    {service.details.total_rules && (
                                        <p className="text-sm text-slate-300">{service.details.total_rules} rules loaded</p>
                                    )}
                                    {service.details.database && (
                                        <p className={`text-sm ${service.details.database === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                                            DB: {service.details.database}
                                        </p>
                                    )}
                                    {service.details.error && (
                                        <p className="text-sm text-red-400">{service.details.error}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Additional Info for Constraint Engine */}
                        {service.name === "Leave Constraint Engine" && service.details.total_rules && (
                            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                                <p className="text-xs text-slate-400 uppercase mb-2">Loaded Constraint Rules</p>
                                <div className="flex flex-wrap gap-2">
                                    {['RULE001: Max Duration', 'RULE002: Balance Check', 'RULE003: Team Coverage', 
                                      'RULE004: Concurrent Leave', 'RULE005: Blackout Dates', 'RULE006: Notice Period',
                                      'RULE007: Consecutive Limit', 'RULE013: Monthly Quota', 'RULE014: Half-Day'].map(rule => (
                                        <span key={rule} className="px-2 py-1 bg-violet-500/10 text-violet-400 text-xs rounded-md border border-violet-500/20">
                                            {rule}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reminder Schedule for Attendance Service */}
                        {service.name === "Attendance Reminder Service" && service.details.schedule && (
                            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                                <p className="text-xs text-slate-400 uppercase mb-2">Reminder Schedule</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500">Check-in Reminders</p>
                                        <p className="text-sm text-cyan-400">9:10 AM, 10:00 AM</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Check-out Reminders</p>
                                        <p className="text-sm text-cyan-400">3:00 PM, 4:10 PM</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Info Section */}
            <div className="mt-8 p-6 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-amber-400 mt-0.5" />
                    <div>
                        <h4 className="text-amber-400 font-medium">AI Service Architecture</h4>
                        <p className="text-slate-400 text-sm mt-1">
                            All AI decisions are logged to the audit trail. The Constraint Engine evaluates 9 business rules 
                            for each leave request. Services marked as "degraded" have response times exceeding 2 seconds.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
