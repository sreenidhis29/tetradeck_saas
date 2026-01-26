"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Building2, UserPlus, CheckCircle, ArrowRight, User, AlertCircle, Clock, Save, Settings2 } from "lucide-react";
import { acceptTerms, registerCompany, joinCompany, updateEmployeeDetails, saveOnboardingProgress } from "@/app/actions/onboarding";
import { useRouter } from "next/navigation";
import { CompanySettings } from "./company-settings";

interface OnboardingData {
    department?: string;
    position?: string;
    location?: string;
    companyCode?: string;
    companyName?: string;
    industry?: string;
    size?: string;
    website?: string;
}

export function OnboardingFlow({ user, intent, savedData }: { user: any; intent: string; savedData?: OnboardingData | null }) {
    // Normalize intent to lowercase to avoid case-sensitivity issues
    const safeIntent = (intent || "").toLowerCase();

    // Determine initial step based on user's saved progress
    const determineInitialStep = (): "legal" | "choice" | "details" | "create" | "constraints" | "join" | "pending_approval" => {
        // If already pending approval AND has org_id, show pending screen
        // CRITICAL: This BLOCKS switching to HR flow when already joined a company
        if (user?.onboarding_status === "pending_approval" && user?.org_id) {
            return "pending_approval" as any;
        }

        // SECURITY: If user has joined a company (has org_id), they CANNOT switch to HR flow
        // This prevents employees from creating a competing company
        if (user?.org_id) {
            if (user?.onboarding_completed) {
                return "pending_approval" as any; // Will be redirected by server
            }
            // They're mid-employee flow, keep them there
            return "pending_approval" as any;
        }

        // SECURITY: If user has pending approval status but no org_id, they were rejected
        // Allow them to restart
        if (user?.approval_status === "rejected") {
            // Rejected user - let them choose again
            if (user?.terms_accepted_at) {
                return 'choice';
            }
            return "legal";
        }

        // IMPORTANT: Intent takes priority over saved step
        // This ensures HR who signed up via /hr/sign-up go to "create", not "join"
        if (user?.terms_accepted_at) {
            // HR intent - always go to create step (ignore any employee-related saved steps)
            if (safeIntent === 'hr') {
                // Only resume if they have HR-specific saved progress
                if (user?.onboarding_step && ["create", "constraints"].includes(user.onboarding_step)) {
                    return user.onboarding_step as any;
                }
                return 'create';
            }
            
            // Employee intent - go through details -> join flow
            if (safeIntent === 'employee') {
                const savedStep = user?.onboarding_step;
                if (savedStep === "pending_approval" && !user?.org_id) {
                    return "details";
                }
                if (savedStep && ["details", "join"].includes(savedStep)) {
                    return savedStep as any;
                }
                return user?.org_id ? "pending_approval" as any : "details";
            }
            
            // No intent specified - show choice
            return 'choice';
        }

        // No terms accepted yet - start from legal
        return "legal";
    };

    const [step, setStep] = useState<"legal" | "choice" | "details" | "create" | "constraints" | "join" | "pending_approval">(determineInitialStep);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const router = useRouter();

    // Created company ID (for settings step) - restore from user.org_id if on constraints step
    // This fixes the issue where refresh loses the companyId
    const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(() => {
        // If user is HR with org_id and onboarding not complete, restore the company ID
        if (user?.org_id && user?.role === "hr" && !user?.onboarding_completed) {
            return user.org_id;
        }
        return null;
    });

    // Form States - Initialize from saved data
    const [companyName, setCompanyName] = useState(savedData?.companyName || "");
    const [industry, setIndustry] = useState(savedData?.industry || "");
    const [size, setSize] = useState(savedData?.size || "");
    const [location, setLocation] = useState(savedData?.location || "");
    const [website, setWebsite] = useState(savedData?.website || "");

    // Employee Details - Initialize from saved data
    const [dept, setDept] = useState(savedData?.department || user?.department || "");
    const [position, setPosition] = useState(savedData?.position || user?.position || "");
    const [empLocation, setEmpLocation] = useState(savedData?.location || user?.work_location || "");

    const [companyCode, setCompanyCode] = useState(savedData?.companyCode || "");

    // Auto-save progress when form data changes (debounced)
    useEffect(() => {
        if (step === "details" || step === "create" || step === "join") {
            const timeoutId = setTimeout(async () => {
                if (dept || position || empLocation || companyName || companyCode) {
                    setAutoSaveStatus("saving");
                    try {
                        const result = await saveOnboardingProgress(step, {
                            department: dept,
                            position: position,
                            location: empLocation || location,
                            companyName,
                            industry,
                            size,
                            website,
                            companyCode,
                        });
                        if (result?.success) {
                            setAutoSaveStatus("saved");
                            setTimeout(() => setAutoSaveStatus("idle"), 2000);
                        } else {
                            setAutoSaveStatus("error");
                            setTimeout(() => setAutoSaveStatus("idle"), 3000);
                        }
                    } catch (err) {
                        console.error("[Onboarding] Auto-save failed:", err);
                        setAutoSaveStatus("error");
                        setTimeout(() => setAutoSaveStatus("idle"), 3000);
                    }
                }
            }, 1000);

            return () => clearTimeout(timeoutId);
        }
    }, [dept, position, empLocation, companyName, industry, size, website, companyCode, step, location]);

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
        if (!companyName || !industry) {
            setError("Please fill in company name and industry.");
            return;
        }
        setLoading(true);
        setError(""); // Clear previous errors
        
        try {
            if (process.env.NODE_ENV === 'development') {
                console.log("[Onboarding] Creating company:", companyName, industry);
            }
            const res = await registerCompany(companyName, industry, size, location, website);
            if (process.env.NODE_ENV === 'development') {
                console.log("[Onboarding] registerCompany result:", res);
            }
            
            if (res.success && res.companyId) {
                // Store company ID and move to settings step
                setCreatedCompanyId(res.companyId);
                setStep("constraints");
            } else {
                console.error("[Onboarding] Company creation failed:", res.error);
                setError(res.error || "Failed to create company. Please try again.");
            }
        } catch (err: any) {
            console.error("[Onboarding] Exception during company creation:", err);
            setError(err?.message || "An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCompanySettingsComplete = () => {
        // Redirect to HR welcome screen after settings are saved
        router.push("/hr/welcome");
    };

    const handleJoinCompany = async () => {
        if (!companyCode) {
            setError("Please enter a company code.");
            return;
        }
        setLoading(true);
        const res = await joinCompany(companyCode);
        if (res.success) {
            // Employee needs to wait for approval - show pending screen
            setStep("pending_approval" as any);
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
                            <p>Welcome to Continuum. Before proceeding, you must agree to our enterprise protocols.</p>
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
                                onClick={handleCreateCompany}
                                disabled={loading}
                                className="w-full py-3 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all mt-4 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Creating Company...
                                    </>
                                ) : (
                                    <>
                                        <Settings2 className="w-4 h-4" />
                                        Create & Configure Settings
                                    </>
                                )}
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
                        className="z-10 w-full max-w-5xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {createdCompanyId ? (
                            <div className="flex-1 overflow-y-auto">
                                <CompanySettings
                                    companyId={createdCompanyId}
                                    onComplete={handleCompanySettingsComplete}
                                    onBack={() => {
                                        // Note: Can't really go back since company is created
                                        // Just proceed to dashboard
                                        handleCompanySettingsComplete();
                                    }}
                                />
                            </div>
                        ) : (
                            // Fallback if no company ID (shouldn't happen)
                            <div className="text-center py-12">
                                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
                                <p className="text-slate-400 mb-6">Unable to load company settings. Please try again.</p>
                                <button
                                    onClick={() => setStep("create")}
                                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                                >
                                    Go Back
                                </button>
                            </div>
                        )}
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

                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-amber-200 font-medium text-sm">HR Approval Required</p>
                                        <p className="text-slate-400 text-sm mt-1">
                                            After joining, your HR manager must approve your registration before you can access all features.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-sm">{error}</p>}

                            <button
                                onClick={handleJoinCompany}
                                disabled={loading}
                                className="w-full py-3 rounded-lg bg-[#00f2ff] text-black font-bold hover:bg-[#00c8d2] transition-all mt-4 shadow-lg shadow-[#00f2ff]/20"
                            >
                                {loading ? "Verifying..." : "Request to Join Team"}
                            </button>

                            <button onClick={() => setStep("details")} className="w-full text-center text-slate-500 text-sm mt-4 hover:text-white">Back</button>
                        </div>
                    </motion.div>
                )}

                {/* PENDING APPROVAL SCREEN */}
                {step === "pending_approval" && (
                    <motion.div
                        key="pending"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="z-10 w-full max-w-lg bg-white/5 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-8 shadow-2xl text-center"
                    >
                        {/* Animated Clock */}
                        <div className="relative inline-block mb-6">
                            <motion.div
                                className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center"
                                animate={{
                                    boxShadow: [
                                        "0 0 0 0 rgba(245, 158, 11, 0.3)",
                                        "0 0 0 20px rgba(245, 158, 11, 0)",
                                    ],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Clock className="w-12 h-12 text-amber-400" />
                            </motion.div>
                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-amber-500/30 border-t-amber-500"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            Registration Submitted!
                        </h1>

                        <p className="text-slate-400 mb-6">
                            Your request to join the team has been sent. Your HR manager will review and approve your registration shortly.
                        </p>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl text-left">
                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm text-slate-300">Profile information saved</span>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl text-left">
                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm text-slate-300">Company code verified</span>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-xl text-left">
                                <Clock className="w-5 h-5 text-amber-400" />
                                <span className="text-sm text-slate-300">Waiting for HR approval</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 mb-4">
                            You'll receive an email notification once approved. You can close this page safely.
                        </p>

                        <button
                            onClick={() => router.push("/employee/pending")}
                            className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
                        >
                            Check Approval Status
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Auto-save indicator */}
            <AnimatePresence>
                {autoSaveStatus !== "idle" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 border border-white/10 backdrop-blur-sm"
                    >
                        {autoSaveStatus === "saving" && (
                            <>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Save className="w-4 h-4 text-amber-400" />
                                </motion.div>
                                <span className="text-sm text-slate-300">Saving progress...</span>
                            </>
                        )}
                        {autoSaveStatus === "saved" && (
                            <>
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-slate-300">Progress saved</span>
                            </>
                        )}
                        {autoSaveStatus === "error" && (
                            <>
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <span className="text-sm text-red-300">Failed to save</span>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
