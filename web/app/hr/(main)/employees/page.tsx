'use client';

import { useState, useEffect } from 'react';
import { getCompanyEmployees } from "@/app/actions/hr";

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await getCompanyEmployees();
                if (res.success && res.employees) {
                    setEmployees(res.employees);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

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
                                    <span className="text-slate-300">{new Date(emp.join_date).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <button className="w-full mt-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">
                                View Profile
                            </button>
                        </div>
                    ))}

                    {/* Add New Employee Card */}
                    <div className="glass-panel border-dashed border-slate-700 flex flex-col items-center justify-center p-8 group cursor-pointer hover:border-cyan-500/50 hover:bg-slate-800/30 transition-all">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-cyan-900/30 transition-colors">
                            <span className="text-3xl text-cyan-400">+</span>
                        </div>
                        <h3 className="text-white font-bold mb-1">Add Employee</h3>
                        <p className="text-slate-500 text-sm">Invite new team member</p>
                    </div>
                </div>
            )}
        </div>
    );
}
