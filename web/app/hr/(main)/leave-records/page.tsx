"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Calendar, Download, Search, Filter, ChevronLeft, ChevronRight,
    User, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp,
    FileSpreadsheet, RefreshCw, Eye, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { getAllLeaveRecords, exportLeaveRecordsCSV, LeaveRecord, LeaveRecordSummary } from "@/app/actions/leave-records";

export default function LeaveRecordsPage() {
    const [records, setRecords] = useState<LeaveRecord[]>([]);
    const [summary, setSummary] = useState<LeaveRecordSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState<LeaveRecord | null>(null);
    const [filterDepartment, setFilterDepartment] = useState<string>("all");

    // Fetch records
    const fetchRecords = async () => {
        setLoading(true);
        try {
            const result = await getAllLeaveRecords(selectedMonth, selectedYear);
            if (result.success && 'records' in result) {
                setRecords(result.records);
                setSummary(result.summary);
            } else if ('error' in result) {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Failed to load leave records");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [selectedMonth, selectedYear]);

    // Navigate months
    const prevMonth = () => {
        if (selectedMonth === 1) {
            setSelectedMonth(12);
            setSelectedYear(prev => prev - 1);
        } else {
            setSelectedMonth(prev => prev - 1);
        }
    };

    const nextMonth = () => {
        if (selectedMonth === 12) {
            setSelectedMonth(1);
            setSelectedYear(prev => prev + 1);
        } else {
            setSelectedMonth(prev => prev + 1);
        }
    };

    // Export to CSV
    const handleExport = async () => {
        setExporting(true);
        try {
            const result = await exportLeaveRecordsCSV(selectedMonth, selectedYear);
            if (result.success && 'csv' in result) {
                // Create download
                const blob = new Blob([result.csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Export successful!");
            } else if ('error' in result) {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Failed to export");
        } finally {
            setExporting(false);
        }
    };

    // Filter records
    const filteredRecords = records.filter(record => {
        const matchesSearch = record.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            record.emp_id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDepartment = filterDepartment === "all" || record.department === filterDepartment;
        return matchesSearch && matchesDepartment;
    });

    // Get unique departments
    const departments = [...new Set(records.map(r => r.department).filter(Boolean))];

    // Format month name
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Leave Records
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Track paid, unpaid, and half-day leaves for all employees
                        </p>
                    </div>

                    {/* Month Navigator */}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm">
                        <button 
                            onClick={prevMonth}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-semibold min-w-[160px] text-center">{monthName}</span>
                        <button 
                            onClick={nextMonth}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>

                {/* Summary Cards */}
                {summary && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
                    >
                        <SummaryCard
                            icon={<User className="w-5 h-5" />}
                            label="Total Employees"
                            value={summary.total_employees}
                            color="blue"
                        />
                        <SummaryCard
                            icon={<CheckCircle className="w-5 h-5" />}
                            label="Paid Leaves"
                            value={summary.total_paid_leaves}
                            color="green"
                        />
                        <SummaryCard
                            icon={<XCircle className="w-5 h-5" />}
                            label="Unpaid Leaves"
                            value={summary.total_unpaid_leaves}
                            color="red"
                        />
                        <SummaryCard
                            icon={<Clock className="w-5 h-5" />}
                            label="Half Days"
                            value={summary.total_half_days}
                            color="amber"
                        />
                        <SummaryCard
                            icon={<TrendingUp className="w-5 h-5" />}
                            label="Avg Attendance"
                            value={`${summary.avg_attendance_rate.toFixed(1)}%`}
                            color="indigo"
                        />
                        <SummaryCard
                            icon={<AlertTriangle className="w-5 h-5" />}
                            label="Low Attendance"
                            value={summary.employees_with_low_attendance}
                            color="orange"
                        />
                    </motion.div>
                )}

                {/* Filters & Actions */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col md:flex-row gap-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
                >
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Department Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <select
                            value={filterDepartment}
                            onChange={(e) => setFilterDepartment(e.target.value)}
                            className="pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none min-w-[180px]"
                        >
                            <option value="all">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept!}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={fetchRecords}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting || records.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
                        >
                            {exporting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export CSV
                        </button>
                    </div>
                </motion.div>

                {/* Records Table */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
                >
                    {loading ? (
                        <div className="p-12 text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                            <p className="mt-4 text-gray-500">Loading records...</p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-12 text-center">
                            <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400" />
                            <p className="mt-4 text-gray-500">No records found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase tracking-wider">Paid</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-red-600 uppercase tracking-wider">Unpaid</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-amber-600 uppercase tracking-wider">Half Day</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider">Sick</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-purple-600 uppercase tracking-wider">Casual</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Present</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Absent</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Attendance %</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredRecords.map((record, index) => {
                                        const attendanceRate = record.total_working_days > 0 
                                            ? (record.days_present / record.total_working_days) * 100 
                                            : 0;
                                        
                                        return (
                                            <motion.tr 
                                                key={record.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.02 }}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                            >
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                                                            {record.employee_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">
                                                                {record.employee_name}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{record.emp_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                        {record.department || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`font-semibold ${record.paid_leave_taken > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                        {record.paid_leave_taken}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`font-semibold ${record.unpaid_leave_taken > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {record.unpaid_leave_taken}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`font-semibold ${record.half_day_leave_taken > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                        {record.half_day_leave_taken}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`font-semibold ${record.sick_leave_taken > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {record.sick_leave_taken}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`font-semibold ${record.casual_leave_taken > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                                        {record.casual_leave_taken}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center font-medium">
                                                    {record.days_present}
                                                </td>
                                                <td className="px-4 py-4 text-center font-medium">
                                                    {record.days_absent}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all ${
                                                                    attendanceRate >= 90 ? 'bg-green-500' :
                                                                    attendanceRate >= 80 ? 'bg-amber-500' :
                                                                    'bg-red-500'
                                                                }`}
                                                                style={{ width: `${Math.min(attendanceRate, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-sm font-semibold ${
                                                            attendanceRate >= 90 ? 'text-green-600' :
                                                            attendanceRate >= 80 ? 'text-amber-600' :
                                                            'text-red-600'
                                                        }`}>
                                                            {attendanceRate.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="font-semibold text-indigo-600">
                                                        {record.total_leave_balance - record.leave_used_this_year}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => setSelectedEmployee(record)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>

                {/* Employee Detail Modal */}
                <AnimatePresence>
                    {selectedEmployee && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                            onClick={() => setSelectedEmployee(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                                            {selectedEmployee.employee_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold">{selectedEmployee.employee_name}</h2>
                                            <p className="text-gray-500">{selectedEmployee.emp_id} • {selectedEmployee.department || 'No Department'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Leave Summary */}
                                    <div>
                                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                                            <Calendar className="w-5 h-5 text-indigo-500" />
                                            Leave Summary ({monthName})
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                                                <p className="text-2xl font-bold text-green-600">{selectedEmployee.paid_leave_taken}</p>
                                                <p className="text-xs text-green-600/80">Paid Leave</p>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                                                <p className="text-2xl font-bold text-red-600">{selectedEmployee.unpaid_leave_taken}</p>
                                                <p className="text-xs text-red-600/80">Unpaid Leave</p>
                                            </div>
                                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                                                <p className="text-2xl font-bold text-amber-600">{selectedEmployee.half_day_leave_taken}</p>
                                                <p className="text-xs text-amber-600/80">Half Days</p>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                                                <p className="text-2xl font-bold text-blue-600">{selectedEmployee.sick_leave_taken}</p>
                                                <p className="text-xs text-blue-600/80">Sick Leave</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attendance */}
                                    <div>
                                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                                            Attendance
                                        </h3>
                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-gray-600 dark:text-gray-400">Working Days</span>
                                                <span className="font-semibold">{selectedEmployee.total_working_days}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-gray-600 dark:text-gray-400">Present</span>
                                                <span className="font-semibold text-green-600">{selectedEmployee.days_present}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-gray-600 dark:text-gray-400">Absent</span>
                                                <span className="font-semibold text-red-600">{selectedEmployee.days_absent}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-gray-600 dark:text-gray-400">Late Arrivals</span>
                                                <span className="font-semibold text-amber-600">{selectedEmployee.late_arrivals}</span>
                                            </div>
                                            <div className="border-t pt-4 flex justify-between items-center">
                                                <span className="font-semibold">Attendance Rate</span>
                                                <span className={`text-xl font-bold ${
                                                    (selectedEmployee.days_present / selectedEmployee.total_working_days * 100) >= 90 
                                                        ? 'text-green-600' 
                                                        : (selectedEmployee.days_present / selectedEmployee.total_working_days * 100) >= 80
                                                        ? 'text-amber-600'
                                                        : 'text-red-600'
                                                }`}>
                                                    {selectedEmployee.total_working_days > 0 
                                                        ? ((selectedEmployee.days_present / selectedEmployee.total_working_days) * 100).toFixed(1)
                                                        : 0
                                                    }%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Balance */}
                                    <div>
                                        <h3 className="font-semibold mb-4">Leave Balance (Yearly)</h3>
                                        <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                                            <div>
                                                <p className="text-sm text-indigo-600/80">Total Entitlement</p>
                                                <p className="text-xl font-bold text-indigo-600">{selectedEmployee.total_leave_balance} days</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-indigo-600/80">Remaining</p>
                                                <p className="text-xl font-bold text-indigo-600">
                                                    {selectedEmployee.total_leave_balance - selectedEmployee.leave_used_this_year} days
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => setSelectedEmployee(null)}
                                        className="w-full py-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// Summary Card Component
function SummaryCard({ 
    icon, 
    label, 
    value, 
    color 
}: { 
    icon: React.ReactNode; 
    label: string; 
    value: string | number; 
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-600',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
        orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600',
    };

    return (
        <div className={`rounded-xl p-4 ${colorClasses[color]}`}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-medium opacity-80">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}
