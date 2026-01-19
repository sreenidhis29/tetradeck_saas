'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, DollarSign, Users } from 'lucide-react';
import { getCompanyEmployees } from "@/app/actions/hr";

interface PayrollRecord {
    emp_id: string;
    full_name: string;
    position: string;
    basic_salary: number;
    allowances: number;
    deductions: number;
    net_pay: number;
    status: 'draft' | 'processed' | 'paid';
}

export default function PayrollPage() {
    const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                setError(null);
                
                // Fetch payroll data from API
                const response = await fetch('/api/payroll');
                
                if (!response.ok) {
                    throw new Error('Failed to load payroll data');
                }
                
                const result = await response.json();
                
                if (result.success && result.payroll) {
                    setPayrollData(result.payroll);
                } else {
                    // No payroll records yet
                    setPayrollData([]);
                }
            } catch (e) {
                console.error('Error loading payroll:', e);
                setError('Unable to load payroll data. Please try again later.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Helper to format currency
    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const handleRunPayroll = async () => {
        setProcessing(true);
        try {
            const response = await fetch('/api/payroll/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month: new Date().toLocaleString('default', { month: 'long' }) })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert("✅ Payroll processed successfully for " + new Date().toLocaleString('default', { month: 'long' }));
                // Reload data
                window.location.reload();
            } else {
                alert("❌ Failed to process payroll: " + (result.error || 'Unknown error'));
            }
        } catch (e) {
            alert("❌ Payroll processing failed. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                <p className="text-slate-400">Loading payroll data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Payroll Management</h1>
                        <p className="text-slate-400">Process salaries and view payment history</p>
                    </div>
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

    if (payrollData.length === 0) {
        return (
            <div>
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Payroll Management</h1>
                        <p className="text-slate-400">Process salaries and view payment history</p>
                    </div>
                </header>
                <div className="glass-panel p-12 text-center">
                    <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Payroll Records</h2>
                    <p className="text-slate-400 mb-6">
                        Payroll data has not been configured yet. Please set up employee salary information first.
                    </p>
                    <p className="text-slate-500 text-sm">
                        Contact your system administrator to configure payroll settings.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Payroll Management</h1>
                    <p className="text-slate-400">Process salaries and view payment history</p>
                </div>
                <button
                    onClick={handleRunPayroll}
                    disabled={processing}
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {processing ? (
                        <>
                            <span className="animate-spin">⚙️</span> Processing...
                        </>
                    ) : (
                        <>
                            <span>⚡</span> Run {new Date().toLocaleString('default', { month: 'long' })} Payroll
                        </>
                    )}
                </button>
            </header>

            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/50">
                            <th className="p-4 text-slate-400 font-medium text-sm">Employee</th>
                            <th className="p-4 text-slate-400 font-medium text-sm">Role</th>
                            <th className="p-4 text-slate-400 font-medium text-sm text-right">Basic Salary</th>
                            <th className="p-4 text-slate-400 font-medium text-sm text-right">Allowances</th>
                            <th className="p-4 text-slate-400 font-medium text-sm text-right">Deductions</th>
                            <th className="p-4 text-slate-400 font-medium text-sm text-right">Net Pay</th>
                            <th className="p-4 text-slate-400 font-medium text-sm text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {payrollData.map((emp) => (
                            <tr key={emp.emp_id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="p-4 py-5">
                                    <div className="flex gap-3 items-center">
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400">
                                            {emp.full_name?.charAt(0)}
                                        </div>
                                        <span className="font-medium text-white">{emp.full_name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-400 text-sm">{emp.position}</td>
                                <td className="p-4 text-slate-300 font-mono text-right">{formatMoney(emp.basic_salary)}</td>
                                <td className="p-4 text-emerald-400/80 font-mono text-right">+{formatMoney(emp.allowances)}</td>
                                <td className="p-4 text-rose-400/80 font-mono text-right">-{formatMoney(emp.deductions)}</td>
                                <td className="p-4 text-white font-bold font-mono text-right">{formatMoney(emp.net_pay)}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                                        emp.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                        emp.status === 'processed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                    }`}>
                                        {emp.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
