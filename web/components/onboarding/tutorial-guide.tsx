"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { markTutorialCompleted } from "@/app/actions/onboarding";
import {
    LayoutDashboard,
    Calendar,
    Clock,
    FileText,
    Bot,
    Bell,
    User,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    Sparkles,
    MousePointer,
    MessageSquare,
    Settings,
    ArrowRight,
    X
} from "lucide-react";

interface TutorialGuideProps {
    role: "employee" | "hr";
    onComplete: () => void;
}

const employeeSteps = [
    {
        id: 1,
        title: "Your Dashboard",
        description: "This is your command center. View your leave balance, attendance stats, and quick actions all in one place.",
        icon: LayoutDashboard,
        color: "from-blue-500 to-cyan-500",
        features: [
            "Real-time leave balance tracking",
            "Daily attendance status",
            "Quick actions for common tasks",
            "AI-powered insights"
        ],
        tip: "Check your dashboard daily to stay on top of your work schedule!"
    },
    {
        id: 2,
        title: "AI Leave Assistant",
        description: "Our intelligent AI understands natural language. Just type what you need, and it handles the rest.",
        icon: Bot,
        color: "from-purple-500 to-pink-500",
        features: [
            "Natural language leave requests",
            "Smart date detection",
            "Policy compliance check",
            "Instant recommendations"
        ],
        tip: "Try saying: 'I need sick leave tomorrow' or 'Can I take vacation next week?'"
    },
    {
        id: 3,
        title: "Check-In & Attendance",
        description: "Mark check-in/out and view your daily status with total hours.",
        icon: Clock,
        color: "from-emerald-500 to-teal-500",
        features: [
            "One-click check-in/out",
            "Today's status and timestamps",
            "Total hours shown on checkout",
            "Recent attendance history"
        ],
        tip: "Tap Check In at start, and Check Out before you leave."
    },
    {
        id: 4,
        title: "Leave Management",
        description: "Create requests, track approvals, and monitor balances.",
        icon: Calendar,
        color: "from-orange-500 to-amber-500",
        features: [
            "Multiple leave types",
            "Real-time approval status",
            "Balances and recent history",
            "Holiday calendar"
        ],
        tip: "Submit early to improve approval chances and plan around holidays."
    },
    {
        id: 5,
        title: "Documents & Profile",
        description: "View documents and your profile details in one place.",
        icon: User,
        color: "from-indigo-500 to-violet-500",
        features: [
            "Document list and details",
            "Profile overview",
            "Company and department info",
            "Contact information"
        ],
        tip: "Keep your profile details current for smooth communication."
    }
];

const hrSteps = [
    {
        id: 1,
        title: "HR Command Center",
        description: "Your unified dashboard for managing the entire workforce. Real-time metrics and actionable insights.",
        icon: LayoutDashboard,
        color: "from-purple-600 to-indigo-600",
        features: [
            "Workforce overview",
            "Pending approvals queue",
            "Department analytics",
            "Quick action buttons"
        ],
        tip: "Start each day by reviewing pending requests to maintain SLA!"
    },
    {
        id: 2,
        title: "Employee Approvals",
        description: "New employees await your approval before they can access the system. Review and approve registrations here.",
        icon: CheckCircle2,
        color: "from-emerald-500 to-green-500",
        features: [
            "Pending registration queue",
            "Employee verification",
            "Department assignment",
            "Access control management"
        ],
        tip: "Review new employee registrations promptly to help them get started!"
    },
    {
        id: 3,
        title: "AI-Powered Leave Processing",
        description: "Our AI analyzes leave requests considering team coverage, policies, and historical patterns.",
        icon: Bot,
        color: "from-[#00f2ff] to-blue-500",
        features: [
            "AI recommendation engine",
            "Policy compliance checking",
            "Team coverage analysis",
            "Bulk approval actions"
        ],
        tip: "AI recommendations speed up decisions but final approval is always yours!"
    },
    {
        id: 4,
        title: "Team Management",
        description: "Monitor requests and team activity from the dashboard.",
        icon: Bell,
        color: "from-pink-500 to-rose-500",
        features: [
            "Pending approvals queue",
            "Leave requests overview",
            "Department filters",
            "Activity feed"
        ],
        tip: "Clear the approvals queue early to maintain SLAs."
    },
    {
        id: 5,
        title: "Policies & Settings",
        description: "Configure leave policies, constraints, and organizational settings for your company.",
        icon: Settings,
        color: "from-slate-500 to-zinc-600",
        features: [
            "Leave policy configuration",
            "Blackout date management",
            "Approval workflow setup",
            "Notification preferences"
        ],
        tip: "Well-configured policies lead to smoother leave management!"
    }
];

export function TutorialGuide({ role, onComplete }: TutorialGuideProps) {
    const steps = role === "hr" ? hrSteps : employeeSteps;
    const [currentStep, setCurrentStep] = useState(0);
    const [isExiting, setIsExiting] = useState(false);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        setIsExiting(true);
        await markTutorialCompleted();
        setTimeout(onComplete, 500);
    };

    const handleSkip = async () => {
        setIsExiting(true);
        await markTutorialCompleted();
        setTimeout(onComplete, 500);
    };

    const step = steps[currentStep];
    const Icon = step.icon;

    return (
        <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: isExiting ? 0 : 1 }}
            transition={{ duration: 0.5 }}
        >
            {/* Background Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 30 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 rounded-full bg-[#00f2ff]/30"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                            y: [0, -20, 0],
                            opacity: [0.3, 0.8, 0.3],
                        }}
                        transition={{
                            duration: 2 + Math.random() * 2,
                            repeat: Infinity,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}
            </div>

            {/* Main Card */}
            <motion.div
                className="relative w-full max-w-4xl bg-[#0a0a0f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 25 }}
            >
                {/* Skip Button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-6 right-6 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors group"
                >
                    <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                </button>

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                    <motion.div
                        className="h-full bg-gradient-to-r from-[#00f2ff] to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                <div className="flex flex-col lg:flex-row min-h-[500px]">
                    {/* Left Side - Steps Navigation */}
                    <div className="lg:w-64 p-6 bg-white/[0.02] border-b lg:border-b-0 lg:border-r border-white/5">
                        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                            {steps.map((s, index) => {
                                const StepIcon = s.icon;
                                const isActive = index === currentStep;
                                const isCompleted = index < currentStep;

                                return (
                                    <motion.button
                                        key={s.id}
                                        onClick={() => setCurrentStep(index)}
                                        className={`flex-shrink-0 flex items-center gap-3 p-3 rounded-xl transition-all ${
                                            isActive
                                                ? "bg-white/10 border border-white/20"
                                                : isCompleted
                                                ? "bg-emerald-500/10"
                                                : "hover:bg-white/5"
                                        }`}
                                        whileHover={{ x: 4 }}
                                    >
                                        <div
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                isActive
                                                    ? `bg-gradient-to-br ${s.color}`
                                                    : isCompleted
                                                    ? "bg-emerald-500"
                                                    : "bg-white/5"
                                            }`}
                                        >
                                            {isCompleted ? (
                                                <CheckCircle2 className="w-5 h-5 text-white" />
                                            ) : (
                                                <StepIcon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`} />
                                            )}
                                        </div>
                                        <span className={`hidden lg:block text-sm ${isActive ? "text-white font-medium" : "text-slate-400"}`}>
                                            {s.title}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side - Content */}
                    <div className="flex-1 p-8 lg:p-12">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="h-full flex flex-col"
                            >
                                {/* Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <motion.div
                                        className={`p-4 rounded-2xl bg-gradient-to-br ${step.color}`}
                                        initial={{ scale: 0, rotate: -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", delay: 0.1 }}
                                    >
                                        <Icon className="w-8 h-8 text-white" />
                                    </motion.div>
                                    <div>
                                        <motion.p
                                            className="text-[#00f2ff] text-sm font-mono"
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.15 }}
                                        >
                                            Step {currentStep + 1} of {steps.length}
                                        </motion.p>
                                        <motion.h2
                                            className="text-2xl lg:text-3xl font-bold text-white"
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            {step.title}
                                        </motion.h2>
                                    </div>
                                </div>

                                {/* Description */}
                                <motion.p
                                    className="text-slate-400 text-lg mb-8"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.25 }}
                                >
                                    {step.description}
                                </motion.p>

                                {/* Features */}
                                <motion.div
                                    className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    {step.features.map((feature, i) => (
                                        <motion.div
                                            key={feature}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.35 + i * 0.05 }}
                                        >
                                            <Sparkles className="w-4 h-4 text-[#00f2ff] flex-shrink-0" />
                                            <span className="text-sm text-slate-300">{feature}</span>
                                        </motion.div>
                                    ))}
                                </motion.div>

                                {/* Pro Tip */}
                                <motion.div
                                    className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-8"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                >
                                    <div className="flex items-start gap-3">
                                        <MessageSquare className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-purple-300 font-medium text-sm mb-1">Pro Tip</p>
                                            <p className="text-slate-400 text-sm">{step.tip}</p>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Navigation */}
                                <div className="mt-auto flex items-center justify-between">
                                    <button
                                        onClick={handlePrev}
                                        disabled={currentStep === 0}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                        Previous
                                    </button>

                                    <div className="flex gap-2">
                                        {steps.map((_, i) => (
                                            <motion.div
                                                key={i}
                                                className={`w-2 h-2 rounded-full transition-colors ${
                                                    i === currentStep
                                                        ? "bg-[#00f2ff]"
                                                        : i < currentStep
                                                        ? "bg-emerald-500"
                                                        : "bg-white/20"
                                                }`}
                                                whileHover={{ scale: 1.3 }}
                                            />
                                        ))}
                                    </div>

                                    <motion.button
                                        onClick={handleNext}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                                            currentStep === steps.length - 1
                                                ? "bg-gradient-to-r from-[#00f2ff] to-purple-600 text-white"
                                                : "bg-white/10 text-white hover:bg-white/20"
                                        }`}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {currentStep === steps.length - 1 ? (
                                            <>
                                                Get Started
                                                <ArrowRight className="w-5 h-5" />
                                            </>
                                        ) : (
                                            <>
                                                Next
                                                <ChevronRight className="w-5 h-5" />
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
