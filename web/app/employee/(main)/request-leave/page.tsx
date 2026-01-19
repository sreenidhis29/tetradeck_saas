"use client";

import { useState, useEffect } from "react";
import { analyzeLeaveRequest } from "@/app/actions/employee";
import { CalendarDays, Sparkles, CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronLeft, ChevronRight, AlertCircle, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Helper function to format date as YYYY-MM-DD without timezone conversion
function formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

interface LeaveBalance {
    type: string;
    available: number;
    total: number;
}

interface EditableLeaveData {
    leaveType: string;
    startDate: string;
    endDate: string;
    duration: number;
    reason: string;
}

export default function RequestLeavePage() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [loadingBalances, setLoadingBalances] = useState(true);
    const [balanceError, setBalanceError] = useState<string | null>(null);
    const [editableData, setEditableData] = useState<EditableLeaveData | null>(null);
    const [showInvalidDatePopup, setShowInvalidDatePopup] = useState(false);

    const visibleSlides = 3;
    const maxSlide = Math.max(0, balances.length - visibleSlides);

    // Fetch real leave balances on mount
    useEffect(() => {
        setLoadingBalances(true);
        fetch('/api/leaves/balances')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.balances) {
                    setBalances(data.balances);
                    setBalanceError(null);
                } else {
                    setBalanceError(data.error || 'Failed to load balances');
                }
            })
            .catch(err => {
                console.error('Failed to load balances:', err);
                setBalanceError('Failed to connect to server');
            })
            .finally(() => setLoadingBalances(false));
    }, []);

    const nextSlide = () => {
        setCurrentSlide((prev) => Math.min(prev + 1, maxSlide));
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
    };

    const handleAskAI = async () => {
        if (!query.trim()) return;
        
        setLoading(true);
        setResult(null);
        setEditableData(null);
        setShowInvalidDatePopup(false);
        
        try {
            // Call the API route directly instead of server action
            const response = await fetch('/api/leaves/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ request: query }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Check if there's an invalid date
                if (data.data.invalidDate) {
                    setShowInvalidDatePopup(true);
                    setResult(data.data);
                    toast.error(`Invalid Date: ${data.data.error}`, {
                        description: `Try: ${data.data.suggestions?.join(' or ')}`,
                        duration: 8000,
                    });
                } else {
                    setResult(data.data);
                    // Initialize editable data from the parsed result
                    if (data.data.leave_request || data.data.parsed) {
                        const leaveReq = data.data.leave_request || {};
                        const parsed = data.data.parsed || {};
                        setEditableData({
                            leaveType: leaveReq.type || parsed.leaveType || 'Casual Leave',
                            startDate: leaveReq.start_date || parsed.startDate || '',
                            endDate: leaveReq.end_date || parsed.endDate || '',
                            duration: leaveReq.days_requested || parsed.duration || 1,
                            reason: query
                        });
                    }
                }
            } else {
                setResult({ 
                    error: data.error || "Failed to analyze request",
                    success: false 
                });
            }
        } catch (error) {
            setResult({ 
                error: error instanceof Error ? error.message : "Unknown error occurred",
                success: false 
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReanalyze = async () => {
        if (!editableData) return;
        
        setLoading(true);
        try {
            const response = await fetch('/api/leaves/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    request: editableData.reason,
                    leave_type: editableData.leaveType,
                    start_date: editableData.startDate,
                    end_date: editableData.endDate,
                    total_days: editableData.duration
                }),
            });
            
            const data = await response.json();
            if (data.success) {
                setResult(data.data);
            }
        } catch (error) {
            toast.error("Failed to re-analyze");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmRequest = async () => {
        if (!editableData || !result) return;
        
        setSubmitting(true);
        try {
            const response = await fetch('/api/leaves/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    leaveType: editableData.leaveType,
                    startDate: editableData.startDate,
                    endDate: editableData.endDate,
                    days: editableData.duration,
                    reason: editableData.reason,
                    aiRecommendation: result.recommendation,
                    aiConfidence: result.confidence,
                    aiAnalysis: result
                }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success("Leave Request Submitted!", {
                    description: `Request ${data.request?.request_id} has been ${data.request?.status || 'submitted'}`
                });
                // Reset form
                setQuery("");
                setResult(null);
                setEditableData(null);
                // Refresh balances
                fetch('/api/leaves/balances')
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.balances) {
                            setBalances(data.balances);
                        }
                    });
            } else {
                toast.error("Failed to submit", { description: data.error });
            }
        } catch (error) {
            toast.error("Failed to submit leave request");
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        if (status === 'approved' || status === 'APPROVED') return "text-green-400 border-green-500/30 bg-green-500/10";
        if (status === 'denied' || status === 'REJECTED') return "text-red-400 border-red-500/30 bg-red-500/10";
        return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    };

    return (
        <div className="min-h-screen bg-[#050507] text-white p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-white/10">
                        <CalendarDays className="w-6 h-6 text-pink-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Request Leave</h1>
                        <p className="text-slate-400">AI-powered leave request with instant constraint checking</p>
                    </div>
                </div>

                {/* Leave Balance Cards */}
                <div className="relative">
                    <div className="flex items-center gap-4">
                        {/* Left Arrow */}
                        <button
                            onClick={prevSlide}
                            disabled={currentSlide === 0}
                            className="p-3 rounded-xl bg-slate-800/50 border border-white/10 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>

                        {/* Cards Container */}
                        <div className="flex-1 overflow-hidden">
                            <div 
                                className="flex gap-4 transition-transform duration-300 ease-out"
                                style={{ transform: `translateX(-${currentSlide * (100 / visibleSlides + 1.33)}%)` }}
                            >
                                {balances.map((balance, idx) => (
                                    <div
                                        key={idx}
                                        className="min-w-[calc(33.333%-1rem)] p-6 rounded-2xl bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-white/10 backdrop-blur-xl"
                                    >
                                        <div className="text-sm text-slate-400 mb-2">{balance.type}</div>
                                        <div className="text-3xl font-bold text-white mb-1">
                                            {balance.available}
                                            <span className="text-lg text-slate-500">/{balance.total}</span>
                                        </div>
                                        <div className="text-xs text-slate-500">days available</div>
                                        <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
                                                style={{ width: `${(balance.available / balance.total) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Arrow */}
                        <button
                            onClick={nextSlide}
                            disabled={currentSlide >= maxSlide}
                            className="p-3 rounded-xl bg-slate-800/50 border border-white/10 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* AI Leave Assistant */}
                <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-white/10 backdrop-blur-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <Sparkles className="text-[#00f2ff]" />
                        <h2 className="text-2xl font-bold">AI Leave Assistant</h2>
                        <span className="px-3 py-1 text-xs rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                            Beta
                        </span>
                    </div>

                    <p className="text-slate-400 mb-6">
                        Describe your leave request naturally. Our AI analyzes team coverage, policy constraints, and suggests optimal dates.
                    </p>

                    {/* Input Area */}
                    <div className="space-y-4">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder='E.g., "I need sick leave on Feb 15th due to medical appointment" or "Can I take vacation from March 1-5?"'
                            className="w-full min-h-[120px] p-4 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    handleAskAI();
                                }
                            }}
                        />

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                Press Ctrl+Enter to submit
                            </span>
                            <button
                                onClick={handleAskAI}
                                disabled={loading || !query.trim()}
                                className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Analyze Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Results */}
                    <AnimatePresence>
                        {result && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="mt-8 p-6 rounded-xl bg-black/40 border border-white/10"
                            >
                                {/* Holiday Conflict Error (AUTO Mode) */}
                                {result.holidayConflict ? (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                            <Calendar className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
                                            <div>
                                                <h3 className="text-lg font-semibold text-orange-400 mb-2">🎉 This is a Public Holiday!</h3>
                                                <p className="text-slate-300 mb-4">{result.message}</p>
                                                {result.holiday && (
                                                    <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 mb-4">
                                                        <div className="font-semibold text-white">{result.holiday.name}</div>
                                                        <div className="text-sm text-orange-400">{result.parsed?.startDate}</div>
                                                    </div>
                                                )}
                                                <p className="text-sm text-slate-500">
                                                    In <strong>AUTO</strong> holiday mode, you don't need to request leave on public holidays - they're already off days!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : result.invalidDate ? (
                                    /* Invalid Date Error */
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                                            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                                            <div>
                                                <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Date Requested</h3>
                                                <p className="text-slate-300 mb-4">{result.error}</p>
                                                <p className="text-sm text-slate-400 mb-3">You requested: <span className="text-red-300 font-semibold">{result.requested_date}</span></p>
                                                
                                                {result.suggestions && result.suggestions.length > 0 && (
                                                    <div className="mt-4">
                                                        <p className="text-sm text-slate-400 mb-2">Did you mean one of these?</p>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {result.suggestions.map((suggestion: string, idx: number) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        setQuery(query.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}(?:st|nd|rd|th)?/gi, suggestion));
                                                                        setResult(null);
                                                                    }}
                                                                    className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors"
                                                                >
                                                                    <Calendar className="w-4 h-4 inline mr-2" />
                                                                    {suggestion}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : result.error ? (
                                    <div className="flex items-start gap-3">
                                        <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                                        <div>
                                            <h3 className="text-lg font-semibold text-red-400 mb-2">Analysis Failed</h3>
                                            <p className="text-slate-300">{result.error}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Holiday Warning (MANUAL Mode) */}
                                        {result.holiday_warning && (
                                            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                                <div className="flex items-start gap-3">
                                                    <Calendar className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-orange-400 mb-1">📅 Holiday Notice</h4>
                                                        <p className="text-sm text-slate-300">{result.holiday_warning.message}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Parsed Request Info - Editable */}
                                        {editableData && (
                                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                                <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Request Understood (Editable)
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <label className="text-slate-500 block mb-1">Leave Type:</label>
                                                        <select 
                                                            value={editableData.leaveType}
                                                            onChange={(e) => setEditableData({...editableData, leaveType: e.target.value})}
                                                            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-white font-semibold"
                                                        >
                                                            <option value="Sick Leave">Sick Leave</option>
                                                            <option value="Vacation Leave">Vacation Leave</option>
                                                            <option value="Casual Leave">Casual Leave</option>
                                                            <option value="Emergency Leave">Emergency Leave</option>
                                                            <option value="Maternity Leave">Maternity Leave</option>
                                                            <option value="Paternity Leave">Paternity Leave</option>
                                                            <option value="Bereavement Leave">Bereavement Leave</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-slate-500 block mb-1">Duration:</label>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={editableData.duration}
                                                            onChange={(e) => {
                                                                const days = parseInt(e.target.value) || 1;
                                                                const start = new Date(editableData.startDate);
                                                                const end = new Date(start);
                                                                end.setDate(end.getDate() + days - 1);
                                                                setEditableData({
                                                                    ...editableData, 
                                                                    duration: days,
                                                                    endDate: formatDateLocal(end)
                                                                });
                                                            }}
                                                            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-white font-semibold" 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-slate-500 block mb-1">Start Date:</label>
                                                        <input 
                                                            type="date" 
                                                            value={editableData.startDate}
                                                            onChange={(e) => {
                                                                const start = new Date(e.target.value);
                                                                const end = new Date(start);
                                                                end.setDate(end.getDate() + editableData.duration - 1);
                                                                setEditableData({
                                                                    ...editableData, 
                                                                    startDate: e.target.value,
                                                                    endDate: formatDateLocal(end)
                                                                });
                                                            }}
                                                            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-white font-semibold" 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-slate-500 block mb-1">End Date:</label>
                                                        <input 
                                                            type="date" 
                                                            value={editableData.endDate}
                                                            onChange={(e) => setEditableData({...editableData, endDate: e.target.value})}
                                                            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-white font-semibold" 
                                                        />
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={handleReanalyze}
                                                    disabled={loading}
                                                    className="mt-3 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
                                                >
                                                    {loading ? "Analyzing..." : "Re-analyze with Changes"}
                                                </button>
                                            </div>
                                        )}

                                        {/* Status Badge */}
                                        <div className="flex items-center gap-4">
                                            <div className={`px-4 py-2 rounded-full border font-semibold ${getStatusColor(result.recommendation || result.status || 'pending')}`}>
                                                {result.recommendation?.toUpperCase() || result.status?.toUpperCase() || 'PENDING'}
                                            </div>
                                            {result.processing_time_ms && (
                                                <span className="text-xs text-slate-500">
                                                    Analyzed in {result.processing_time_ms.toFixed(0)}ms
                                                </span>
                                            )}
                                        </div>

                                        {/* Message */}
                                        {(result.message || result.recommendation_reason || result.decision_reason) && (
                                            <div className="text-slate-300">
                                                {result.message || result.recommendation_reason || result.decision_reason}
                                            </div>
                                        )}

                                        {/* Constraints Summary */}
                                        {(result.summary || result.constraint_results) && (
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                                    <div className="text-2xl font-bold text-green-400">{result.constraint_results?.passed || result.summary?.passed || 0}</div>
                                                    <div className="text-xs text-slate-400">Passed</div>
                                                </div>
                                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                                    <div className="text-2xl font-bold text-red-400">{result.constraint_results?.failed || result.summary?.critical_failures || 0}</div>
                                                    <div className="text-xs text-slate-400">Failed</div>
                                                </div>
                                                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                                    <div className="text-2xl font-bold text-yellow-400">{result.summary?.warnings || 0}</div>
                                                    <div className="text-xs text-slate-400">Warnings</div>
                                                </div>
                                                <div className="p-4 rounded-xl bg-slate-700/30 border border-white/10">
                                                    <div className="text-2xl font-bold text-white">{result.constraint_results?.total_rules || result.summary?.total_rules || 0}</div>
                                                    <div className="text-xs text-slate-400">Total Rules</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Violations/Critical Failures */}
                                        {(result.constraints?.critical_failures?.length > 0 || result.constraint_results?.violations?.length > 0) && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                                                    <XCircle className="w-4 h-4" />
                                                    Critical Issues
                                                </h4>
                                                <div className="space-y-2">
                                                    {(result.constraint_results?.violations || result.constraints?.critical_failures || []).map((failure: any, idx: number) => (
                                                        <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm text-slate-300">
                                                            <div className="font-medium text-red-400">{failure.rule_name}</div>
                                                            <div>{failure.message}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Warnings */}
                                        {result.constraints?.warnings?.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Warnings
                                                </h4>
                                                <div className="space-y-2">
                                                    {result.constraints.warnings.map((warning: any, idx: number) => (
                                                        <div key={idx} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-slate-300">
                                                            {warning.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Suggestions */}
                                        {result.suggestions?.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-blue-400 mb-3">Suggestions</h4>
                                                <ul className="space-y-2">
                                                    {result.suggestions.map((suggestion: string, idx: number) => (
                                                        <li key={idx} className="text-sm text-slate-300 pl-4 border-l-2 border-blue-500/30">
                                                            {suggestion}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Alternative Dates */}
                                        {result.alternative_dates?.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-violet-400 mb-3">Alternative Dates</h4>
                                                <div className="flex gap-2 flex-wrap">
                                                    {result.alternative_dates.map((date: string, idx: number) => (
                                                        <span key={idx} className="px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm text-violet-300">
                                                            {date}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Confirm Button - Show for all valid analyzed requests */}
                                        {editableData && !result.invalidDate && (
                                            <div className="pt-4 border-t border-white/10">
                                                <button 
                                                    onClick={handleConfirmRequest}
                                                    disabled={submitting}
                                                    className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                                                        ${result.recommendation === 'approve' 
                                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg hover:shadow-green-500/25' 
                                                            : result.recommendation === 'reject'
                                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:shadow-lg hover:shadow-orange-500/25'
                                                            : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:shadow-blue-500/25'
                                                        } text-white disabled:opacity-50`}
                                                >
                                                    {submitting ? (
                                                        <>
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                            Submitting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-5 h-5" />
                                                            {result.recommendation === 'approve' 
                                                                ? 'Confirm & Submit Leave Request' 
                                                                : result.recommendation === 'reject'
                                                                ? 'Submit for HR Review (May be Rejected)'
                                                                : 'Submit for Approval'}
                                                        </>
                                                    )}
                                                </button>
                                                <p className="text-xs text-center text-slate-500 mt-2">
                                                    {result.recommendation === 'approve' 
                                                        ? 'Your request meets all policy requirements and will be auto-approved.'
                                                        : 'Your request will be sent to HR for manual review.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
