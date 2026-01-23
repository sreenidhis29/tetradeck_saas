"use client";

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Clock, Calendar, FileText, Activity, LogIn, LogOut, CheckCircle2, Sparkles, Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmployeeDashboardStats, analyzeLeaveRequest, getTodayAttendance, checkIn, checkOut } from '@/app/actions/employee';
import { checkFeatureAccess } from '@/app/actions/onboarding';

export default function EmployeeDashboard() {
    const { user } = useUser();
    const router = useRouter();
    
    // Access control state
    const [accessStatus, setAccessStatus] = useState<{
        hasAccess: boolean;
        isPending: boolean;
        loading: boolean;
    }>({ hasAccess: false, isPending: false, loading: true });
    
    const [data, setData] = useState({
        leaveBalance: 0,
        annualBalance: 0,
        annualTotal: 20,
        sickBalance: 0,
        sickTotal: 10,
        attendance: "0%",
        pendingRequests: 0,
        performance: "N/A",
        allBalances: [] as any[], // Added for Holiday Bank
        history: [] as any[]      // Added for context
    });
    const [loading, setLoading] = useState(true);

    // AI State
    const [query, setQuery] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);

    // Check-in State
    const [checkInStatus, setCheckInStatus] = useState<{
        checked_in: boolean;
        checked_out: boolean;
        check_in_time: string | null;
        check_out_time: string | null;
    } | null>(null);
    const [checkInLoading, setCheckInLoading] = useState(false);
    const [checkInMessage, setCheckInMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Check access and redirect if needed
    useEffect(() => {
        const checkAccess = async () => {
            const result = await checkFeatureAccess();
            
            // If not approved, check if pending
            if (!result.hasAccess && result.reason === "pending_approval") {
                setAccessStatus({ hasAccess: false, isPending: true, loading: false });
            } else if (!result.hasAccess) {
                // Not authenticated or no profile
                router.push("/employee/sign-in");
            } else {
                // Check if we need to show welcome/tutorial
                if ((result as any).showWelcome) {
                    // Local fallback: if we've already marked welcome locally, skip redirect
                    try {
                        const uid = user?.id || "unknown";
                        const localFlag = typeof window !== 'undefined' ? window.localStorage.getItem(`welcome_shown_${uid}`) : null;
                        if (!localFlag) {
                            router.push("/employee/welcome");
                            return;
                        }
                    } catch {}
                }
                setAccessStatus({ hasAccess: true, isPending: false, loading: false });
            }
        };
        checkAccess();
    }, [router, user?.id]);

    useEffect(() => {
        // Only fetch data if user has access
        if (!accessStatus.hasAccess || accessStatus.loading) return;
        
        const fetchData = async () => {
            const [statsRes, attendanceRes] = await Promise.all([
                getEmployeeDashboardStats(),
                getTodayAttendance()
            ]);
            
            if (statsRes.success && statsRes.stats) {
                setData({
                    leaveBalance: statsRes.stats.leaveBalance,
                    annualBalance: statsRes.stats.annualBalance,
                    annualTotal: statsRes.stats.annualTotal || 20,
                    sickBalance: statsRes.stats.sickBalance,
                    sickTotal: statsRes.stats.sickTotal || 10,
                    attendance: statsRes.stats.attendance,
                    pendingRequests: statsRes.stats.pendingRequests,
                    performance: statsRes.stats.performance,
                    allBalances: statsRes.allBalances || [],
                    history: statsRes.history || []
                });
            }
            
            if (attendanceRes.success) {
                setCheckInStatus({
                    checked_in: attendanceRes.checked_in ?? false,
                    checked_out: attendanceRes.checked_out ?? false,
                    check_in_time: attendanceRes.check_in_time ?? null,
                    check_out_time: attendanceRes.check_out_time ?? null
                });
            }
            
            setLoading(false);
        };
        fetchData();
    }, [accessStatus.hasAccess, accessStatus.loading]);

    const handleAskAI = async () => {
        // Block if pending approval
        if (accessStatus.isPending) {
            setAiResult({ blocked: true, message: "AI features are locked until your account is approved." });
            return;
        }
        if (!query.trim()) return;
        setAiLoading(true);
        setAiResult(null);

        const res = await analyzeLeaveRequest(query);
        if (res.success) {
            setAiResult(res.data);
        } else {
            console.error(res.error);
        }
        setAiLoading(false);
    };

    const handleCheckIn = async () => {
        // Block if pending approval
        if (accessStatus.isPending) {
            setCheckInMessage({ type: 'error', text: 'Check-in is locked until your account is approved.' });
            return;
        }
        setCheckInLoading(true);
        setCheckInMessage(null);
        try {
            const result = await checkIn();
            if (result.success) {
                setCheckInMessage({ type: 'success', text: result.message || 'Checked in!' });
                setCheckInStatus(prev => ({
                    ...prev!,
                    checked_in: true,
                    check_in_time: result.check_in_time ?? null
                }));
            } else {
                setCheckInMessage({ type: 'error', text: result.error || 'Failed' });
            }
        } catch (error) {
            setCheckInMessage({ type: 'error', text: 'Error occurred' });
        }
        setCheckInLoading(false);
        // Clear message after 3 seconds
        setTimeout(() => setCheckInMessage(null), 3000);
    };

    const handleCheckOut = async () => {
        setCheckInLoading(true);
        setCheckInMessage(null);
        try {
            const result = await checkOut();
            if (result.success) {
                setCheckInMessage({ type: 'success', text: `${result.message} - ${result.total_hours}h` });
                setCheckInStatus(prev => ({
                    ...prev!,
                    checked_out: true,
                    check_out_time: result.check_out_time ?? null
                }));
            } else {
                setCheckInMessage({ type: 'error', text: result.error || 'Failed' });
            }
        } catch (error) {
            setCheckInMessage({ type: 'error', text: 'Error occurred' });
        }
        setCheckInLoading(false);
        setTimeout(() => setCheckInMessage(null), 3000);
    };

    // Show loading state
    if (accessStatus.loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    className="w-10 h-10 border-2 border-[#00f2ff] border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
            </div>
        );
    }

    const stats = [
        { label: 'Leave Balance', value: `${Math.round(data.annualBalance)} Days`, icon: <Calendar />, color: 'from-blue-500 to-blue-600' },
        { label: 'Attendance', value: data.attendance, icon: <Clock />, color: 'from-emerald-500 to-emerald-600' },
        { label: 'Pending Requests', value: data.pendingRequests.toString(), icon: <FileText />, color: 'from-amber-500 to-amber-600' },
        { label: 'Performance', value: data.performance, icon: <Activity />, color: 'from-purple-500 to-purple-600' },
    ];

    const GuideShortcut = () => (
        <div className="flex items-center justify-end mb-4">
            <button
                onClick={() => router.push('/employee/welcome?tutorial=1')}
                className="px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
                Open Guide
            </button>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto">
            {/* Pending Approval Banner */}
            {accessStatus.isPending && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 rounded-xl">
                            <AlertTriangle className="w-6 h-6 text-amber-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-amber-200 font-semibold">Account Pending Approval</h3>
                            <p className="text-slate-400 text-sm">
                                Your registration is awaiting HR approval. Some features are temporarily locked.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-xl">
                            <Lock className="w-4 h-4 text-amber-400" />
                            <span className="text-amber-300 text-sm font-medium">Limited Access</span>
                        </div>
                    </div>
                </motion.div>
            )}

            <header className="mb-12">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-bold text-white mb-2"
                >
                    Welcome back, {user?.firstName}
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-400"
                >
                    Here's your daily overview and performance metrics.
                </motion.p>
            </header>

            {/* Guide Shortcut */}
            <GuideShortcut />

            {/* Animated Check-In Widget */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-8"
            >
                <div className="glass-panel p-6 relative overflow-hidden group">
                    {/* Animated Background Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* Animated Border Glow */}
                    <motion.div 
                        className="absolute inset-0 rounded-2xl"
                        animate={{
                            boxShadow: checkInStatus?.checked_in && !checkInStatus?.checked_out 
                                ? ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 30px 5px rgba(16, 185, 129, 0.3)', '0 0 0 0 rgba(16, 185, 129, 0)']
                                : '0 0 0 0 transparent'
                        }}
                        transition={{ duration: 2, repeat: checkInStatus?.checked_in && !checkInStatus?.checked_out ? Infinity : 0 }}
                    />
                    
                    <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <motion.div 
                                className={`p-4 rounded-2xl ${
                                    checkInStatus?.checked_out 
                                        ? 'bg-slate-700' 
                                        : checkInStatus?.checked_in 
                                            ? 'bg-emerald-500' 
                                            : 'bg-gradient-to-br from-cyan-500 to-purple-600'
                                }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {checkInStatus?.checked_out ? (
                                    <CheckCircle2 className="w-8 h-8 text-white" />
                                ) : checkInStatus?.checked_in ? (
                                    <LogOut className="w-8 h-8 text-white" />
                                ) : (
                                    <LogIn className="w-8 h-8 text-white" />
                                )}
                            </motion.div>
                            
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    Today's Attendance
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                                {checkInStatus?.check_in_time && (
                                    <p className="text-emerald-400 text-sm mt-1">
                                        ✓ Checked in at {checkInStatus.check_in_time}
                                        {checkInStatus.check_out_time && ` • Out at ${checkInStatus.check_out_time}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Check-in Message Toast */}
                            <AnimatePresence>
                                {checkInMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                            checkInMessage.type === 'success' 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        }`}
                                    >
                                        {checkInMessage.text}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Check-In/Out Button */}
                            {!checkInStatus?.checked_in ? (
                                <motion.button
                                    onClick={handleCheckIn}
                                    disabled={checkInLoading || loading}
                                    className="relative px-8 py-4 rounded-xl font-bold text-white overflow-hidden group/btn disabled:opacity-50"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {/* Animated Gradient Background */}
                                    <motion.div 
                                        className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"
                                        animate={{ 
                                            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] 
                                        }}
                                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                        style={{ backgroundSize: '200% 200%' }}
                                    />
                                    {/* Shine Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                    
                                    <span className="relative z-10 flex items-center gap-2">
                                        {checkInLoading ? (
                                            <motion.div 
                                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            />
                                        ) : (
                                            <LogIn className="w-5 h-5" />
                                        )}
                                        Check In
                                    </span>
                                </motion.button>
                            ) : !checkInStatus?.checked_out ? (
                                <motion.button
                                    onClick={handleCheckOut}
                                    disabled={checkInLoading}
                                    className="relative px-8 py-4 rounded-xl font-bold text-white overflow-hidden group/btn disabled:opacity-50 bg-gradient-to-r from-rose-500 to-orange-500"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                    <span className="relative z-10 flex items-center gap-2">
                                        {checkInLoading ? (
                                            <motion.div 
                                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            />
                                        ) : (
                                            <LogOut className="w-5 h-5" />
                                        )}
                                        Check Out
                                    </span>
                                </motion.button>
                            ) : (
                                <div className="px-6 py-4 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 font-medium flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    Day Complete
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {stats.map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-panel p-6 group hover:border-white/20 transition-all cursor-default"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                                {React.cloneElement(stat.icon as any, { size: 24 })}
                            </div>
                            <div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</div>
                                <div className="text-2xl font-bold text-white">
                                    {loading ? <span className="animate-pulse">...</span> : stat.value}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* AI Assistant Quick Access */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-panel p-8 md:col-span-2 relative overflow-hidden group min-h-[300px]"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity size={120} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-xl font-bold text-white mb-4">AI Leave Assistant</h2>
                        <p className="text-slate-400 mb-8 max-w-md">
                            Ask our AI about your leave eligibility, company policies, or apply for leave using natural language.
                        </p>

                        <div className="flex bg-slate-900/50 rounded-2xl p-2 border border-white/5 focus-within:border-pink-500/30 transition-colors mb-6">
                            <input
                                type="text"
                                placeholder="I need sick leave tomorrow..."
                                className="flex-1 bg-transparent px-4 py-3 text-white outline-none"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                            />
                            <button
                                onClick={handleAskAI}
                                disabled={aiLoading || !query}
                                className="bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold px-8 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50"
                            >
                                {aiLoading ? 'Thinking...' : 'Ask AI'}
                            </button>
                        </div>

                        <AnimatePresence>
                            {aiResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={`p-4 rounded-xl border ${aiResult.approved ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-full ${aiResult.approved ? 'bg-emerald-500' : 'bg-amber-500'} text-white`}>
                                            {aiResult.approved ? <Clock size={16} /> : <FileText size={16} />}
                                        </div>
                                        <div>
                                            <h3 className={`font-bold ${aiResult.approved ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {aiResult.status === 'APPROVED' ? 'AI Approved - Conditions Met' : 'Escalated to HR'}
                                            </h3>
                                            <p className="text-slate-300 text-sm mt-1">
                                                {aiResult.decision_reason || aiResult.message}
                                            </p>

                                            {!aiResult.approved && aiResult.violations && (
                                                <ul className="mt-2 space-y-1">
                                                    {aiResult.violations.map((v: any, i: number) => (
                                                        <li key={i} className="text-amber-200 text-sm list-disc list-inside">
                                                            {v.message.replace("❌ ", "")}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Holiday Bank Mini */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-panel p-8 md:col-span-1"
                >
                    <h2 className="text-xl font-bold text-white mb-6">Holiday Bank</h2>
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {data.allBalances && data.allBalances.length > 0 ? (
                            data.allBalances.map((bal: any, idx: number) => (
                                <div key={idx} className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 opacity-80 hover:opacity-100 transition-opacity">
                                    <div className="flex justify-between items-end mb-3">
                                        <span className="text-sm font-medium text-slate-400">{bal.type}</span>
                                        <span className="text-lg font-bold text-white">
                                            {Math.round(bal.available)}
                                            <span className="text-xs text-slate-500 font-normal ml-1">/ {Math.round(bal.total)}</span>
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${bal.type.includes('Annual') ? 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' :
                                                    bal.type.includes('Sick') ? 'bg-blue-500' :
                                                        'bg-cyan-500'
                                                }`}
                                            style={{ width: `${Math.min(100, Math.max(0, (bal.available / bal.total) * 100))}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-slate-500 text-center py-4">Loading balances...</div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
