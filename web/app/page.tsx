import Link from 'next/link';
import { User, Briefcase, ArrowRight, Sparkles, Shield, Zap, Clock, ChevronRight, Check, Globe, Cpu } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { TrustBadges } from '@/components/marketing/DataDrivenSections';

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-[#030305] text-white overflow-hidden relative">
      {/* ============ PREMIUM BACKGROUND EFFECTS ============ */}
      {/* Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] bg-gradient-to-br from-purple-600/20 via-purple-900/10 to-transparent rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-[40%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-tl from-cyan-500/15 via-blue-900/10 to-transparent rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-purple-500/5 rounded-full blur-[100px] animate-morph" />
      </div>

      {/* Grid Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      {/* Floating Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `particle-float ${15 + Math.random() * 20}s linear infinite`,
              animationDelay: `${Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* ============ NAVIGATION ============ */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Continuum</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#security" className="text-sm text-white/60 hover:text-white transition-colors">Security</a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {userId ? (
              <Link href="/onboarding" className="btn-primary text-sm px-5 py-2.5">
                Dashboard <ArrowRight className="w-4 h-4 ml-2 inline" />
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2">
                  Sign In
                </Link>
                <Link href="/hr/sign-up" className="btn-primary text-sm px-5 py-2.5">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ============ HERO SECTION ============ */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-6xl mx-auto text-center z-10">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-up">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <span className="text-sm text-white/70">Introducing AI-Powered Leave Management</span>
            <ChevronRight className="w-4 h-4 text-purple-400" />
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[0.9] tracking-tight animate-fade-up delay-100">
            <span className="block text-white">The Future of</span>
            <span className="block mt-2 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">
              Workforce Management
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-up delay-200">
            Enterprise-grade HR platform with AI intelligence. Automate leave workflows, 
            track attendance in real-time, and scale your team effortlessly.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up delay-300">
            <Link href="/hr/sign-up" className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-500 rounded-2xl font-semibold text-white shadow-[0_0_40px_rgba(168,85,247,0.3)] hover:shadow-[0_0_60px_rgba(168,85,247,0.4)] transition-all duration-300 hover:-translate-y-1">
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-cyan-400 opacity-0 group-hover:opacity-20 transition-opacity blur-xl" />
            </Link>
            <Link href="/sign-up" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all duration-300">
              <span>Join as Employee</span>
            </Link>
          </div>

          {/* Trust Badges - Now fetched from database */}
          <div className="animate-fade-up delay-400">
            <TrustBadges />
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
            <div className="w-1 h-3 bg-white/40 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* ============ PORTAL CARDS ============ */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Choose Your Portal</h2>
            <p className="text-white/50 max-w-xl mx-auto">Select your role to access the platform tailored for your needs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* HR Portal Card */}
            <Link href="/hr/auth" className="group">
              <div className="glass-card p-8 h-full relative">
                {/* Glow Effect */}
                <div className="absolute -inset-px rounded-[24px] bg-gradient-to-r from-purple-500/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
                
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all duration-300">
                    <Briefcase className="w-7 h-7 text-purple-400" />
                  </div>
                  
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-400 font-medium mb-4">
                    <Cpu className="w-3 h-3" />
                    AI-Powered
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-2xl font-bold text-white mb-3">HR Portal</h3>
                  <p className="text-white/50 text-sm mb-6 leading-relaxed">
                    Create your organization, manage teams, automate leave approvals, and access powerful analytics.
                  </p>
                  
                  {/* Features */}
                  <div className="space-y-2 mb-8">
                    {['Smart Leave Automation', 'Real-time Attendance', 'Team Analytics'].map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                        <Check className="w-4 h-4 text-purple-400" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* CTA */}
                  <div className="flex items-center gap-2 text-purple-400 font-semibold group-hover:gap-3 transition-all">
                    <span>Access Dashboard</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Employee Portal Card */}
            <Link href="/employee/auth" className="group">
              <div className="glass-card p-8 h-full relative">
                {/* Glow Effect */}
                <div className="absolute -inset-px rounded-[24px] bg-gradient-to-r from-cyan-500/20 via-transparent to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
                
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-300">
                    <User className="w-7 h-7 text-cyan-400" />
                  </div>
                  
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-medium mb-4">
                    <Clock className="w-3 h-3" />
                    Instant Access
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-2xl font-bold text-white mb-3">Employee Portal</h3>
                  <p className="text-white/50 text-sm mb-6 leading-relaxed">
                    Join your team, request leaves with one click, check-in seamlessly, and track your schedule.
                  </p>
                  
                  {/* Features */}
                  <div className="space-y-2 mb-8">
                    {['One-Click Leave Requests', 'Mobile Check-in', 'Schedule Overview'].map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                        <Check className="w-4 h-4 text-cyan-400" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* CTA */}
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold group-hover:gap-3 transition-all">
                    <span>Enter Workspace</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FEATURES SECTION ============ */}
      <section id="features" className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">Why Continuum</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Built for the <span className="gradient-text-static">Modern Workplace</span>
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              Everything you need to manage your workforce, powered by cutting-edge AI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Cpu,
                title: 'AI Leave Assistant',
                description: 'Smart suggestions for leave scheduling based on team availability and workload',
                color: 'purple'
              },
              {
                icon: Clock,
                title: 'Real-time Tracking',
                description: 'Live attendance updates with geolocation and biometric integrations',
                color: 'cyan'
              },
              {
                icon: Shield,
                title: 'Enterprise Security',
                description: 'Bank-grade encryption with SOC 2 compliance and audit trails',
                color: 'green'
              }
            ].map((feature, i) => (
              <div key={i} className="stat-card group hover:bg-white/[0.02]">
                <div className={`w-12 h-12 rounded-xl bg-${feature.color}-500/10 border border-${feature.color}-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}-400`} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Continuum</span>
          </div>
          <p className="text-sm text-white/40">© 2026 Continuum. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="/legal/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/legal/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:support@continuum.hr" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
