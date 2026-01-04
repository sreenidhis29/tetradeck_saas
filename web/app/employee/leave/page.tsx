"use client";

import React, { useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { Send, Loader2, CheckCircle, AlertTriangle, XCircle, Calendar, FileText } from 'lucide-react';

export default function LeavePage() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);



    const { user } = useUser();
    const { getToken } = useAuth();

    const handleAnalyze = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setResult(null);

        try {
            // Verify token
            const token = await getToken();

            const res = await fetch('http://localhost:5000/api/leaves/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    request: input
                })
            });

            if (!res.ok) throw new Error('Analysis failed');
            const data = await res.json();
            setResult(data);
        } catch (error) {
            console.error(error);
            alert('Error analyzing request');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!result) return;
        setLoading(true);
        try {
            const token = await getToken();

            const payload = {
                type: result.extractedInfo?.leave_type || 'Annual',
                start_date: result.extractedInfo?.start_date,
                end_date: result.extractedInfo?.end_date,
                reason: input,
                half_day: result.extractedInfo?.is_half_day || false
            };

            const res = await fetch('http://localhost:5000/api/leaves/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to create request');

            alert('Leave Request Created Successfully!');
            setInput('');
            setResult(null);
        } catch (error) {
            console.error(error);
            alert('Error creating leave request');
        } finally {
            setLoading(false);
        }
    };



    return (
        <EmployeeLayout>
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">AI Leave Assistant</h1>
                    <p className="text-slate-400">Describe your leave request naturally. Our engine checks 14+ business rules instantly.</p>
                </header>

                {/* Input Section */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8 backdrop-blur-sm">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="E.g., I need sick leave tomorrow for a dentist appointment"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] resize-none"
                    />
                    <div className="flex justify-between items-center mt-4">
                        <div className="text-sm text-slate-500">
                            Try: "Vacation next Mon to Wed" or "Emergency leave today"
                        </div>
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !input.trim()}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                            Analyze Request
                        </button>
                    </div>
                </div>

                {/* Results Section */}
                {result && (
                    <div className={`rounded-2xl border p-6 animate-in fade-in slide-in-from-bottom-4 ${result.approved
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                        }`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full ${result.approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                {result.approved ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                            </div>

                            <div className="flex-1">
                                <h3 className={`text-xl font-bold mb-2 ${result.approved ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                    {result.approved ? 'Approved by AI' : 'Escalated for Review'}
                                </h3>
                                <p className="text-slate-300 mb-4">{result.message}</p>

                                {/* Extracted Details */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                                        <div className="text-xs text-slate-500 uppercase">Type</div>
                                        <div className="font-medium text-white">{result.extracted_info?.leave_type}</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                                        <div className="text-xs text-slate-500 uppercase">Dates</div>
                                        <div className="font-medium text-white">
                                            {result.extracted_info?.start_date} → {result.extracted_info?.end_date}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                                        <div className="text-xs text-slate-500 uppercase">Days</div>
                                        <div className="font-medium text-white">{result.extracted_info?.days} Days</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                                        <div className="text-xs text-slate-500 uppercase">Confidence</div>
                                        <div className="font-medium text-white">
                                            {(parseFloat(result.confidence || 0) * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleConfirm}
                                        className="bg-white text-slate-900 hover:bg-slate-200 px-6 py-2 rounded-lg font-bold transition-colors"
                                    >
                                        Confirm & Apply
                                    </button>
                                    <button
                                        onClick={() => setResult(null)}
                                        className="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EmployeeLayout>
    );
}
