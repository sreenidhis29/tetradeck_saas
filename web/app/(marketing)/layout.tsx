"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-400 rounded-lg" />
                            <span className="font-bold text-xl">Continuum</span>
                        </Link>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-8">
                            <Link href="#features" className="text-slate-400 hover:text-white transition">
                                Features
                            </Link>
                            <Link href="#pricing" className="text-slate-400 hover:text-white transition">
                                Pricing
                            </Link>
                            <Link href="#testimonials" className="text-slate-400 hover:text-white transition">
                                Testimonials
                            </Link>
                            <Link href="/sign-in" className="text-slate-400 hover:text-white transition">
                                Sign In
                            </Link>
                            <Link
                                href="/sign-up"
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-lg font-semibold hover:opacity-90 transition"
                            >
                                Start Free Trial
                            </Link>
                        </div>

                        {/* Mobile menu button */}
                        <button
                            className="md:hidden p-2"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-[#0a0a0f] border-t border-white/5 p-4 space-y-4">
                        <Link href="#features" className="block text-slate-400 hover:text-white">Features</Link>
                        <Link href="#pricing" className="block text-slate-400 hover:text-white">Pricing</Link>
                        <Link href="#testimonials" className="block text-slate-400 hover:text-white">Testimonials</Link>
                        <Link href="/sign-in" className="block text-slate-400 hover:text-white">Sign In</Link>
                        <Link
                            href="/sign-up"
                            className="block w-full text-center px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-lg font-semibold"
                        >
                            Start Free Trial
                        </Link>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="pt-16">{children}</main>

            {/* Footer */}
            <footer className="bg-[#050508] border-t border-white/5 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-400 rounded-lg" />
                                <span className="font-bold text-xl">Continuum</span>
                            </div>
                            <p className="text-slate-400 text-sm">
                                The modern HR platform for startups that care about their people.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Product</h4>
                            <ul className="space-y-2 text-slate-400 text-sm">
                                <li><Link href="#features" className="hover:text-white">Features</Link></li>
                                <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
                                <li><Link href="/changelog" className="hover:text-white">Changelog</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-slate-400 text-sm">
                                <li><Link href="/about" className="hover:text-white">About</Link></li>
                                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Legal</h4>
                            <ul className="space-y-2 text-slate-400 text-sm">
                                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                                <li><Link href="/cookies" className="hover:text-white">Cookie Policy</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-slate-500 text-sm">
                            © {new Date().getFullYear()} Continuum. All rights reserved.
                        </p>
                        <div className="flex gap-6">
                            <a href="https://twitter.com" className="text-slate-400 hover:text-white">Twitter</a>
                            <a href="https://linkedin.com" className="text-slate-400 hover:text-white">LinkedIn</a>
                            <a href="https://github.com" className="text-slate-400 hover:text-white">GitHub</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
