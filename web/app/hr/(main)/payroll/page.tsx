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
import { updateEmployeeCompensation } from '@/app/actions/employee';

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

    // Edit compensation modal state
    const [editEmpId, setEditEmpId] = useState<string | null>(null);
    const [compForm, setCompForm] = useState<{ base_salary?: number; pf_rate?: number; insurance_amount?: number; professional_tax?: number; other_allowances?: number; other_deductions?: number; gst_applicable?: boolean }>({});
    const [savingComp, setSavingComp] = useState(false);

    // Payslip generation
    const [generatingPayslip, setGeneratingPayslip] = useState<string | null>(null);

    const handleGeneratePayslip = async (emp: PayrollRecord) => {
        setGeneratingPayslip(emp.emp_id);
        try {
            // Generate payslip HTML content
            const payslipHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Payslip - ${emp.full_name}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .section { margin: 20px 0; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .total { font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
        h1 { color: #333; } h2 { color: #666; font-size: 16px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>SALARY SLIP</h1>
        <p>${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
    </div>
    <div class="section">
        <h2>Employee Details</h2>
        <div class="row"><span>Name:</span><span>${emp.full_name}</span></div>
        <div class="row"><span>Employee ID:</span><span>${emp.emp_id}</span></div>
        <div class="row"><span>Department:</span><span>${emp.department}</span></div>
        <div class="row"><span>Position:</span><span>${emp.position}</span></div>
    </div>
    <div class="section">
        <h2>Earnings</h2>
        <div class="row"><span>Basic Salary</span><span>₹${emp.basic_salary.toLocaleString()}</span></div>
        <div class="row"><span>HRA</span><span>₹${emp.hra.toLocaleString()}</span></div>
        <div class="row"><span>Travel Allowance</span><span>₹${emp.travel_allowance.toLocaleString()}</span></div>
        <div class="row"><span>Medical Allowance</span><span>₹${emp.medical_allowance.toLocaleString()}</span></div>
        <div class="row"><span>Special Allowance</span><span>₹${emp.special_allowance.toLocaleString()}</span></div>
        <div class="row total"><span>Gross Earnings</span><span>₹${emp.gross_salary.toLocaleString()}</span></div>
    </div>
    <div class="section">
        <h2>Deductions</h2>
        <div class="row"><span>PF Contribution</span><span>₹${emp.pf_deduction.toLocaleString()}</span></div>
        <div class="row"><span>TDS</span><span>₹${emp.tax_deduction.toLocaleString()}</span></div>
        <div class="row"><span>LOP Deduction</span><span>₹${emp.lop_deduction.toLocaleString()}</span></div>
        <div class="row"><span>Other Deductions</span><span>₹${emp.other_deductions.toLocaleString()}</span></div>
        <div class="row total"><span>Total Deductions</span><span>₹${emp.total_deductions.toLocaleString()}</span></div>
    </div>
    <div class="section">
        <div class="row total" style="font-size: 18px;"><span>NET PAY</span><span>₹${emp.net_pay.toLocaleString()}</span></div>
    </div>
    <div class="section" style="margin-top: 40px; font-size: 12px; color: #666;">
        <p>This is a computer-generated payslip and does not require a signature.</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

            // Open in new window for printing
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(payslipHtml);
                printWindow.document.close();
                printWindow.print();
                toast.success('Payslip generated - print dialog opened');
            } else {
                // Fallback: download as HTML
                const blob = new Blob([payslipHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `payslip_${emp.emp_id}_${selectedMonth}_${selectedYear}.html`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Payslip downloaded');
            }
        } catch (error) {
            toast.error('Failed to generate payslip');
        } finally {
            setGeneratingPayslip(null);
        }
    };

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
                                            <button
                                                onClick={() => {
                                                    setEditEmpId(emp.emp_id);
                                                    setCompForm({});
                                                }}
                                                className="ml-2 p-2 rounded-lg bg-cyan-600/70 hover:bg-cyan-600 text-white transition-colors"
                                            >
                                                Edit Salary
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
                                                <span className="text-slate-400">PF ({emp.basic_salary > 0 ? Math.round((emp.pf_deduction / emp.basic_salary) * 100) : 12}%)</span>
                                                <span className="text-white font-mono">{formatMoney(emp.pf_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">TDS</span>
                                                <span className="text-white font-mono">{formatMoney(emp.tax_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Insurance/Prof/Other</span>
                                                <span className="text-white font-mono">{formatMoney(emp.other_deductions)}</span>
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
                                    <button 
                                        onClick={() => handleGeneratePayslip(emp)}
                                        disabled={generatingPayslip === emp.emp_id}
                                        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {generatingPayslip === emp.emp_id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <FileText className="w-4 h-4" />
                                        )}
                                        Generate Payslip
                                    </button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Compensation Modal */}
            <AnimatePresence>
                {editEmpId && (
                    <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl p-6"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-bold">Edit Compensation</h3>
                                <button className="text-slate-400 hover:text-white" onClick={() => setEditEmpId(null)}>✕</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormInput label="Base Salary" type="number" value={compForm.base_salary ?? ''} onChange={v => setCompForm(f => ({ ...f, base_salary: v }))} />
                                <FormInput label="PF Rate (%)" type="number" step="0.01" value={compForm.pf_rate ?? ''} onChange={v => setCompForm(f => ({ ...f, pf_rate: v }))} />
                                <FormInput label="Insurance Amount" type="number" value={compForm.insurance_amount ?? ''} onChange={v => setCompForm(f => ({ ...f, insurance_amount: v }))} />
                                <FormInput label="Professional Tax" type="number" value={compForm.professional_tax ?? ''} onChange={v => setCompForm(f => ({ ...f, professional_tax: v }))} />
                                <FormInput label="Other Allowances" type="number" value={compForm.other_allowances ?? ''} onChange={v => setCompForm(f => ({ ...f, other_allowances: v }))} />
                                <FormInput label="Other Deductions" type="number" value={compForm.other_deductions ?? ''} onChange={v => setCompForm(f => ({ ...f, other_deductions: v }))} />
                                <div className="col-span-1 md:col-span-2 flex items-center gap-2 mt-2">
                                    <input type="checkbox" id="gst" checked={compForm.gst_applicable || false} onChange={e => setCompForm(f => ({ ...f, gst_applicable: e.target.checked }))} />
                                    <label htmlFor="gst" className="text-slate-300">GST Applicable (for invoicing)</label>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300" onClick={() => setEditEmpId(null)}>Cancel</button>
                                <button
                                    onClick={async () => {
                                        setSavingComp(true);
                                        const payload: any = { emp_id: editEmpId };
                                        if (compForm.base_salary != null) payload.base_salary = Number(compForm.base_salary);
                                        if (compForm.pf_rate != null) payload.pf_rate = Number(compForm.pf_rate);
                                        if (compForm.insurance_amount != null) payload.insurance_amount = Number(compForm.insurance_amount);
                                        if (compForm.professional_tax != null) payload.professional_tax = Number(compForm.professional_tax);
                                        if (compForm.other_allowances != null) payload.other_allowances = Number(compForm.other_allowances);
                                        if (compForm.other_deductions != null) payload.other_deductions = Number(compForm.other_deductions);
                                        if (typeof compForm.gst_applicable === 'boolean') payload.gst_applicable = compForm.gst_applicable;

                                        const res = await updateEmployeeCompensation(payload);
                                        setSavingComp(false);
                                        if (res.success) {
                                            toast.success('Compensation updated');
                                            setEditEmpId(null);
                                            await loadPayroll();
                                        } else {
                                            toast.error(res.error || 'Update failed');
                                        }
                                    }}
                                    className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 flex items-center gap-2"
                                    disabled={savingComp}
                                >
                                    {savingComp && <Loader2 className="w-4 h-4 animate-spin" />} Save
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function FormInput({ label, type = 'text', step, value, onChange }: { label: string; type?: string; step?: string; value: any; onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-sm text-slate-400 mb-1">{label}</label>
            <input
                type={type}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
            />
        </div>
    );
}
