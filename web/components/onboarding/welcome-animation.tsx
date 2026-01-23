"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { markWelcomeShown } from "@/app/actions/onboarding";
import { Sparkles, Zap, Globe, Users, Shield, ArrowRight } from "lucide-react";

interface WelcomeAnimationProps {
    userName: string;
    onComplete: () => void;
}

export function WelcomeAnimation({ userName, onComplete }: WelcomeAnimationProps) {
    const [phase, setPhase] = useState(0);
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Generate particles on mount
    useEffect(() => {
        const newParticles = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 4 + 1,
            delay: Math.random() * 2,
        }));
        setParticles(newParticles);
    }, []);

    // 3D Grid Animation on Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let animationId: number;
        let time = 0;

        const draw = () => {
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const gridSize = 40;
            const perspective = 500;

            ctx.strokeStyle = "rgba(0, 242, 255, 0.2)";
            ctx.lineWidth = 1;

            // Draw perspective grid
            for (let i = -20; i <= 20; i++) {
                for (let j = -20; j <= 20; j++) {
                    const x = i * gridSize;
                    const z = j * gridSize + time * 50;
                    const y = Math.sin(x * 0.01 + time) * 30 + Math.cos(z * 0.01 + time) * 30;

                    const scale = perspective / (perspective + z);
                    const screenX = centerX + x * scale;
                    const screenY = centerY + y * scale - 100;

                    if (scale > 0.1 && screenX > 0 && screenX < canvas.width && screenY > 0 && screenY < canvas.height) {
                        const brightness = Math.max(0, 1 - (z / 1000));
                        ctx.fillStyle = `rgba(0, 242, 255, ${brightness * 0.8})`;
                        ctx.beginPath();
                        ctx.arc(screenX, screenY, scale * 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Draw connecting lines
            ctx.strokeStyle = "rgba(168, 85, 247, 0.1)";
            for (let i = 0; i < 10; i++) {
                const angle = (time + i * 0.6) * 0.5;
                const radius = 200 + Math.sin(time * 2 + i) * 50;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, angle, angle + 1);
                ctx.stroke();
            }

            time += 0.01;
            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => cancelAnimationFrame(animationId);
    }, []);

    // Phase progression
    useEffect(() => {
        const timers = [
            setTimeout(() => setPhase(1), 500),
            setTimeout(() => setPhase(2), 2500),
            setTimeout(() => setPhase(3), 4500),
            setTimeout(() => setPhase(4), 6500),
        ];

        return () => timers.forEach(clearTimeout);
    }, []);

    const handleContinue = async () => {
        await markWelcomeShown();
        // Local fallback flag to prevent re-show in case DB update fails
        try {
            const uid = (typeof window !== 'undefined' && (window as any).Clerk?.user?.id) || undefined;
            const key = `welcome_shown_${uid || 'unknown'}`;
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, '1');
            }
        } catch {}
        onComplete();
    };

    const firstName = userName?.split(" ")[0] || "there";

    return (
        <div className="fixed inset-0 z-[100] bg-black overflow-hidden">
            {/* 3D Canvas Background */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-0"
            />

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black z-10" />
            <div className="absolute inset-0 bg-gradient-radial from-purple-900/20 via-transparent to-transparent z-10" />

            {/* Floating Particles */}
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute rounded-full bg-[#00f2ff]"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        width: particle.size,
                        height: particle.size,
                    }}
                    animate={{
                        y: [0, -30, 0],
                        opacity: [0.2, 0.8, 0.2],
                        scale: [1, 1.5, 1],
                    }}
                    transition={{
                        duration: 3 + particle.delay,
                        repeat: Infinity,
                        delay: particle.delay,
                        ease: "easeInOut",
                    }}
                />
            ))}

            {/* Main Content */}
            <div className="relative z-20 flex flex-col items-center justify-center min-h-screen px-8">
                <AnimatePresence mode="wait">
                    {/* Phase 0-1: Logo Reveal */}
                    {phase <= 1 && (
                        <motion.div
                            key="logo"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, opacity: 0, y: -100 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20 }}
                            className="relative"
                        >
                            {/* Glowing Ring */}
                            <motion.div
                                className="absolute -inset-8 rounded-full"
                                animate={{
                                    boxShadow: [
                                        "0 0 60px 20px rgba(0, 242, 255, 0.3)",
                                        "0 0 100px 40px rgba(168, 85, 247, 0.4)",
                                        "0 0 60px 20px rgba(0, 242, 255, 0.3)",
                                    ],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />

                            {/* Logo Icon */}
                            <motion.div
                                className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#00f2ff] to-purple-600 flex items-center justify-center"
                                animate={{
                                    rotateY: [0, 360],
                                }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                style={{ transformStyle: "preserve-3d" }}
                            >
                                <Globe className="w-16 h-16 text-white" />
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Phase 2: Welcome Text */}
                    {phase === 2 && (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -50 }}
                            className="text-center"
                        >
                            <motion.div
                                className="text-[#00f2ff] text-xl font-mono tracking-[0.5em] mb-4"
                                initial={{ opacity: 0, letterSpacing: "0.2em" }}
                                animate={{ opacity: 1, letterSpacing: "0.5em" }}
                                transition={{ duration: 1 }}
                            >
                                WELCOME TO
                            </motion.div>

                            <motion.h1
                                className="text-7xl md:text-9xl font-black tracking-tight"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                            >
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00f2ff] via-purple-400 to-pink-500">
                                    CONTINUUM
                                </span>
                            </motion.h1>

                            <motion.div
                                className="mt-6 flex items-center justify-center gap-2 text-slate-400"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                            >
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                <span className="text-lg">A World Full of Experience</span>
                                <Sparkles className="w-5 h-5 text-[#00f2ff]" />
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Phase 3: Personal Greeting */}
                    {phase === 3 && (
                        <motion.div
                            key="greeting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center max-w-3xl"
                        >
                            <motion.div
                                className="text-2xl text-slate-400 mb-4"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                            >
                                Hello, {firstName}
                            </motion.div>

                            <motion.h2
                                className="text-4xl md:text-6xl font-bold text-white mb-8"
                                initial={{ y: 30, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                Your journey begins now
                            </motion.h2>

                            <motion.div
                                className="grid grid-cols-3 gap-6"
                                initial={{ y: 40, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                {[
                                    { icon: Zap, label: "AI-Powered", color: "from-yellow-500 to-orange-500" },
                                    { icon: Shield, label: "Enterprise Security", color: "from-[#00f2ff] to-blue-500" },
                                    { icon: Users, label: "Team Collaboration", color: "from-purple-500 to-pink-500" },
                                ].map((item, i) => (
                                    <motion.div
                                        key={item.label}
                                        className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                                    >
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${item.color}`}>
                                            <item.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <span className="text-sm text-slate-300">{item.label}</span>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Phase 4: Call to Action */}
                    {phase === 4 && (
                        <motion.div
                            key="cta"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center"
                        >
                            <motion.div
                                className="mb-8"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                            >
                                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                    Ready to explore?
                                </h2>
                                <p className="text-slate-400 text-lg">
                                    Let us show you around your new workspace
                                </p>
                            </motion.div>

                            <motion.button
                                onClick={handleContinue}
                                className="group relative px-12 py-5 rounded-2xl bg-gradient-to-r from-[#00f2ff] to-purple-600 text-white font-bold text-xl overflow-hidden"
                                initial={{ y: 30, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {/* Shimmer effect */}
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full"
                                    animate={{ translateX: ["100%", "-100%"] }}
                                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                                />

                                <span className="relative z-10 flex items-center gap-3">
                                    Start Your Journey
                                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                                </span>
                            </motion.button>

                            <motion.p
                                className="mt-6 text-sm text-slate-500"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                Press Enter or click to continue
                            </motion.p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Corner Decorations */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-[#00f2ff]/20 to-transparent blur-3xl z-0" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-purple-600/20 to-transparent blur-3xl z-0" />
        </div>
    );
}
