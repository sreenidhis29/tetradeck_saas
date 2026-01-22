"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, AlertTriangle, Settings, Edit2, X, Save } from "lucide-react";

interface PolicyRule {
    id: string;
    name: string;
    value: string;
    description: string;
    category: string;
    is_editable: boolean;
}

export default function LeavePolicyPage() {
    const [policies, setPolicies] = useState<PolicyRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingPolicy, setEditingPolicy] = useState<PolicyRule | null>(null);
    const [editValue, setEditValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    async function fetchPolicies() {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/policies');
            
            if (!response.ok) {
                throw new Error('Failed to load policies');
            }
            
            const result = await response.json();
            if (result.success && result.policies) {
                setPolicies(result.policies);
            } else {
                setPolicies([]);
            }
        } catch (err) {
            console.error('Error fetching policies:', err);
            setError('Unable to load policy settings. Please try again later.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchPolicies();
    }, []);

    const handleEditClick = (policy: PolicyRule) => {
        setEditingPolicy(policy);
        setEditValue(policy.value);
    };

    const handleSavePolicy = async () => {
        if (!editingPolicy) return;
        
        setIsSaving(true);
        try {
            const response = await fetch('/api/policies', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    policyId: editingPolicy.id,
                    value: editValue
                })
            });
            
            if (response.ok) {
                setEditingPolicy(null);
                await fetchPolicies(); // Refresh the list
            } else {
                alert('Failed to update policy. Please try again.');
            }
        } catch (err) {
            console.error('Error updating policy:', err);
            alert('An error occurred. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                <p className="text-slate-400">Loading policy settings...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Leave Policy</h1>
                    <p className="text-slate-400">Active operational constraints for your workspace.</p>
                </header>
                <div className="glass-panel p-12 text-center">
                    <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Service Unavailable</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (policies.length === 0) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Leave Policy</h1>
                    <p className="text-slate-400">Active operational constraints for your workspace.</p>
                </header>
                <div className="glass-panel p-12 text-center">
                    <Settings className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Policies Configured</h2>
                    <p className="text-slate-400 mb-6">
                        Leave policies have not been set up for your organization yet.
                    </p>
                    <p className="text-slate-500 text-sm">
                        Contact your system administrator to configure leave policies.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Leave Policy</h1>
                    <p className="text-slate-400">Active operational constraints for your workspace.</p>
                </div>
                <div className="px-3 py-1 bg-[#00f2ff]/10 text-[#00f2ff] text-xs font-mono rounded border border-[#00f2ff]/20">
                    CONSTRAINT ENGINE v1.0
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {policies.map((policy, i) => (
                    <motion.div
                        key={policy.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="glass-panel p-6 border border-white/5 hover:border-pink-500/50 transition-all group relative"
                    >
                        {policy.is_editable && (
                            <button 
                                onClick={() => handleEditClick(policy)}
                                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                            >
                                <Edit2 size={14} className="text-slate-400" />
                            </button>
                        )}
                        <h4 className="text-pink-400 font-mono text-xs mb-3 uppercase tracking-wider">{policy.name}</h4>
                        <div className="text-2xl font-bold text-white mb-2 group-hover:text-pink-200 transition-colors">{policy.value}</div>
                        <p className="text-slate-500 text-sm leading-relaxed">{policy.description}</p>
                    </motion.div>
                ))}
            </div>

            {/* Edit Policy Modal */}
            {editingPolicy && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Edit Policy</h3>
                            <button 
                                onClick={() => setEditingPolicy(null)} 
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-pink-400 font-mono uppercase mb-2">
                                    {editingPolicy.name}
                                </label>
                                <p className="text-sm text-slate-500 mb-4">
                                    {editingPolicy.description}
                                </p>
                            </div>
                            
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Value</label>
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-pink-500/50"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/10 flex gap-3">
                            <button
                                onClick={() => setEditingPolicy(null)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePolicy}
                                disabled={isSaving || editValue === editingPolicy.value}
                                className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={16} />
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
