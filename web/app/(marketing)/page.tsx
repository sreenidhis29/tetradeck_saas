"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { 
    Sparkles, 
    Users, 
    Calendar, 
    Shield, 
    Zap, 
    BarChart3, 
    Clock, 
    CheckCircle, 
    ArrowRight, 
    Play,
    Star,
    Building2,
    Globe,
    Rocket,
    Heart,
    Bot
} from "lucide-react";
import { useState } from "react";

const features = [
    {
        icon: Bot,
        title: "AI Leave Management",
        description: "Smart leave requests with AI-powered approval suggestions and conflict detection.",
        color: "from-purple-500 to-purple-600"
    },
    {
        icon: Users,
        title: "Team Management",
        description: "Organize your workforce with departments, hierarchies, and role-based access.",
        color: "from-cyan-500 to-cyan-600"
    },
    {
        icon: Calendar,
        title: "Attendance Tracking",
        description: "Real-time check-in/out with geolocation and automatic overtime calculation.",
        color: "from-blue-500 to-blue-600"
    },
    {
        icon: Shield,
        title: "Enterprise Security",
        description: "SOC 2 compliant with SSO, 2FA, and complete audit trails.",
        color: "from-green-500 to-green-600"
    },
    {
        icon: BarChart3,
        title: "Analytics Dashboard",
        description: "Real-time insights on attendance, leave patterns, and workforce productivity.",
        color: "from-orange-500 to-orange-600"
    },
    {
        icon: Zap,
        title: "Instant Onboarding",
        description: "New employees are productive in minutes, not days. Automated workflows.",
        color: "from-pink-500 to-pink-600"
    }
];

const testimonials = [
    {
        name: "Sarah Chen",
        role: "CEO, TechFlow",
        image: "SC",
        content: "Continuum saved us 20+ hours/week on HR admin. The AI leave management is incredible.",
        rating: 5
    },
    {
        name: "Michael Roberts",
        role: "HR Director, ScaleUp",
        image: "MR",
        content: "Finally an HR tool built for startups. Simple, powerful, and actually affordable.",
        rating: 5
    },
    {
        name: "Priya Sharma",
        role: "Founder, CloudNine",
        image: "PS",
        content: "We went from spreadsheets to a full HR system in one afternoon. Game changer.",
        rating: 5
    }
];

const pricingPlans = [
    {
        name: "Starter",
        description: "For small teams getting started",
        price: "Free",
        period: "forever for early adopters",
        features: [
            "Up to 25 employees",
            "Leave management",
            "Basic attendance",
            "Email support",
            "1 HR admin"
        ],
        cta: "Start Free",
        popular: false
    },
    {
        name: "Growth",
        description: "For scaling companies",
        price: "$4",
        period: "/employee/month",
        features: [
            "Unlimited employees",
            "AI leave management",
            "Advanced attendance + GPS",
            "Priority support",
            "Unlimited HR admins",
            "Custom workflows",
            "Analytics dashboard"
        ],
        cta: "Start Free Trial",
        popular: true
    },
    {
        name: "Enterprise",
        description: "For large organizations",
        price: "Custom",
        period: "contact us",
        features: [
            "Everything in Growth",
            "SSO/SAML",
            "Dedicated account manager",
            "Custom integrations",
            "SLA guarantee",
            "On-premise option",
            "White-label option"
        ],
        cta: "Contact Sales",
        popular: false
    }
];

const stats = [
    { value: "500+", label: "Companies" },
    { value: "50K+", label: "Employees" },
    { value: "99.9%", label: "Uptime" },
    { value: "4.9/5", label: "Rating" }
];

export default function LandingPage() {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleWaitlist = async (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Send to your waitlist API
        setSubmitted(true);
    };

    return (
        <div className="overflow-hidden">
            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center py-32 px-4">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-[#0a0a0f] to-[#0a0a0f]" />
                <div className="absolute w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] top-0 left-1/4 animate-pulse" />
                <div className="absolute w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[120px] bottom-0 right-1/4 animate-pulse" />
                
                <div className="relative z-10 max-w-6xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-sm mb-8">
                            <Sparkles className="w-4 h-4" />
                            <span>Now with AI-Powered Leave Management</span>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-br from-white via-purple-200 to-purple-400 bg-clip-text text-transparent leading-tight"
                    >
                        The HR Platform<br />
                        Startups Deserve
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto"
                    >
                        Leave management, attendance, and team organization — all in one beautiful platform. 
                        <span className="text-purple-400"> Free for your first year.</span>
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
                    >
                        <Link
                            href="/sign-up"
                            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-xl font-semibold text-lg hover:opacity-90 transition flex items-center gap-2 group"
                        >
                            Get Started Free
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                        </Link>
                        <button className="px-8 py-4 border border-white/20 rounded-xl font-semibold text-lg hover:bg-white/5 transition flex items-center gap-2">
                            <Play className="w-5 h-5" />
                            Watch Demo
                        </button>
                    </motion.div>

                    {/* Waitlist Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="max-w-md mx-auto"
                    >
                        {!submitted ? (
                            <form onSubmit={handleWaitlist} className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="Enter your work email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 text-white placeholder:text-slate-500"
                                    required
                                />
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-purple-600 rounded-lg font-semibold hover:bg-purple-700 transition"
                                >
                                    Join Waitlist
                                </button>
                            </form>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-green-400">
                                <CheckCircle className="w-5 h-5" />
                                <span>You&apos;re on the list! We&apos;ll reach out soon.</span>
                            </div>
                        )}
                        <p className="text-slate-500 text-sm mt-3">
                            No credit card required • Free for startups under 25 employees
                        </p>
                    </motion.div>

                    {/* Social Proof Stats */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
                    >
                        {stats.map((stat, i) => (
                            <div key={i} className="text-center">
                                <div className="text-3xl font-bold bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
                                    {stat.value}
                                </div>
                                <div className="text-slate-500 text-sm">{stat.label}</div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Trusted By Section */}
            <section className="py-16 border-y border-white/5 bg-[#050508]">
                <div className="max-w-6xl mx-auto px-4 text-center">
                    <p className="text-slate-500 text-sm mb-8">TRUSTED BY INNOVATIVE STARTUPS</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 opacity-50">
                        {["TechFlow", "ScaleUp", "CloudNine", "DataForge", "Nexus"].map((company) => (
                            <div key={company} className="flex items-center gap-2 text-slate-400">
                                <Building2 className="w-6 h-6" />
                                <span className="font-semibold text-lg">{company}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Everything you need to manage your team
                        </h2>
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                            One platform for leave, attendance, and workforce management. 
                            No more spreadsheets, no more chaos.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all duration-300"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <feature.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-slate-400">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-32 px-4 bg-gradient-to-b from-[#0a0a0f] to-[#050508]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm mb-4">
                            <Heart className="w-4 h-4" />
                            <span>Free for 1 year for early adopters</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Simple, transparent pricing
                        </h2>
                        <p className="text-xl text-slate-400">
                            Start free, scale as you grow. No hidden fees, ever.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {pricingPlans.map((plan, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className={`relative p-8 rounded-2xl border ${
                                    plan.popular 
                                        ? "bg-gradient-to-b from-purple-900/30 to-[#0a0a0f] border-purple-500" 
                                        : "bg-white/5 border-white/10"
                                }`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full text-sm font-semibold">
                                        Most Popular
                                    </div>
                                )}
                                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                                <p className="text-slate-400 mb-6">{plan.description}</p>
                                <div className="mb-6">
                                    <span className="text-4xl font-bold">{plan.price}</span>
                                    <span className="text-slate-400 ml-2">{plan.period}</span>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature, j) => (
                                        <li key={j} className="flex items-center gap-2 text-slate-300">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href="/sign-up"
                                    className={`block w-full py-3 rounded-lg font-semibold text-center transition ${
                                        plan.popular
                                            ? "bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90"
                                            : "bg-white/10 hover:bg-white/20"
                                    }`}
                                >
                                    {plan.cta}
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section id="testimonials" className="py-32 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Loved by startups worldwide
                        </h2>
                        <p className="text-xl text-slate-400">
                            See why hundreds of companies chose Continuum
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {testimonials.map((testimonial, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className="p-8 rounded-2xl bg-white/5 border border-white/10"
                            >
                                <div className="flex gap-1 mb-4">
                                    {[...Array(testimonial.rating)].map((_, j) => (
                                        <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                    ))}
                                </div>
                                <p className="text-lg text-slate-300 mb-6">&ldquo;{testimonial.content}&rdquo;</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center font-bold">
                                        {testimonial.image}
                                    </div>
                                    <div>
                                        <div className="font-semibold">{testimonial.name}</div>
                                        <div className="text-slate-400 text-sm">{testimonial.role}</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="p-12 rounded-3xl bg-gradient-to-br from-purple-900/50 to-cyan-900/30 border border-purple-500/30">
                        <Rocket className="w-16 h-16 mx-auto mb-6 text-purple-400" />
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Ready to transform your HR?
                        </h2>
                        <p className="text-xl text-slate-400 mb-8">
                            Join hundreds of startups already using Continuum. 
                            Free for your first year, no strings attached.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/sign-up"
                                className="px-8 py-4 bg-white text-black rounded-xl font-semibold text-lg hover:bg-slate-200 transition"
                            >
                                Get Started Free
                            </Link>
                            <Link
                                href="/contact"
                                className="px-8 py-4 border border-white/20 rounded-xl font-semibold text-lg hover:bg-white/5 transition"
                            >
                                Talk to Sales
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
