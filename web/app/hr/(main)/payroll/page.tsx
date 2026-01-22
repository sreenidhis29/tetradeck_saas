'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    DollarSign, 
    Users, 
    TrendingUp, 
    TrendingDown,
    Calendar,
    Download,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    FileText,
    Banknote,
    PiggyBank,
    Receipt,
    Eye,
    Send,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { calculatePayroll, processPayroll, approvePayroll, markPayrollPaid, exportPayrollCSV } from '@/app/actions/payroll';

interface PayrollRecord {
    emp_id: string;
    full_name: string;
    position: string;
    department: string;
    
    working_days: number;
    present_days: number;
    absent_days: number;
    half_days: number;
    late_days: number;
    
    paid_leave_days: number;
    unpaid_leave_days: number;
    
    basic_salary: number;
    per_day_salary: number;
    
    hra: number;
    travel_allowance: number;
    medical_allowance: number;
    special_allowance: number;
    total_allowances: number;
    
    lop_deduction: number;
    late_deduction: number;
    half_day_deduction: number;
    pf_deduction: number;
    tax_deduction: number;
    other_deductions: number;
    total_deductions: number;
    
    gross_salary: number;
    net_pay: number;
    
    status: 'draft' | 'processed' | 'approved' | 'paid';
}

interface PayrollSummary {
    month: string;
    year: number;
    total_employees: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    status: string;
}

export default function PayrollPage() {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
    const [summary, setSummary] = useState<PayrollSummary | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<{ working_days: number; holidays: number } | null>(null);

    useEffect(() => {
        loadPayroll();
    }, [selectedMonth, selectedYear]);

    const loadPayroll = async () => {
        setLoading(true);
        try {
            const result = await calculatePayroll(selectedMonth, selectedYear);
            
            if (result.success && 'payroll' in result) {
                setPayrollData(result.payroll || []);
                setSummary(result.summary || null);
                setMetadata(result.metadata || null);
            } else if ('error' in result) {
                toast.error(result.error || 'Failed to load payroll');
            }
        } catch (error) {
            console.error('Payroll load error:', error);
            toast.error('Failed to load payroll data');
        } finally {
            setLoading(false);
        }
    };

    const handleProcessPayroll = async () => {
        setProcessing(true);
        try {
            const result = await processPayroll(selectedMonth, selectedYear);
            
            if (result.success && 'message' in result) {
                toast.success(result.message || 'Payroll processed successfully');
                await loadPayroll();
            } else if ('error' in result) {
                toast.error(result.error || 'Failed to process payroll');
            }
        } catch (error) {
            toast.error('Error processing payroll');
        } finally {
            setProcessing(false);
        }
    };

    const handleApprovePayroll = async () => {
        setProcessing(true);
        try {
            const result = await approvePayroll(selectedMonth, selectedYear);
            
            if (result.success && 'message' in result) {
                toast.success(result.message || 'Payroll approved');
                await loadPayroll();
            } else if ('error' in result) {
                toast.error(result.error || 'Failed to approve payroll');
            }
        } catch (error) {
            toast.error('Error approving payroll');
        } finally {
            setProcessing(false);
        }
    };

    const handleMarkPaid = async () => {
        setProcessing(true);
        try {
            const result = await markPayrollPaid(selectedMonth, selectedYear);
            
            if (result.success && 'message' in result) {
                toast.success(result.message || 'Payroll marked as paid');
                await loadPayroll();
            } else if ('error' in result) {
                toast.error(result.error || 'Failed to mark as paid');
            }
        } catch (error) {
            toast.error('Error marking payroll as paid');
        } finally {
            setProcessing(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            const result = await exportPayrollCSV(selectedMonth, selectedYear);
            
            if (result.success && 'csv' in result && result.csv) {
                const blob = new Blob([result.csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename || `payroll_${selectedMonth}_${selectedYear}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success('CSV exported successfully');
            } else if ('error' in result) {
                toast.error(result.error || 'Failed to export CSV');
            }
        } catch (error) {
            toast.error('Error exporting CSV');
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getMonthName = (month: number) => {
        return new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear(selectedYear - 1);
            } else {
                setSelectedMonth(selectedMonth - 1);
            }
        } else {
            if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear(selectedYear + 1);
            } else {
                setSelectedMonth(selectedMonth + 1);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px]">
                <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
                <p className="text-slate-400 text-lg">Calculating payroll...</p>
                <p className="text-slate-500 text-sm mt-2">Processing attendance, leave, and deductions</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                            <Banknote className="w-5 h-5 text-white" />
                        </div>
                        Payroll Management
                    </h1>
                    <p className="text-slate-400">
                        Calculate salaries with attendance, leave deductions, and allowances
                    </p>
                </div>
                
                {/* Month Navigator */}
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigateMonth('prev')}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="px-6 py-2 bg-slate-800/80 rounded-xl border border-slate-700">
                        <span className="text-white font-semibold text-lg">
                            {getMonthName(selectedMonth)} {selectedYear}
                        </span>
                    </div>
                    <button 
                        onClick={() => navigateMonth('next')}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-5 border border-slate-700/50"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <Users className="w-8 h-8 text-cyan-400" />
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Employees</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{summary.total_employees}</p>
                        <p className="text-sm text-slate-400 mt-1">Active this month</p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-5 border border-slate-700/50"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <TrendingUp className="w-8 h-8 text-emerald-400" />
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Gross Total</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{formatMoney(summary.total_gross)}</p>
                        <p className="text-sm text-slate-400 mt-1">Before deductions</p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-5 border border-slate-700/50"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <TrendingDown className="w-8 h-8 text-rose-400" />
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Deductions</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{formatMoney(summary.total_deductions)}</p>
                        <p className="text-sm text-slate-400 mt-1">LOP, PF, Tax, etc.</p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-cyan-900/30 to-emerald-900/30 rounded-2xl p-5 border border-cyan-700/30"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <PiggyBank className="w-8 h-8 text-cyan-400" />
                            <span className="text-xs text-cyan-400/70 uppercase tracking-wider">Net Payable</span>
                        </div>
                        <p className="text-3xl font-bold text-cyan-400">{formatMoney(summary.total_net)}</p>
                        <p className="text-sm text-cyan-400/60 mt-1">Final payout amount</p>
                    </motion.div>
                </div>
            )}

            {/* Metadata Bar */}
            {metadata && (
                <div className="flex items-center gap-6 px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-400 text-sm">
                            <span className="text-white font-medium">{metadata.working_days}</span> working days
                        </span>
                    </div>
                    <div className="w-px h-4 bg-slate-700" />
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-400 text-sm">
                            <span className="text-white font-medium">{metadata.holidays}</span> public holidays
                        </span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={handleProcessPayroll}
                    disabled={processing}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Calculate & Save
                </button>
                
                <button
                    onClick={handleApprovePayroll}
                    disabled={processing}
                    className="px-5 py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-semibold rounded-xl hover:bg-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Payroll
                </button>
                
                <button
                    onClick={handleMarkPaid}
                    disabled={processing}
                    className="px-5 py-2.5 bg-purple-600/20 text-purple-400 border border-purple-500/30 font-semibold rounded-xl hover:bg-purple-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                    Mark as Paid
                </button>
                
                <button
                    onClick={handleExportCSV}
                    className="px-5 py-2.5 bg-slate-700/50 text-slate-300 border border-slate-600/50 font-semibold rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2 ml-auto"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Payroll Table */}
            {payrollData.length === 0 ? (
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-12 text-center">
                    <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Employees Found</h2>
                    <p className="text-slate-400 mb-6">
                        No active employees found for payroll processing.
                    </p>
                </div>
            ) : (
                <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-700 bg-slate-800/80">
                                    <th className="p-4 text-slate-400 font-medium text-sm">Employee</th>
                                    <th className="p-4 text-slate-400 font-medium text-sm text-center">Attendance</th>
                                    <th className="p-4 text-slate-400 font-medium text-sm text-center">Leave</th>
                                    <th className="p-4 text-slate-400 font-medium text-sm text-right">Basic</th>
                                    <th className="p-4 text-slate-400 font-medium text-sm text-right">Allowances</th>
                                    <th className="p-4 text-slate-400 font-medium text-sm text-right">Deductions</th>
                                    <th className="p-4 text-slate-400 font-medium text-sm text-right">Net Pay</th>
                                    <th className="p-4 text-slate-400 font-medium text-sm text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {payrollData.map((emp, index) => (
                                    <motion.tr 
                                        key={emp.emp_id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-slate-800/50 transition-colors group"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/20">
                                                    <span className="text-sm font-bold text-cyan-400">
                                                        {emp.full_name?.charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{emp.full_name}</p>
                                                    <p className="text-xs text-slate-500">{emp.department}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-emerald-400 text-sm font-medium">{emp.present_days}P</span>
                                                {emp.absent_days > 0 && (
                                                    <span className="text-rose-400 text-sm">{emp.absent_days}A</span>
                                                )}
                                                {emp.late_days > 0 && (
                                                    <span className="text-amber-400 text-sm">{emp.late_days}L</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="text-sm">
                                                {emp.paid_leave_days > 0 && (
                                                    <span className="text-cyan-400">{emp.paid_leave_days} paid</span>
                                                )}
                                                {emp.unpaid_leave_days > 0 && (
                                                    <span className="text-rose-400 ml-2">{emp.unpaid_leave_days} LOP</span>
                                                )}
                                                {emp.paid_leave_days === 0 && emp.unpaid_leave_days === 0 && (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-slate-300">
                                            {formatMoney(emp.basic_salary)}
                                        </td>
                                        <td className="p-4 text-right font-mono text-emerald-400/80">
                                            +{formatMoney(emp.total_allowances)}
                                        </td>
                                        <td className="p-4 text-right font-mono text-rose-400/80">
                                            -{formatMoney(emp.total_deductions)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold font-mono text-white text-lg">
                                                {formatMoney(emp.net_pay)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => setExpandedRow(expandedRow === emp.emp_id ? null : emp.emp_id)}
                                                className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Expanded Detail Panel */}
            <AnimatePresence>
                {expandedRow && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 overflow-hidden"
                    >
                        {payrollData.filter(e => e.emp_id === expandedRow).map(emp => (
                            <div key={emp.emp_id} className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                        <Receipt className="w-5 h-5 text-cyan-400" />
                                        Salary Breakdown: {emp.full_name}
                                    </h3>
                                    <button
                                        onClick={() => setExpandedRow(null)}
                                        className="text-slate-400 hover:text-white"
                                    >
                                        ✕
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Earnings */}
                                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                        <h4 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" /> Earnings
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Basic Salary</span>
                                                <span className="text-white font-mono">{formatMoney(emp.basic_salary)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">HRA</span>
                                                <span className="text-white font-mono">{formatMoney(emp.hra)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Travel Allowance</span>
                                                <span className="text-white font-mono">{formatMoney(emp.travel_allowance)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Medical Allowance</span>
                                                <span className="text-white font-mono">{formatMoney(emp.medical_allowance)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Special Allowance</span>
                                                <span className="text-white font-mono">{formatMoney(emp.special_allowance)}</span>
                                            </div>
                                            <div className="border-t border-slate-700 pt-2 mt-3 flex justify-between font-semibold">
                                                <span className="text-emerald-400">Total Earnings</span>
                                                <span className="text-emerald-400 font-mono">{formatMoney(emp.gross_salary)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                        <h4 className="text-rose-400 font-semibold mb-4 flex items-center gap-2">
                                            <TrendingDown className="w-4 h-4" /> Deductions
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">LOP Deduction</span>
                                                <span className="text-white font-mono">{formatMoney(emp.lop_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Late Deduction</span>
                                                <span className="text-white font-mono">{formatMoney(emp.late_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Half Day Deduction</span>
                                                <span className="text-white font-mono">{formatMoney(emp.half_day_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">PF (12%)</span>
                                                <span className="text-white font-mono">{formatMoney(emp.pf_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">TDS</span>
                                                <span className="text-white font-mono">{formatMoney(emp.tax_deduction)}</span>
                                            </div>
                                            <div className="border-t border-slate-700 pt-2 mt-3 flex justify-between font-semibold">
                                                <span className="text-rose-400">Total Deductions</span>
                                                <span className="text-rose-400 font-mono">{formatMoney(emp.total_deductions)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attendance Summary */}
                                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                        <h4 className="text-cyan-400 font-semibold mb-4 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> Attendance
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Working Days</span>
                                                <span className="text-white font-mono">{emp.working_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Present Days</span>
                                                <span className="text-emerald-400 font-mono">{emp.present_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Absent Days</span>
                                                <span className="text-rose-400 font-mono">{emp.absent_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Late Days</span>
                                                <span className="text-amber-400 font-mono">{emp.late_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Paid Leave</span>
                                                <span className="text-cyan-400 font-mono">{emp.paid_leave_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Unpaid Leave (LOP)</span>
                                                <span className="text-rose-400 font-mono">{emp.unpaid_leave_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Per Day Salary</span>
                                                <span className="text-white font-mono">{formatMoney(emp.per_day_salary)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Net Pay Banner */}
                                <div className="bg-gradient-to-r from-cyan-900/30 to-emerald-900/30 rounded-xl p-6 border border-cyan-700/30 flex items-center justify-between">
                                    <div>
                                        <p className="text-slate-400 text-sm">Net Payable Amount</p>
                                        <p className="text-3xl font-bold text-cyan-400 mt-1">{formatMoney(emp.net_pay)}</p>
                                    </div>
                                    <button className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl flex items-center gap-2 transition-colors">
                                        <FileText className="w-4 h-4" />
                                        Generate Payslip
                                    </button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
