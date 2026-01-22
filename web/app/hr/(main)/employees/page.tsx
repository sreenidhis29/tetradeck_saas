'use client';

import { useState, useEffect } from 'react';
import { getCompanyEmployees, getCompanyDetails } from "@/app/actions/hr";
import { X, Mail, MapPin, Briefcase, Calendar, Phone, User, Copy, Check } from "lucide-react";
import { toast } from 'sonner';

interface Employee {
    emp_id: string;
    full_name: string;
    email: string;
    department: string;
    position: string;
    location: string;
    join_date: string;
    status: string;
    phone?: string;
}

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [companyCode, setCompanyCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const [empRes, compRes] = await Promise.all([
                    getCompanyEmployees(),
                    getCompanyDetails()
                ]);
                if (empRes.success && empRes.employees) {
                    setEmployees(empRes.employees as Employee[]);
                }
                if (compRes.success && compRes.company) {
                    setCompanyCode(compRes.company.code);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleViewProfile = (employee: Employee) => {
        setSelectedEmployee(employee);
    };

    const closeModal = () => {
        setSelectedEmployee(null);
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(companyCode);
        setCopied(true);
        toast.success('Company code copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Team Directory</h1>
                    <p className="text-slate-400">Manage your organization's workforce</p>
                </div>
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                    <span className="text-slate-400 text-sm">Total Employees: </span>
                    <span className="text-cyan-400 font-bold ml-2">{employees.length}</span>
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                </div>
            ) : employees.length === 0 ? (
                <div className="glass-panel p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">No Approved Employees Yet</h3>
                    <p className="text-slate-400 text-sm">Approve pending registrations to see employees here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {employees.map((emp) => (
                        <div key={emp.emp_id} className="glass-panel p-6 hover:translate-y-[-2px] transition-transform duration-300">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-lg font-bold text-cyan-400 border border-slate-600">
                                        {emp.full_name?.charAt(0) || 'E'}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{emp.full_name}</h3>
                                        <p className="text-cyan-400 text-sm">{emp.position}</p>
                                    </div>
                                </div>
                                <span className={`w-2 h-2 rounded-full ${emp.status === 'Active' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-500'}`}></span>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-700/50">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Department</span>
                                    <span className="text-slate-300">{emp.department}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Email</span>
                                    <span className="text-slate-300 truncate max-w-[150px]">{emp.email}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Joined</span>
                                    <span className="text-slate-300">{emp.join_date ? new Date(emp.join_date).toLocaleDateString() : 'Not set'}</span>
                                </div>
                            </div>

                            <button 
                                onClick={() => handleViewProfile(emp)}
                                className="w-full mt-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                            >
                                View Profile
                            </button>
                        </div>
                    ))}

                    {/* Add New Employee Card */}
                    <div 
                        onClick={() => setShowInviteModal(true)}
                        className="glass-panel border-dashed border-slate-700 flex flex-col items-center justify-center p-8 group cursor-pointer hover:border-cyan-500/50 hover:bg-slate-800/30 transition-all"
                    >
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-cyan-900/30 transition-colors">
                            <span className="text-3xl text-cyan-400">+</span>
                        </div>
                        <h3 className="text-white font-bold mb-1">Add Employee</h3>
                        <p className="text-slate-500 text-sm">Invite new team member</p>
                    </div>
                </div>
            )}

            {/* Employee Profile Modal */}
            {selectedEmployee && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-panel max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-700/50 flex items-start justify-between">
                            <div className="flex gap-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                                    {selectedEmployee.full_name?.charAt(0) || 'E'}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedEmployee.full_name}</h2>
                                    <p className="text-cyan-400">{selectedEmployee.position}</p>
                                    <span className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-xs ${
                                        selectedEmployee.status === 'Active' 
                                            ? 'bg-emerald-500/20 text-emerald-400' 
                                            : 'bg-slate-500/20 text-slate-400'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            selectedEmployee.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-400'
                                        }`}></span>
                                        {selectedEmployee.status}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={closeModal}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* Contact Info */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact Information</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <Mail className="w-4 h-4 text-slate-500" />
                                        <a href={`mailto:${selectedEmployee.email}`} className="hover:text-cyan-400 transition-colors">
                                            {selectedEmployee.email}
                                        </a>
                                    </div>
                                    {selectedEmployee.phone && (
                                        <div className="flex items-center gap-3 text-slate-300">
                                            <Phone className="w-4 h-4 text-slate-500" />
                                            <span>{selectedEmployee.phone}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <MapPin className="w-4 h-4 text-slate-500" />
                                        <span>{selectedEmployee.location}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Work Info */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Work Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="glass-panel p-4">
                                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                            <Briefcase className="w-4 h-4" />
                                            Department
                                        </div>
                                        <div className="text-white font-medium">{selectedEmployee.department}</div>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                            <Calendar className="w-4 h-4" />
                                            Join Date
                                        </div>
                                        <div className="text-white font-medium">
                                            {selectedEmployee.join_date ? new Date(selectedEmployee.join_date).toLocaleDateString() : 'Not set'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Employee ID */}
                            <div className="glass-panel p-4">
                                <div className="text-slate-500 text-sm mb-1">Employee ID</div>
                                <div className="text-cyan-400 font-mono">{selectedEmployee.emp_id}</div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-700/50 flex gap-3">
                            <button 
                                onClick={closeModal}
                                className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                            <a 
                                href={`mailto:${selectedEmployee.email}`}
                                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors text-center"
                            >
                                Send Email
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Employee Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-panel max-w-md w-full">
                        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Invite New Employee</h2>
                            <button 
                                onClick={() => setShowInviteModal(false)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <p className="text-slate-400 mb-6">
                                Share your company code with new employees. They will use this code during sign-up to join your organization.
                            </p>
                            
                            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 mb-6">
                                <label className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2 block">
                                    Company Access Code
                                </label>
                                <div className="flex items-center justify-between gap-4">
                                    <code className="text-3xl font-mono text-cyan-400 tracking-widest font-bold">
                                        {companyCode}
                                    </code>
                                    <button
                                        onClick={handleCopyCode}
                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                    >
                                        {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                                <h4 className="text-amber-400 font-medium mb-1">How it works</h4>
                                <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
                                    <li>Employee signs up at your portal</li>
                                    <li>They enter this company code</li>
                                    <li>You receive a registration request</li>
                                    <li>Approve or reject from Employee Registrations</li>
                                </ol>
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-slate-700/50">
                            <button 
                                onClick={() => setShowInviteModal(false)}
                                className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
