"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Lock, Search, AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react';

interface Document {
    id: string;
    name: string;
    size: string;
    date: string;
    type: string;
    url?: string;
}

export default function DocumentsPage() {
    const [docs, setDocs] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        async function fetchDocuments() {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch('/api/documents');
                
                if (!response.ok) {
                    throw new Error('Failed to load documents');
                }
                
                const data = await response.json();
                if (data.success && data.documents) {
                    setDocs(data.documents);
                } else {
                    setDocs([]);
                }
            } catch (err) {
                console.error('Error fetching documents:', err);
                setError('Unable to load documents. Please try again later.');
            } finally {
                setLoading(false);
            }
        }
        fetchDocuments();
    }, []);

    const filteredDocs = docs.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                <p className="text-slate-400">Loading documents...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-5xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl font-bold text-white mb-2">Secure Docs</h1>
                    <p className="text-slate-400">Verified identity and document vault.</p>
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

    return (
        <div className="max-w-5xl mx-auto">
            <header className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-2">Secure Docs</h1>
                <p className="text-slate-400">Verified identity and document vault.</p>
            </header>

            <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-pink-500/30 transition-colors"
                />
            </div>

            {filteredDocs.length === 0 ? (
                <div className="glass-panel p-12 text-center">
                    <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Documents Found</h2>
                    <p className="text-slate-400">
                        {searchQuery ? 'No documents match your search.' : 'No documents have been uploaded yet.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredDocs.map((doc, i) => (
                        <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-panel p-6 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-all"
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-pink-500 transition-colors border border-white/5">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">{doc.name}</h3>
                                    <p className="text-xs text-slate-500">{doc.date} • {doc.size}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => doc.url && window.open(doc.url, '_blank')}
                                className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                            >
                                <Download size={20} />
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}

            <div className="mt-12 p-8 border border-white/5 rounded-3xl bg-slate-900/40 flex items-center gap-6">
                <div className="p-4 rounded-2xl bg-violet-500/10 text-violet-500">
                    <Lock size={32} />
                </div>
                <div>
                    <h4 className="text-white font-bold opacity-50">Identity Protection Active</h4>
                    <p className="text-sm text-slate-600">Your documents are encrypted using Enterprise-grade AES-256 protocols.</p>
                </div>
            </div>
        </div>
    );
}
