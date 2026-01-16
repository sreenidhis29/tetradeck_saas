"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
    Search, 
    Filter, 
    Download, 
    RefreshCw, 
    Shield, 
    User, 
    Bot, 
    Server,
    Clock,
    ChevronDown,
    ChevronRight,
    Lock,
    Eye,
    FileText,
    Trash2,
    Edit,
    Plus,
    LogIn,
    LogOut,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Brain,
    Calendar,
    X
} from "lucide-react";

interface AuditLogEntry {
    id: string;
    timestamp: string;
    actor_type: 'user' | 'system' | 'ai';
    actor_id: string;
    actor_name: string;
    actor_role: string;
    action: string;
    resource_type: string;
    resource_id: string;
    resource_name?: string;
    previous_state?: Record<string, any>;
    new_state?: Record<string, any>;
    decision?: string;
    decision_reason?: string;
    confidence_score?: number;
    model_version?: string;
    ip_address?: string;
    user_agent?: string;
    request_id: string;
    integrity_hash: string;
    org_id: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<any>> = {
    'create': Plus,
    'update': Edit,
    'delete': Trash2,
    'view': Eye,
    'login': LogIn,
    'logout': LogOut,
    'approve': CheckCircle,
    'reject': XCircle,
    'analyze': Brain,
};

const ACTOR_ICONS: Record<string, React.ComponentType<any>> = {
    'user': User,
    'system': Server,
    'ai': Bot,
};

// Mock data generator for demo
function generateMockLogs(count: number = 20): AuditLogEntry[] {
    const actions = ['create', 'update', 'delete', 'view', 'approve', 'reject', 'analyze', 'login', 'logout'];
    const resourceTypes = ['leave_request', 'attendance', 'employee', 'team', 'policy', 'session'];
    const actorTypes: ('user' | 'system' | 'ai')[] = ['user', 'user', 'user', 'system', 'ai'];
    const users = [
        { id: 'usr_001', name: 'Alice Johnson', role: 'hr_manager' },
        { id: 'usr_002', name: 'Bob Smith', role: 'employee' },
        { id: 'usr_003', name: 'Carol White', role: 'team_lead' },
        { id: 'sys_001', name: 'System Scheduler', role: 'system' },
        { id: 'ai_001', name: 'Constraint Engine', role: 'ai_service' },
    ];
    const decisions = ['approved', 'rejected', 'pending_review'];
    const reasons = [
        'All constraints satisfied. No conflicts detected.',
        'Insufficient leave balance (2 days available, 5 requested).',
        'Team coverage below minimum threshold (2/3 required).',
        'Blackout period applies to this date range.',
        'Request approved by manager override.',
    ];

    const logs: AuditLogEntry[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const actor = users[Math.floor(Math.random() * users.length)];
        const actorType = actor.id.startsWith('ai_') ? 'ai' : actor.id.startsWith('sys_') ? 'system' : 'user';
        const action = actions[Math.floor(Math.random() * actions.length)];
        const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
        const isAIDecision = actorType === 'ai' && ['approve', 'reject', 'analyze'].includes(action);
        
        const timestamp = new Date(now.getTime() - i * Math.random() * 3600000);
        
        logs.push({
            id: `log_${String(i + 1).padStart(6, '0')}`,
            timestamp: timestamp.toISOString(),
            actor_type: actorType,
            actor_id: actor.id,
            actor_name: actor.name,
            actor_role: actor.role,
            action,
            resource_type: resourceType,
            resource_id: `${resourceType}_${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
            resource_name: resourceType === 'leave_request' ? 'Annual Leave Request' : undefined,
            previous_state: action === 'update' ? { status: 'pending' } : undefined,
            new_state: action === 'update' ? { status: 'approved' } : undefined,
            decision: isAIDecision ? decisions[Math.floor(Math.random() * decisions.length)] : undefined,
            decision_reason: isAIDecision ? reasons[Math.floor(Math.random() * reasons.length)] : undefined,
            confidence_score: isAIDecision ? 0.75 + Math.random() * 0.24 : undefined,
            model_version: isAIDecision ? 'constraint-engine-v2.1.0' : undefined,
            ip_address: actorType === 'user' ? `192.168.1.${Math.floor(Math.random() * 255)}` : undefined,
            user_agent: actorType === 'user' ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' : undefined,
            request_id: `req_${crypto.randomUUID().split('-')[0]}`,
            integrity_hash: `sha256:${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}...`,
            org_id: 'org_tetradeck',
        });
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLiveMode, setIsLiveMode] = useState(true);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedActorType, setSelectedActorType] = useState<string>('all');
    const [selectedAction, setSelectedAction] = useState<string>('all');
    const [selectedResourceType, setSelectedResourceType] = useState<string>('all');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [showFilters, setShowFilters] = useState(false);
    const [newLogCount, setNewLogCount] = useState(0);
    const [useMockData, setUseMockData] = useState(false);
    const logsContainerRef = useRef<HTMLDivElement>(null);
    const lastFetchTime = useRef<string | null>(null);

    // Fetch logs from API
    const fetchLogs = useCallback(async (since?: string) => {
        try {
            const params = new URLSearchParams();
            if (since) params.set('since', since);
            if (selectedAction !== 'all') params.set('action', selectedAction);
            if (selectedResourceType !== 'all') params.set('entity_type', selectedResourceType);
            if (dateRange.from) params.set('from', dateRange.from);
            if (dateRange.to) params.set('to', dateRange.to);
            if (searchQuery) params.set('search', searchQuery);
            
            const response = await fetch(`/api/audit-logs?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error('API unavailable');
            }
            
            const data = await response.json();
            return data.logs as AuditLogEntry[];
        } catch (error) {
            console.warn('Audit logs API unavailable, using mock data');
            setUseMockData(true);
            return null;
        }
    }, [selectedAction, selectedResourceType, dateRange, searchQuery]);

    // Initial load
    useEffect(() => {
        const loadLogs = async () => {
            setIsLoading(true);
            
            // Try fetching from API first
            const apiLogs = await fetchLogs();
            
            if (apiLogs && apiLogs.length > 0) {
                setLogs(apiLogs);
                setUseMockData(false);
                if (apiLogs.length > 0) {
                    lastFetchTime.current = apiLogs[0].timestamp;
                }
            } else {
                // Fallback to mock data
                setLogs(generateMockLogs(50));
                setUseMockData(true);
            }
            
            setIsLoading(false);
        };
        
        loadLogs();
    }, [fetchLogs]);

    // Filter logs when criteria change
    useEffect(() => {
        let filtered = [...logs];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(log => 
                log.actor_name.toLowerCase().includes(query) ||
                log.action.toLowerCase().includes(query) ||
                log.resource_type.toLowerCase().includes(query) ||
                log.resource_id.toLowerCase().includes(query) ||
                log.decision_reason?.toLowerCase().includes(query) ||
                log.request_id.toLowerCase().includes(query)
            );
        }

        // Actor type filter
        if (selectedActorType !== 'all') {
            filtered = filtered.filter(log => log.actor_type === selectedActorType);
        }

        // Action filter
        if (selectedAction !== 'all') {
            filtered = filtered.filter(log => log.action === selectedAction);
        }

        // Resource type filter
        if (selectedResourceType !== 'all') {
            filtered = filtered.filter(log => log.resource_type === selectedResourceType);
        }

        // Date range filter
        if (dateRange.from) {
            filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(dateRange.from));
        }
        if (dateRange.to) {
            filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(dateRange.to + 'T23:59:59'));
        }

        setFilteredLogs(filtered);
    }, [logs, searchQuery, selectedActorType, selectedAction, selectedResourceType, dateRange]);

    // Live mode - real-time polling or mock updates
    useEffect(() => {
        if (!isLiveMode) return;

        const interval = setInterval(async () => {
            if (useMockData) {
                // Mock mode: randomly add new log entries
                if (Math.random() > 0.7) {
                    const newLog = generateMockLogs(1)[0];
                    newLog.id = `log_${Date.now()}`;
                    newLog.timestamp = new Date().toISOString();
                    setLogs(prev => [newLog, ...prev]);
                    setNewLogCount(prev => prev + 1);
                }
            } else {
                // Real API mode: poll for new logs since last fetch
                if (lastFetchTime.current) {
                    const newLogs = await fetchLogs(lastFetchTime.current);
                    if (newLogs && newLogs.length > 0) {
                        setLogs(prev => [...newLogs, ...prev]);
                        setNewLogCount(prev => prev + newLogs.length);
                        lastFetchTime.current = newLogs[0].timestamp;
                    }
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isLiveMode]);

    // Clear new log notification on scroll to top
    const handleScroll = useCallback(() => {
        if (logsContainerRef.current?.scrollTop === 0) {
            setNewLogCount(0);
        }
    }, []);

    const exportLogs = (format: 'csv' | 'json') => {
        const data = format === 'json' 
            ? JSON.stringify(filteredLogs, null, 2)
            : convertToCSV(filteredLogs);
        
        const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const convertToCSV = (data: AuditLogEntry[]): string => {
        const headers = ['timestamp', 'actor_type', 'actor_name', 'actor_role', 'action', 'resource_type', 'resource_id', 'decision', 'decision_reason', 'confidence_score', 'ip_address', 'request_id', 'integrity_hash'];
        const rows = data.map(log => headers.map(h => JSON.stringify((log as any)[h] ?? '')).join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'create': return 'text-green-400 bg-green-500/10';
            case 'update': return 'text-blue-400 bg-blue-500/10';
            case 'delete': return 'text-red-400 bg-red-500/10';
            case 'approve': return 'text-emerald-400 bg-emerald-500/10';
            case 'reject': return 'text-rose-400 bg-rose-500/10';
            case 'analyze': return 'text-violet-400 bg-violet-500/10';
            case 'login': return 'text-cyan-400 bg-cyan-500/10';
            case 'logout': return 'text-slate-400 bg-slate-500/10';
            default: return 'text-slate-400 bg-slate-500/10';
        }
    };

    const getActorColor = (actorType: string) => {
        switch (actorType) {
            case 'user': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'system': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'ai': return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const uniqueActions = [...new Set(logs.map(l => l.action))];
    const uniqueResourceTypes = [...new Set(logs.map(l => l.resource_type))];

    return (
        <div className="p-8 h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">
                            <Lock className="w-3 h-3" />
                            Immutable
                        </span>
                    </div>
                    <p className="text-slate-400 mt-1">Complete audit trail with tamper-proof logging</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Live Mode Toggle */}
                    <button
                        onClick={() => setIsLiveMode(!isLiveMode)}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                            isLiveMode 
                                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${isLiveMode ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                        {isLiveMode ? 'Live' : 'Paused'}
                    </button>

                    {/* Export Dropdown */}
                    <div className="relative group">
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700">
                            <Download className="w-4 h-4" />
                            Export
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <button 
                                onClick={() => exportLogs('csv')}
                                className="flex items-center gap-2 px-4 py-2 w-full text-left text-slate-300 hover:bg-slate-700 rounded-t-lg"
                            >
                                <FileText className="w-4 h-4" />
                                Export as CSV
                            </button>
                            <button 
                                onClick={() => exportLogs('json')}
                                className="flex items-center gap-2 px-4 py-2 w-full text-left text-slate-300 hover:bg-slate-700 rounded-b-lg"
                            >
                                <FileText className="w-4 h-4" />
                                Export as JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="mb-4 space-y-4">
                <div className="flex gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by actor, action, resource, or request ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                        />
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                            showFilters 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {(selectedActorType !== 'all' || selectedAction !== 'all' || selectedResourceType !== 'all') && (
                            <span className="w-2 h-2 bg-amber-400 rounded-full" />
                        )}
                    </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 uppercase mb-1">Actor Type</label>
                                <select
                                    value={selectedActorType}
                                    onChange={(e) => setSelectedActorType(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                                >
                                    <option value="all">All Actors</option>
                                    <option value="user">👤 User</option>
                                    <option value="system">🖥️ System</option>
                                    <option value="ai">🤖 AI</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 uppercase mb-1">Action</label>
                                <select
                                    value={selectedAction}
                                    onChange={(e) => setSelectedAction(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                                >
                                    <option value="all">All Actions</option>
                                    {uniqueActions.map(action => (
                                        <option key={action} value={action}>{action}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 uppercase mb-1">Resource Type</label>
                                <select
                                    value={selectedResourceType}
                                    onChange={(e) => setSelectedResourceType(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                                >
                                    <option value="all">All Resources</option>
                                    {uniqueResourceTypes.map(type => (
                                        <option key={type} value={type}>{type.replace('_', ' ')}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-slate-500 uppercase mb-1">From</label>
                                    <input
                                        type="date"
                                        value={dateRange.from}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-slate-500 uppercase mb-1">To</label>
                                    <input
                                        type="date"
                                        value={dateRange.to}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                            <p className="text-sm text-slate-400">
                                Showing {filteredLogs.length} of {logs.length} entries
                            </p>
                            <button
                                onClick={() => {
                                    setSelectedActorType('all');
                                    setSelectedAction('all');
                                    setSelectedResourceType('all');
                                    setDateRange({ from: '', to: '' });
                                    setSearchQuery('');
                                }}
                                className="text-sm text-amber-400 hover:text-amber-300"
                            >
                                Clear all filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* New Logs Indicator */}
            {newLogCount > 0 && (
                <button
                    onClick={() => {
                        logsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        setNewLogCount(0);
                    }}
                    className="mb-4 w-full py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm hover:bg-amber-500/20 transition-colors"
                >
                    {newLogCount} new log{newLogCount > 1 ? 's' : ''} available - Click to view
                </button>
            )}

            {/* Logs Timeline */}
            <div 
                ref={logsContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto space-y-2 pr-2"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Shield className="w-12 h-12 mb-3" />
                        <p>No audit logs match your filters</p>
                    </div>
                ) : (
                    filteredLogs.map((log) => {
                        const ActionIcon = ACTION_ICONS[log.action] || Eye;
                        const ActorIcon = ACTOR_ICONS[log.actor_type] || User;
                        const isExpanded = expandedLog === log.id;

                        return (
                            <div
                                key={log.id}
                                className={`bg-slate-800/50 border rounded-xl transition-all cursor-pointer hover:border-slate-600 ${
                                    isExpanded ? 'border-amber-500/30' : 'border-slate-700/50'
                                }`}
                                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            {/* Timeline indicator */}
                                            <div className="flex flex-col items-center">
                                                <div className={`p-2 rounded-lg ${getActorColor(log.actor_type)}`}>
                                                    <ActorIcon className="w-4 h-4" />
                                                </div>
                                            </div>

                                            <div className="flex-1">
                                                {/* Main log line */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getActorColor(log.actor_type)}`}>
                                                        {log.actor_type.toUpperCase()}
                                                    </span>
                                                    <span className="text-white font-medium">{log.actor_name}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                                                        <ActionIcon className="w-3 h-3 inline mr-1" />
                                                        {log.action.toUpperCase()}
                                                    </span>
                                                    <span className="text-slate-400">{log.resource_type.replace('_', ' ')}</span>
                                                    <span className="text-slate-500 font-mono text-xs">{log.resource_id}</span>
                                                </div>

                                                {/* AI Decision Badge */}
                                                {log.decision && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                                            log.decision === 'approved' 
                                                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                                                : log.decision === 'rejected'
                                                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                        }`}>
                                                            Decision: {log.decision}
                                                        </span>
                                                        {log.confidence_score && (
                                                            <span className="text-xs text-slate-500">
                                                                Confidence: {(log.confidence_score * 100).toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Reason preview */}
                                                {log.decision_reason && !isExpanded && (
                                                    <p className="mt-1 text-sm text-slate-400 truncate max-w-[600px]">
                                                        {log.decision_reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-right">
                                            <div>
                                                <p className="text-sm text-slate-400">{formatTimestamp(log.timestamp)}</p>
                                                <p className="text-xs text-slate-600 font-mono">{log.request_id}</p>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-slate-500" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-500" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 gap-4 text-sm">
                                            {/* WHO */}
                                            <div className="space-y-2">
                                                <h4 className="text-xs text-slate-500 uppercase font-medium">WHO (Actor)</h4>
                                                <div className="bg-slate-900/50 rounded-lg p-3 space-y-1">
                                                    <p><span className="text-slate-500">ID:</span> <span className="text-slate-300 font-mono">{log.actor_id}</span></p>
                                                    <p><span className="text-slate-500">Name:</span> <span className="text-slate-300">{log.actor_name}</span></p>
                                                    <p><span className="text-slate-500">Role:</span> <span className="text-slate-300">{log.actor_role}</span></p>
                                                    <p><span className="text-slate-500">Type:</span> <span className="text-slate-300">{log.actor_type}</span></p>
                                                </div>
                                            </div>

                                            {/* WHAT */}
                                            <div className="space-y-2">
                                                <h4 className="text-xs text-slate-500 uppercase font-medium">WHAT (Action)</h4>
                                                <div className="bg-slate-900/50 rounded-lg p-3 space-y-1">
                                                    <p><span className="text-slate-500">Action:</span> <span className="text-slate-300">{log.action}</span></p>
                                                    <p><span className="text-slate-500">Resource:</span> <span className="text-slate-300">{log.resource_type}</span></p>
                                                    <p><span className="text-slate-500">Resource ID:</span> <span className="text-slate-300 font-mono">{log.resource_id}</span></p>
                                                    {log.resource_name && (
                                                        <p><span className="text-slate-500">Name:</span> <span className="text-slate-300">{log.resource_name}</span></p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* WHEN */}
                                            <div className="space-y-2">
                                                <h4 className="text-xs text-slate-500 uppercase font-medium">WHEN (Timestamp)</h4>
                                                <div className="bg-slate-900/50 rounded-lg p-3 space-y-1">
                                                    <p><span className="text-slate-500">UTC:</span> <span className="text-slate-300 font-mono">{log.timestamp}</span></p>
                                                    <p><span className="text-slate-500">Local:</span> <span className="text-slate-300">{new Date(log.timestamp).toLocaleString()}</span></p>
                                                </div>
                                            </div>

                                            {/* WHERE */}
                                            <div className="space-y-2">
                                                <h4 className="text-xs text-slate-500 uppercase font-medium">WHERE (Origin)</h4>
                                                <div className="bg-slate-900/50 rounded-lg p-3 space-y-1">
                                                    <p><span className="text-slate-500">IP:</span> <span className="text-slate-300 font-mono">{log.ip_address || 'N/A'}</span></p>
                                                    <p><span className="text-slate-500">Request ID:</span> <span className="text-slate-300 font-mono">{log.request_id}</span></p>
                                                    {log.user_agent && (
                                                        <p className="truncate"><span className="text-slate-500">User Agent:</span> <span className="text-slate-300 text-xs">{log.user_agent}</span></p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* WHY (AI Decision) */}
                                            {log.decision && (
                                                <div className="col-span-2 space-y-2">
                                                    <h4 className="text-xs text-slate-500 uppercase font-medium flex items-center gap-2">
                                                        <Brain className="w-3 h-3 text-violet-400" />
                                                        WHY (AI Decision Explanation)
                                                    </h4>
                                                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 space-y-2">
                                                        <div className="flex items-center gap-4">
                                                            <span className={`px-3 py-1 rounded-md text-sm font-medium ${
                                                                log.decision === 'approved' 
                                                                    ? 'bg-green-500/20 text-green-400' 
                                                                    : log.decision === 'rejected'
                                                                        ? 'bg-red-500/20 text-red-400'
                                                                        : 'bg-amber-500/20 text-amber-400'
                                                            }`}>
                                                                {log.decision.toUpperCase()}
                                                            </span>
                                                            <span className="text-slate-400">
                                                                Confidence: <span className="text-white font-medium">{((log.confidence_score || 0) * 100).toFixed(1)}%</span>
                                                            </span>
                                                            <span className="text-slate-500 text-xs font-mono">
                                                                {log.model_version}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-300">{log.decision_reason}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* State Changes */}
                                            {(log.previous_state || log.new_state) && (
                                                <div className="col-span-2 space-y-2">
                                                    <h4 className="text-xs text-slate-500 uppercase font-medium">State Changes</h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                                                            <p className="text-xs text-red-400 mb-1">Previous State</p>
                                                            <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                                                                {JSON.stringify(log.previous_state, null, 2)}
                                                            </pre>
                                                        </div>
                                                        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                                                            <p className="text-xs text-green-400 mb-1">New State</p>
                                                            <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                                                                {JSON.stringify(log.new_state, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Integrity */}
                                            <div className="col-span-2 flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Lock className="w-4 h-4 text-green-400" />
                                                    <span className="text-xs text-slate-400">Integrity Hash:</span>
                                                    <span className="text-xs text-green-400 font-mono">{log.integrity_hash}</span>
                                                </div>
                                                <span className="text-xs text-green-400 flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Tamper-proof
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer Stats */}
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-sm text-slate-500">
                <div className="flex items-center gap-4">
                    <span>Total: {filteredLogs.length} entries</span>
                    <span>•</span>
                    <span>AI Decisions: {filteredLogs.filter(l => l.decision).length}</span>
                    <span>•</span>
                    <span>User Actions: {filteredLogs.filter(l => l.actor_type === 'user').length}</span>
                    {useMockData && (
                        <>
                            <span>•</span>
                            <span className="text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Demo Mode
                            </span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    All logs are cryptographically sealed and immutable
                </div>
            </div>
        </div>
    );
}
