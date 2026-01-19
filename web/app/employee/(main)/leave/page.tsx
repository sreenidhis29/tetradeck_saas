"use client";

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, CheckCircle, AlertTriangle, FileText, Sparkles, ArrowRight } from 'lucide-react';
import { analyzeLeaveRequest } from '@/app/actions/leave-constraints';
import { submitLeaveRequest } from '@/app/actions/leave-transaction';
import { useRouter } from 'next/navigation';

export default function LeavePage() {
    const [input, setInput] = useState('');
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // Analysis Stage
    const handleAnalyze = () => {
        if (!input.trim()) return;

        // Mock extraction for MVP (or reliable Regex) until Python extracts it fully.
        // In real app, Python returns extraction. Here we do a quick client-parse fallback or ask user.
        // For this demo, let's assume the user enters "Vacation from 2024-02-01 to 2024-02-03" style or simply trust the extraction from action is handled or mocked.
        // However, `analyzeLeaveRequest` expects extracted info. 
        // Let's assume the Server Action will handle extraction or we infer simple dates here.
        // To make it robust without natural language parser on client:
        // We will pass the raw text to the Action; the Action calls Python; Python extracts.
        // BUT `analyzeLeaveRequest` signature I wrote expects detailed params.
        // Let's update `analyzeLeaveRequest` to accept raw text OR we parse here.
        // For simplicity, I'll add a simple regex parser here for demo purposes.

        // REGEX for Date: YYYY-MM-DD
        const dates = input.match(/\d{4}-\d{2}-\d{2}/g);
        const startDate = dates ? dates[0] : new Date().toISOString().split('T')[0];
        const endDate = dates && dates.length > 1 ? dates[1] : startDate;

        const typeMatch = input.match(/(sick|vacation|casual|annual)/i);
        const type = typeMatch ? typeMatch[0] : "Annual";

        // Calculate days
        const start = new Date(startDate);
        const end = new Date(endDate);
        let days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        
        // If half-day is selected, adjust the days count
        if (isHalfDay) {
            days = 0.5;
        }

        startTransition(async () => {
            const res = await analyzeLeaveRequest({
                type: isHalfDay ? `Half-Day ${type}` : type,
                reason: input,
                startDate,
                endDate,
                days: days > 0 ? days : 1,
                isHalfDay
            });

            if (res.success && res.analysis) {
                // Enhance result with extracted info for UI display
                const enrichedResult = {
                    ...res.analysis,
                    extracted_info: { 
                        leave_type: isHalfDay ? `Half-Day ${type}` : type, 
                        days: isHalfDay ? 0.5 : (days > 0 ? days : 1), 
                        start_date: startDate, 
                        end_date: endDate,
                        is_half_day: isHalfDay
                    }
                };
                setResult(enrichedResult);
            } else {
                alert("AI Analysis couldn't process this request. " + (res.error || ""));
            }
        });
    };

    const handleConfirm = () => {
        if (!result) return;

        startTransition(async () => {
            const res = await submitLeaveRequest({
                leaveType: result.extracted_info.leave_type,
                reason: input,
                startDate: result.extracted_info.start_date,
                endDate: result.extracted_info.end_date,
                days: result.extracted_info.days,
                isHalfDay: result.extracted_info.is_half_day || isHalfDay
            });

            if (res.success) {
                // Success styling or redirect
                router.push('/dashboard');
                // In production, show a toast here.
            } else {
                alert("Submission Failed: " + res.error);
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto min-h-screen pt-10 px-4">
            <header className="mb-12">
                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-4xl font-bold text-white mb-2 flex items-center gap-3"
                >
                    <Sparkles className="text-[#00f2ff]" /> AI Leave Assistant
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-400"
                >
                    Describe your request (e.g., "Sick leave 2024-03-01 to 2024-03-02"). Our engine checks 14+ business rules instantly.
                </motion.p>
            </header>

            {/* Input Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-8 mb-12 rounded-3xl relative overflow-hidden group shadow-2xl"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00f2ff] via-purple-500 to-[#00f2ff]"></div>

                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="E.g., I need sick leave from 2024-10-10 to 2024-10-12 due to fever."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f2ff]/50 transition-all min-h-[160px] resize-none text-lg leading-relaxed"
                />

                {/* Half-Day Toggle */}
                <div className="mt-4 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsHalfDay(!isHalfDay)}
                        className={`relative w-14 h-7 rounded-full transition-all duration-200 ${isHalfDay 
                            ? 'bg-gradient-to-r from-emerald-500 to-slate-500' 
                            : 'bg-slate-700'
                        }`}
                    >
                        <span 
                            className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-200 shadow-md ${
                                isHalfDay ? 'left-8' : 'left-1'
                            }`}
                        />
                    </button>
                    <span className={`text-sm font-medium ${isHalfDay ? 'text-emerald-400' : 'text-slate-400'}`}>
                        Half-Day Leave {isHalfDay && '(Requires HR Approval)'}
                    </span>
                    {isHalfDay && (
                        <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded-full border border-amber-500/30">
                            Priority Request
                        </span>
                    )}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
                    <div className="text-sm text-slate-500 flex items-center gap-2 italic">
                        <FileText size={14} /> Tip: Include dates (YYYY-MM-DD) for best accuracy.
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={isPending || !input.trim()}
                        className="bg-[#00f2ff] text-black hover:bg-[#00c8d2] px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                    >
                        {isPending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                        Analyze Request
                    </button>
                </div>
            </motion.div>

            {/* Results Section */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`rounded-3xl border p-8 backdrop-blur-xl ${result.approved
                            ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                            : 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]'
                            }`}
                    >
                        <div className="flex items-start gap-6">
                            <div className={`p-4 rounded-2xl ${result.approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                } shadow-inner`}>
                                {result.approved ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
                            </div>

                            <div className="flex-1">
                                <h3 className={`text-2xl font-bold mb-3 ${result.approved ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                    {result.approved ? 'Policy Compliant' : 'Review Required'}
                                </h3>
                                <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                                    {result.message}
                                </p>

                                {/* Extracted Details */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Type</div>
                                        <div className="font-bold text-white capitalize">{result.extracted_info?.leave_type || 'Annual'}</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Duration</div>
                                        <div className="font-bold text-white">{result.extracted_info?.days || 0} Days</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 lg:col-span-2">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Period</div>
                                        <div className="font-bold text-white truncate font-mono text-sm pt-1">
                                            {result.extracted_info?.start_date} <span className="text-slate-600">to</span> {result.extracted_info?.end_date}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleConfirm}
                                        disabled={isPending}
                                        className="bg-white text-black hover:bg-slate-200 px-8 py-4 rounded-xl font-bold transition-all shadow-xl flex items-center gap-2"
                                    >
                                        {isPending ? <Loader2 className="animate-spin" /> : "Confirm & Submit"} <ArrowRight size={16} />
                                    </button>
                                    <button
                                        onClick={() => setResult(null)}
                                        className="px-8 py-4 rounded-xl font-bold text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        Discard
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

