"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
    Shield, ShieldCheck, ShieldAlert, ShieldX, 
    Activity, Clock, Database, FileText, Lock, 
    AlertTriangle, CheckCircle, XCircle, RefreshCw,
    Download, Search, Filter, Eye, BarChart3, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { 
    getComplianceDashboard, 
    getAuditLogs, 
    runIntegrityCheck,
    getSLAMetrics,
    exportAuditLogs,
    ComplianceDashboardData,
    ComplianceIssue
} from "@/app/actions/compliance";

export default function ComplianceDashboardPage() {
    const [dashboardData, setDashboardData] = useState<ComplianceDashboardData | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [slaMetrics, setSlaMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [checkingIntegrity, setCheckingIntegrity] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'sla' | 'issues'>('overview');

    // Fetch all data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashboardResult, auditResult, slaResult] = await Promise.all([
                getComplianceDashboard(),
                getAuditLogs({ limit: 20 }),
                getSLAMetrics()
            ]);

            if (dashboardResult.success && dashboardResult.data) {
                setDashboardData(dashboardResult.data);
            }
            if (auditResult.success && 'logs' in auditResult && auditResult.logs) {
                setAuditLogs(auditResult.logs);
            }
            if (slaResult.success && 'metrics' in slaResult && slaResult.metrics) {
                setSlaMetrics(slaResult.metrics);
            }
        } catch (error) {
            toast.error("Failed to load compliance data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Run integrity check
    const handleIntegrityCheck = async () => {
        setCheckingIntegrity(true);
        try {
            const result = await runIntegrityCheck();
            if (result.success && 'isValid' in result) {
                if (result.isValid) {
                    toast.success("Audit log integrity verified successfully!");
                } else {
                    toast.error(`Integrity check failed! ${result.invalidLogs?.length || 0} invalid entries found.`);
                }
                fetchData();
            }
        } catch (error) {
            toast.error("Failed to run integrity check");
        } finally {
            setCheckingIntegrity(false);
        }
    };

    // Export audit logs
    const handleExport = async (format: 'csv' | 'json') => {
        setExporting(true);
        try {
            const result = await exportAuditLogs(format);
            if (result.success && 'data' in result) {
                const blob = new Blob([result.data], { type: result.contentType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Export successful!");
            }
        } catch (error) {
            toast.error("Failed to export");
        } finally {
            setExporting(false);
        }
    };

    // Get score color
    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-500';
        if (score >= 70) return 'text-amber-500';
        if (score >= 50) return 'text-orange-500';
        return 'text-red-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 90) return 'from-green-500 to-emerald-500';
        if (score >= 70) return 'from-amber-500 to-yellow-500';
        if (score >= 50) return 'from-orange-500 to-amber-500';
        return 'from-red-500 to-rose-500';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                            <Shield className="w-8 h-8 text-indigo-600" />
                            Compliance Dashboard
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Monitor security, audit trails, and regulatory compliance
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleIntegrityCheck}
                            disabled={checkingIntegrity}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            {checkingIntegrity ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <ShieldCheck className="w-4 h-4" />
                            )}
                            Verify Integrity
                        </button>
                        <button
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
                        >
                            <Download className="w-4 h-4" />
                            Export Logs
                        </button>
                    </div>
                </motion.div>

                {/* Compliance Score */}
                {dashboardData && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6"
                    >
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            {/* Score Circle */}
                            <div className="relative w-40 h-40">
                                <svg className="w-full h-full -rotate-90">
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="70"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="12"
                                        className="text-gray-200 dark:text-gray-700"
                                    />
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="70"
                                        fill="none"
                                        stroke="url(#scoreGradient)"
                                        strokeWidth="12"
                                        strokeLinecap="round"
                                        strokeDasharray={`${dashboardData.complianceScore * 4.4} 440`}
                                    />
                                    <defs>
                                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor={dashboardData.complianceScore >= 70 ? '#10B981' : '#EF4444'} />
                                            <stop offset="100%" stopColor={dashboardData.complianceScore >= 70 ? '#3B82F6' : '#F59E0B'} />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-4xl font-bold ${getScoreColor(dashboardData.complianceScore)}`}>
                                        {dashboardData.complianceScore}
                                    </span>
                                    <span className="text-sm text-gray-500">Score</span>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                    <div className={`inline-flex p-2 rounded-lg mb-2 ${dashboardData.auditIntegrity.isValid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {dashboardData.auditIntegrity.isValid ? <ShieldCheck className="w-5 h-5" /> : <ShieldX className="w-5 h-5" />}
                                    </div>
                                    <p className="font-semibold">{dashboardData.auditIntegrity.isValid ? 'Valid' : 'Invalid'}</p>
                                    <p className="text-xs text-gray-500">Audit Integrity</p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                    <div className="inline-flex p-2 rounded-lg mb-2 bg-blue-100 text-blue-600">
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <p className="font-semibold">{dashboardData.activitySummary.totalLogs}</p>
                                    <p className="text-xs text-gray-500">Audit Logs (30d)</p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                    <div className="inline-flex p-2 rounded-lg mb-2 bg-amber-100 text-amber-600">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <p className="font-semibold">{dashboardData.securityPosture.failedLogins}</p>
                                    <p className="text-xs text-gray-500">Failed Logins</p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                    <div className="inline-flex p-2 rounded-lg mb-2 bg-purple-100 text-purple-600">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <p className="font-semibold">{dashboardData.dataRetention.logsOlderThan90Days}</p>
                                    <p className="text-xs text-gray-500">Old Logs</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 bg-white dark:bg-gray-800 rounded-xl p-1.5 shadow-sm">
                    {[
                        { id: 'overview', label: 'Overview', icon: BarChart3 },
                        { id: 'audit', label: 'Audit Trail', icon: FileText },
                        { id: 'sla', label: 'SLA Metrics', icon: Clock },
                        { id: 'issues', label: 'Issues', icon: AlertTriangle }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.id === 'issues' && dashboardData && dashboardData.issues.length > 0 && (
                                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                                    {dashboardData.issues.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'overview' && dashboardData && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Security Posture */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-indigo-500" />
                                    Security Posture
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Failed Login Attempts</span>
                                        <span className={`font-semibold ${dashboardData.securityPosture.failedLogins > 10 ? 'text-red-500' : 'text-green-500'}`}>
                                            {dashboardData.securityPosture.failedLogins}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Blocked IPs</span>
                                        <span className="font-semibold">{dashboardData.securityPosture.blockedIPs}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">CSRF Violations</span>
                                        <span className={`font-semibold ${dashboardData.securityPosture.csrfViolations > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                                            {dashboardData.securityPosture.csrfViolations}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Rate Limit Hits</span>
                                        <span className="font-semibold">{dashboardData.securityPosture.rateLimitHits}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Activity Summary */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-indigo-500" />
                                    Activity Summary
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Total Audit Logs</span>
                                        <span className="font-semibold">{dashboardData.activitySummary.totalLogs}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Security Events</span>
                                        <span className="font-semibold">{dashboardData.activitySummary.securityEvents}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">AI Decisions</span>
                                        <span className="font-semibold text-purple-500">{dashboardData.activitySummary.aiDecisions}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Last Activity</span>
                                        <span className="font-semibold text-sm">
                                            {dashboardData.activitySummary.lastActivityAt 
                                                ? new Date(dashboardData.activitySummary.lastActivityAt).toLocaleString()
                                                : 'N/A'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Data Retention */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                    <Database className="w-5 h-5 text-indigo-500" />
                                    Data Retention
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Logs &gt; 90 Days</span>
                                        <span className="font-semibold">{dashboardData.dataRetention.logsOlderThan90Days}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Pending Deletion</span>
                                        <span className="font-semibold">{dashboardData.dataRetention.pendingDeletion}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Last Cleanup</span>
                                        <span className="font-semibold text-sm">
                                            {dashboardData.dataRetention.lastCleanup 
                                                ? new Date(dashboardData.dataRetention.lastCleanup).toLocaleDateString()
                                                : 'Never'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* GDPR Status */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-indigo-500" />
                                    GDPR Status
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Pending Requests</span>
                                        <span className={`font-semibold ${dashboardData.gdprStatus.pendingRequests > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                                            {dashboardData.gdprStatus.pendingRequests}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Completed This Month</span>
                                        <span className="font-semibold">{dashboardData.gdprStatus.completedThisMonth}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Avg Response Time</span>
                                        <span className="font-semibold">{dashboardData.gdprStatus.avgResponseTime}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audit' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="font-semibold">Recent Audit Logs</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleExport('json')}
                                        className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        Export JSON
                                    </button>
                                    <button
                                        onClick={() => handleExport('csv')}
                                        className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        Export CSV
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actor</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IP</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Decision</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {auditLogs.map((log, index) => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        log.action.includes('APPROVED') ? 'bg-green-100 text-green-700' :
                                                        log.action.includes('REJECTED') || log.action.includes('FAILED') ? 'bg-red-100 text-red-700' :
                                                        log.action.includes('AI') ? 'bg-purple-100 text-purple-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {log.actor?.full_name || log.actor_id}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {log.entity_type}: {log.entity_id.slice(0, 8)}...
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                                                    {log.ip_address || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {log.decision && (
                                                        <span className={`px-2 py-1 text-xs rounded ${
                                                            log.decision === 'approved' ? 'bg-green-100 text-green-700' :
                                                            log.decision === 'rejected' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {log.decision}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sla' && slaMetrics && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                                    <TrendingUp className="w-8 h-8 text-green-600" />
                                </div>
                                <p className="text-3xl font-bold text-green-600">{slaMetrics.slaComplianceRate}%</p>
                                <p className="text-gray-500 mt-1">SLA Compliance Rate</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Clock className="w-8 h-8 text-blue-600" />
                                </div>
                                <p className="text-3xl font-bold text-blue-600">{slaMetrics.avgResponseTimeHours}h</p>
                                <p className="text-gray-500 mt-1">Avg Response Time</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                                </div>
                                <p className="text-3xl font-bold text-amber-600">{slaMetrics.slaBreaches}</p>
                                <p className="text-gray-500 mt-1">SLA Breaches</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                                <h4 className="font-semibold mb-4">Request Status</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Requests</span>
                                        <span className="font-semibold">{slaMetrics.totalRequests}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Resolved</span>
                                        <span className="font-semibold text-green-600">{slaMetrics.resolvedRequests}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Pending</span>
                                        <span className="font-semibold text-amber-600">{slaMetrics.pendingRequests}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'issues' && dashboardData && (
                        <div className="space-y-4">
                            {dashboardData.issues.length === 0 ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                                    <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                                    <h3 className="text-xl font-semibold text-green-600">All Clear!</h3>
                                    <p className="text-gray-500 mt-2">No compliance issues detected.</p>
                                </div>
                            ) : (
                                dashboardData.issues.map((issue, index) => (
                                    <motion.div
                                        key={issue.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-l-4 ${
                                            issue.severity === 'critical' ? 'border-red-500' :
                                            issue.severity === 'high' ? 'border-orange-500' :
                                            issue.severity === 'medium' ? 'border-amber-500' :
                                            'border-blue-500'
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`p-2 rounded-lg ${
                                                issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
                                                issue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                                                issue.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                                                'bg-blue-100 text-blue-600'
                                            }`}>
                                                <AlertTriangle className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-semibold">{issue.title}</h4>
                                                    <span className={`px-2 py-0.5 text-xs rounded-full uppercase font-medium ${
                                                        issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                        issue.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                                        issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {issue.severity}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{issue.category}</span>
                                                </div>
                                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{issue.description}</p>
                                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                                                    <p className="text-sm">
                                                        <span className="font-medium text-indigo-600">Recommendation:</span>{' '}
                                                        {issue.recommendation}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
