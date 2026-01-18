"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Building2, UserPlus, CheckCircle, ArrowRight, User } from "lucide-react";
import { acceptTerms, registerCompany, joinCompany, updateEmployeeDetails } from "@/app/actions/onboarding";
import { useRouter } from "next/navigation";

export function OnboardingFlow({ user, intent }: { user: any; intent: string }) {
    // State initialization based on user status
    // Normalize intent to lowercase to avoid case-sensitivity issues
    const safeIntent = (intent || "").toLowerCase();

    const [step, setStep] = useState<"legal" | "choice" | "details" | "create" | "constraints" | "join">(() => {
        if (user?.terms_accepted_at) {
            // If already accepted terms, check where they should go
            // If employee, they might need to update details first if not done? 
            // For simplicity, we assume if they hit onboarding again, they might need to join/create.
            // But adhering to flow: Legal -> Details -> Join
            return safeIntent === 'hr' ? 'create' : safeIntent === 'employee' ? 'details' : 'choice';
        }
        return "legal";
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    // Form States
    const [companyName, setCompanyName] = useState("");
    const [industry, setIndustry] = useState("");
    const [size, setSize] = useState("");
    const [location, setLocation] = useState("");
    const [website, setWebsite] = useState("");

    // Employee Details
    const [dept, setDept] = useState("");
    const [position, setPosition] = useState("");
    const [empLocation, setEmpLocation] = useState("");

    const [companyCode, setCompanyCode] = useState("");

    const handleLegalAccept = async () => {
        setLoading(true);
        const res = await acceptTerms();
        if (res.success) {
            if (safeIntent === 'hr') setStep("create");
            else if (safeIntent === 'employee') setStep("details"); // Go to details first
            else setStep("choice");
        } else {
            setError(res.error || "Failed");
        }
        setLoading(false);
    };

    const handleUpdateDetails = async () => {
        if (!dept || !position || !empLocation) {
            setError("Please fill in all fields.");
            return;
        }
        setLoading(true);
        const res = await updateEmployeeDetails({ department: dept, position: position, location: empLocation });
        if (res.success) {
            setStep("join"); // Now go to join step
            setError("");
        } else {
            setError(res.error || "Failed");
        }
        setLoading(false);
    };

    const handleCreateCompany = async () => {
        setLoading(true);
        const res = await registerCompany(companyName, industry, size, location, website);
        if (res.success) {
            router.push("/hr/dashboard");
        } else {
            setError(res.error || "Failed");
        }
        setLoading(false);
    };

    const handleJoinCompany = async () => {
        setLoading(true);
        const res = await joinCompany(companyCode);
        if (res.success) {
            router.push("/employee/dashboard");
        } else {
            setError(res.error || "Failed");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0f] text-white p-4 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a0b2e] via-[#0a0a0f] to-black z-0 pointer-events-none" />
            <div className="absolute w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] -top-20 -left-20 animate-pulse" />
            <div className="absolute w-[500px] h-[500px] bg-[#00f2ff]/10 rounded-full blur-[100px] bottom-0 right-0 animate-pulse delay-1000" />

            <AnimatePresence mode="wait">
                {step === "legal" && (
                    <motion.div
                        key="legal"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="z-10 w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent" />

                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-purple-500/20 rounded-lg">
                                <ShieldCheck className="w-8 h-8 text-purple-400" />
                            </div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                Compliance & Security Gate
                            </h1>
                        </div>

                        <div className="space-y-4 text-slate-300 mb-8 h-64 overflow-y-auto pr-2 custom-scrollbar">
                            <p>Welcome to TetraDeck. Before proceeding, you must agree to our enterprise protocols.</p>
                            <ul className="list-disc pl-5 space-y-2 text-sm">
                                <li><strong>Data Privacy:</strong> All employee data is encrypted at rest and in transit.</li>
                                <li><strong>Tetra-Tenancy:</strong> Your organization's data is strictly isolated.</li>
                                <li><strong>Audit Trails:</strong> All sensitive actions (hiring, leaves, payroll) are immutably logged.</li>
                                <li><strong>AI Reasoning:</strong> Leaves are processed by an AI agent; final decisions remain with HR.</li>
                                <li><strong>Compliance:</strong> Use of this system implies adherence to local labor laws.</li>
                            </ul>
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm">
                                By clicking "Accept", you digitally sign this agreement. Timestamp: {new Date().toISOString()}
                            </div>
                        </div>

                        <div className="flex justify-end gap-4">
                            <button
                                onClick={handleLegalAccept}
                                disabled={loading}
                                className="px-6 py-3 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center gap-2"
                            >
                                {loading ? "Signing..." : "Accept & Proceed"} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === "choice" && (
                    <motion.div
                        key="choice"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl"
                    >
                        {/* HR Route */}
                        {(safeIntent === 'hr' || !safeIntent || safeIntent === 'choice') && (
                            <div
                                onClick={() => setStep("create")}
                                className={`group cursor-pointer bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 rounded-2xl p-8 transition-all duration-300 relative overflow-hidden ${safeIntent === 'hr' ? 'col-span-2 max-w-md mx-auto' : ''}`}
                            >
                                <div className="absolute top-0 right-0 p-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-all" />
                                <Building2 className="w-12 h-12 text-purple-400 mb-6" />
                                <h3 className="text-xl font-bold text-white mb-2">Register Company</h3>
                                <p className="text-slate-400 text-sm">For HR Managers & Admins. Create a new secure workspace.</p>
                            </div>
                        )}

                        {/* Employee Route */}
                        {(safeIntent === 'employee' || !safeIntent || safeIntent === 'choice') && (
                            <div
                                onClick={() => setStep("details")}
                                className={`group cursor-pointer bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-[#00f2ff]/50 rounded-2xl p-8 transition-all duration-300 relative overflow-hidden ${safeIntent === 'employee' ? 'col-span-2 max-w-md mx-auto' : ''}`}
                            >
                                <div className="absolute top-0 right-0 p-32 bg-[#00f2ff]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[#00f2ff]/10 transition-all" />
                                <UserPlus className="w-12 h-12 text-[#00f2ff] mb-6" />
                                <h3 className="text-xl font-bold text-white mb-2">Join Team</h3>
                                <p className="text-slate-400 text-sm">For Employees. Setup your profile and join your team.</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* --- NEW STEP: PERSONAL DETAILS --- */}
                {step === "details" && (
                    <motion.div
                        key="details"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-[#00f2ff]/20 rounded-lg">
                                <User className="w-6 h-6 text-[#00f2ff]" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Employee Profile</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Department</label>
                                <select
                                    value={dept}
                                    onChange={(e) => setDept(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#00f2ff] focus:outline-none focus:ring-1 focus:ring-[#00f2ff]"
                                >
                                    <option value="">Select Department</option>
                                    <option value="Engineering">Engineering</option>
                                    <option value="Product">Product</option>
                                    <option value="Design">Design</option>
                                    <option value="Marketing">Marketing</option>
                                    <option value="Sales">Sales</option>
                                    <option value="HR">HR</option>
                                    <option value="Finance">Finance</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Job Title / Position</label>
                                <input
                                    type="text"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#00f2ff] focus:outline-none focus:ring-1 focus:ring-[#00f2ff]"
                                    placeholder="e.g. Senior Developer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Work Location</label>
                                <input
                                    type="text"
                                    value={empLocation}
                                    onChange={(e) => setEmpLocation(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#00f2ff] focus:outline-none focus:ring-1 focus:ring-[#00f2ff]"
                                    placeholder="e.g. New York Office"
                                />
                            </div>

                            {error && <p className="text-red-400 text-sm">{error}</p>}

                            <button
                                onClick={handleUpdateDetails}
                                disabled={loading}
                                className="w-full py-3 rounded-lg bg-[#00f2ff] text-black font-bold hover:bg-[#00c8d2] transition-all mt-4"
                            >
                                {loading ? "Saving..." : "Save & Continue"}
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === "create" && (
                    <motion.div
                        key="create"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
                    >
                        <h2 className="text-2xl font-bold text-white mb-6">Setup Organization</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Company Name</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    placeholder="Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Industry</label>
                                <select
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                    <option value="">Select Industry</option>
                                    <option value="tech">Technology</option>
                                    <option value="finance">Finance</option>
                                    <option value="healthcare">Healthcare</option>
                                    <option value="retail">Retail</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Company Website</label>
                                <input
                                    type="text"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    placeholder="https://acme.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Company Size</label>
                                    <select
                                        value={size}
                                        onChange={(e) => setSize(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    >
                                        <option value="">Select Size</option>
                                        <option value="1-10">1-10 Employees</option>
                                        <option value="11-50">11-50 Employees</option>
                                        <option value="51-200">51-200 Employees</option>
                                        <option value="200+">200+ Employees</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Location</label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        placeholder="New York, USA"
                                    />
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-sm">{error}</p>}

                            <button
                                onClick={() => setStep("constraints")} // Go to constraints check first
                                className="w-full py-3 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all mt-4"
                            >
                                Continue to Configuration
                            </button>

                            <button onClick={() => setStep("choice")} className="w-full text-center text-slate-500 text-sm mt-4 hover:text-white">Back</button>
                        </div>
                    </motion.div>
                )}

                {step === "constraints" && (
                    <motion.div
                        key="constraints"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="z-10 w-full max-w-4xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden flex flex-col h-[80vh]"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white">System Configuration</h2>
                                <p className="text-slate-400 text-sm">These are the default operational constraints. You can customize them after setup.</p>
                            </div>
                            <div className="px-3 py-1 bg-[#00f2ff]/10 text-[#00f2ff] text-xs font-mono rounded border border-[#00f2ff]/20">
                                DEFAULT POLICIES
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            {/* Default Policy Constraints - Can be customized after setup */}
                            {[
                                { name: "Max Consecutive Leaves", val: "10 Days", desc: "Hard cap on single request duration." },
                                { name: "Notice Period", val: "14 Days", desc: "Minimum lead time for non-emergency leaves." },
                                { name: "Probation Block", val: "90 Days", desc: "No paid leaves during probation period." },
                                { name: "SLA Escalation", val: "48 Hours", desc: "Auto-escalate pending requests to Admin." },
                                { name: "Min Team Staffing", val: "30%", desc: "Prevent depletion of department resources." },
                                { name: "Carry Forward Cap", val: "12 Days", desc: "Max unused leaves transfer to next year." },
                                { name: "Sick Leave Proof", val: ">3 Days", desc: "Medical certificate required for extended sick leave." },
                                { name: "Maternity Leave", val: "26 Weeks", desc: "Standard paid maternity entitlement." },
                                { name: "Paternity Leave", val: "2 Weeks", desc: "Standard paid paternity entitlement." },
                                { name: "Approval Chain", val: "Manager -> HR", desc: "Two-step verification for >5 day requests." },
                                { name: "Leave Types", val: "5 Types", desc: "Sick, Casual, Earned, Unpaid, Remote." },
                                { name: "Blackout Dates", val: "Q4 Peak", desc: "Restricted leave during critical business periods." },
                                { name: "Sandwich Rule", val: "Active", desc: "Weekends between leaves count as leave." },
                                { name: "Emergency Bypass", val: "Enabled", desc: "Allow bypass of notice period for emergencies." },

                            ].map((c, i) => (
                                <div key={i} className="p-4 bg-black/40 border border-white/5 rounded-xl hover:border-purple-500/50 transition-colors">
                                    <h4 className="text-[#00f2ff] font-mono text-xs mb-2 uppercase">{c.name}</h4>
                                    <div className="text-xl font-bold text-white mb-1">{c.val}</div>
                                    <p className="text-slate-500 text-xs">{c.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-white/10 flex justify-end gap-4">
                            <button onClick={() => setStep("create")} className="text-slate-400 hover:text-white text-sm">Back</button>
                            <button
                                onClick={handleCreateCompany}
                                disabled={loading}
                                className="px-8 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center gap-2"
                            >
                                {loading ? "Initializing..." : "Confirm & Launch Workspace"} <CheckCircle className="w-4 h-4" />
                            </button>
                        </div>

                    </motion.div>
                )}

                {step === "join" && (
                    <motion.div
                        key="join"
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
                    >
                        <h2 className="text-2xl font-bold text-white mb-6">Enter Workspace</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Company Code</label>
                                <input
                                    type="text"
                                    value={companyCode}
                                    onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white tracking-widest text-center font-mono text-xl focus:border-[#00f2ff] focus:outline-none focus:ring-1 focus:ring-[#00f2ff] placeholder:text-slate-700"
                                    placeholder="ABC-123"
                                    maxLength={8}
                                />
                            </div>

                            {error && <p className="text-red-400 text-sm">{error}</p>}

                            <button
                                onClick={handleJoinCompany}
                                disabled={loading}
                                className="w-full py-3 rounded-lg bg-[#00f2ff] text-black font-bold hover:bg-[#00c8d2] transition-all mt-4 shadow-lg shadow-[#00f2ff]/20"
                            >
                                {loading ? "Verifying..." : "Join Team"}
                            </button>

                            <button onClick={() => setStep("choice")} className="w-full text-center text-slate-500 text-sm mt-4 hover:text-white">Back</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
