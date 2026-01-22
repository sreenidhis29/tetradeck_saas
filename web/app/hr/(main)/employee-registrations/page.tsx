"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    UserPlus, 
    CheckCircle, 
    XCircle, 
    Clock, 
    Mail, 
    MapPin, 
    Briefcase, 
    Building2,
    RefreshCw,
    Search,
    AlertTriangle,
    Check,
    X,
    ChevronDown,
    Sparkles
} from 'lucide-react';
import { getPendingEmployeeApprovals, approveEmployee, rejectEmployee, getRegistrationStats } from '@/app/actions/onboarding';

interface PendingEmployee {
    emp_id: string;
    full_name: string;
    email: string;
    department: string | null;
    position: string | null;
    work_location: string | null;
    onboarding_data: Record<string, unknown> | null;
    terms_accepted_at: Date | null;
}

interface RegistrationStats {
    pending: number;
    approvedToday: number;
    rejectedToday: number;
    approvedThisMonth: number;
}

export default function EmployeeApprovalsPage() {
    const [employees, setEmployees] = useState<PendingEmployee[]>([]);
    const [stats, setStats] = useState<RegistrationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchPending = async () => {
        setLoading(true);
        const [pendingResult, statsResult] = await Promise.all([
            getPendingEmployeeApprovals(),
            getRegistrationStats()
        ]);
        if (pendingResult.success && pendingResult.employees) {
            setEmployees(pendingResult.employees as PendingEmployee[]);
        }
        if (statsResult.success && statsResult.stats) {
            setStats(statsResult.stats);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleApprove = async (empId: string) => {
        setActionLoading(empId);
        const result = await approveEmployee(empId);
        if (result.success) {
            setEmployees(prev => prev.filter(e => e.emp_id !== empId));
        } else {
            alert(result.error || 'Failed to approve');
        }
        setActionLoading(null);
    };

    const handleReject = async (empId: string) => {
        if (!rejectReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }
        setActionLoading(empId);
        const result = await rejectEmployee(empId, rejectReason);
        if (result.success) {
            setEmployees(prev => prev.filter(e => e.emp_id !== empId));
            setRejectingId(null);
            setRejectReason('');
        } else {
            alert(result.error || 'Failed to reject');
        }
        setActionLoading(null);
    };

    const filteredEmployees = employees.filter(e => 
        e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.department?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.position?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-[#0a0a0f] p-6 lg:p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <UserPlus className="w-7 h-7 text-emerald-400" />
                            </div>
                            Employee Registrations
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Review and approve new employee registrations
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search employees..."
                                className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none w-64"
                            />
                        </div>

                        <button
                            onClick={fetchPending}
                            className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Stats Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-500/20 rounded-xl">
                                <Clock className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-amber-400 text-3xl font-bold">{stats?.pending ?? employees.length}</p>
                                <p className="text-slate-400 text-sm">Pending Approvals</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/20 rounded-xl">
                                <CheckCircle className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-emerald-400 text-3xl font-bold">{stats?.approvedToday ?? 0}</p>
                                <p className="text-slate-400 text-sm">Approved Today</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-[#00f2ff]/10 to-blue-500/5 border border-[#00f2ff]/20 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[#00f2ff]/20 rounded-xl">
                                <Sparkles className="w-6 h-6 text-[#00f2ff]" />
                            </div>
                            <div>
                                <p className="text-[#00f2ff] text-3xl font-bold">{stats?.approvedThisMonth ?? 0}</p>
                                <p className="text-slate-400 text-sm">This Month</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                            <RefreshCw className="w-8 h-8 text-[#00f2ff]" />
                        </motion.div>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl"
                    >
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
                        <p className="text-slate-400">No pending employee registrations to review</p>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {filteredEmployees.map((employee, index) => (
                                <motion.div
                                    key={employee.emp_id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors"
                                >
                                    {/* Main Row */}
                                    <div
                                        className="p-6 cursor-pointer"
                                        onClick={() => setSelectedEmployee(selectedEmployee === employee.emp_id ? null : employee.emp_id)}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                            {/* Avatar & Name */}
                                            <div className="flex items-center gap-4 min-w-[250px]">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                                                    {employee.full_name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white">{employee.full_name}</h3>
                                                    <p className="text-slate-400 text-sm flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {employee.email}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 flex flex-wrap gap-4">
                                                {employee.department && (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                                                        <Building2 className="w-4 h-4 text-slate-400" />
                                                        <span className="text-sm text-slate-300">{employee.department}</span>
                                                    </div>
                                                )}
                                                {employee.position && (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                                                        <Briefcase className="w-4 h-4 text-slate-400" />
                                                        <span className="text-sm text-slate-300">{employee.position}</span>
                                                    </div>
                                                )}
                                                {employee.work_location && (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                                                        <MapPin className="w-4 h-4 text-slate-400" />
                                                        <span className="text-sm text-slate-300">{employee.work_location}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Status Badge */}
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-medium flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Pending Review
                                                </span>
                                                <motion.div
                                                    animate={{ rotate: selectedEmployee === employee.emp_id ? 180 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                                </motion.div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    <AnimatePresence>
                                        {selectedEmployee === employee.emp_id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-6 pb-6 pt-2 border-t border-white/5">
                                                    {/* Additional Info */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                        <div className="p-4 bg-black/30 rounded-xl">
                                                            <h4 className="text-sm font-medium text-slate-400 mb-2">Employee ID</h4>
                                                            <p className="text-white font-mono">{employee.emp_id}</p>
                                                        </div>
                                                        <div className="p-4 bg-black/30 rounded-xl">
                                                            <h4 className="text-sm font-medium text-slate-400 mb-2">Terms Accepted</h4>
                                                            <p className="text-white">
                                                                {employee.terms_accepted_at
                                                                    ? new Date(employee.terms_accepted_at).toLocaleDateString()
                                                                    : 'Pending'
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Rejection Reason Input */}
                                                    {rejectingId === employee.emp_id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                                                        >
                                                            <label className="block text-sm font-medium text-red-300 mb-2">
                                                                Reason for Rejection
                                                            </label>
                                                            <textarea
                                                                value={rejectReason}
                                                                onChange={(e) => setRejectReason(e.target.value)}
                                                                placeholder="Please provide a reason..."
                                                                className="w-full bg-black/30 border border-red-500/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none resize-none"
                                                                rows={3}
                                                            />
                                                        </motion.div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-3">
                                                        {rejectingId === employee.emp_id ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleReject(employee.emp_id)}
                                                                    disabled={actionLoading === employee.emp_id}
                                                                    className="flex-1 py-3 px-6 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    {actionLoading === employee.emp_id ? (
                                                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <XCircle className="w-5 h-5" />
                                                                            Confirm Rejection
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setRejectingId(null);
                                                                        setRejectReason('');
                                                                    }}
                                                                    className="py-3 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleApprove(employee.emp_id)}
                                                                    disabled={actionLoading === employee.emp_id}
                                                                    className="flex-1 py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    {actionLoading === employee.emp_id ? (
                                                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <Check className="w-5 h-5" />
                                                                            Approve Employee
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => setRejectingId(employee.emp_id)}
                                                                    className="py-3 px-6 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold rounded-xl transition-colors flex items-center gap-2"
                                                                >
                                                                    <X className="w-5 h-5" />
                                                                    Reject
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
