import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy | Continuum",
    description: "How we collect, use, and protect your data"
};

export default function PrivacyPage() {
    return (
        <div className="py-32 px-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
                <p className="text-slate-400 mb-8">Last updated: January 22, 2026</p>

                <div className="prose prose-invert max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                        <p className="text-slate-300 leading-relaxed">
                            Continuum (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. 
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                            information when you use our HR management platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                        <h3 className="text-xl font-medium mb-2 text-slate-200">2.1 Personal Information</h3>
                        <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                            <li>Name and email address</li>
                            <li>Company name and role</li>
                            <li>Employee data (as provided by your organization)</li>
                            <li>Authentication credentials (handled securely by Clerk)</li>
                        </ul>

                        <h3 className="text-xl font-medium mb-2 text-slate-200">2.2 Usage Information</h3>
                        <ul className="list-disc list-inside text-slate-300 space-y-2">
                            <li>Log data (IP address, browser type, pages visited)</li>
                            <li>Device information</li>
                            <li>Analytics data to improve our service</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                        <ul className="list-disc list-inside text-slate-300 space-y-2">
                            <li>To provide and maintain our service</li>
                            <li>To notify you about changes to our service</li>
                            <li>To provide customer support</li>
                            <li>To gather analysis to improve our service</li>
                            <li>To detect and prevent technical issues</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
                        <p className="text-slate-300 leading-relaxed">
                            We implement industry-standard security measures including:
                        </p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2 mt-2">
                            <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
                            <li>Regular security audits</li>
                            <li>Access controls and authentication</li>
                            <li>Secure hosting on SOC 2 compliant infrastructure</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
                        <p className="text-slate-300 leading-relaxed">
                            We retain your data for as long as your account is active or as needed to provide 
                            services. You may request deletion of your data at any time by contacting us.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
                        <p className="text-slate-300 leading-relaxed mb-2">You have the right to:</p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2">
                            <li>Access your personal data</li>
                            <li>Correct inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Export your data in a portable format</li>
                            <li>Opt-out of marketing communications</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">7. Third-Party Services</h2>
                        <p className="text-slate-300 leading-relaxed">
                            We use trusted third-party services:
                        </p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2 mt-2">
                            <li><strong>Clerk</strong> - Authentication and user management</li>
                            <li><strong>Supabase/PostgreSQL</strong> - Data storage</li>
                            <li><strong>Vercel</strong> - Hosting and infrastructure</li>
                            <li><strong>Stripe</strong> - Payment processing (for paid plans)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
                        <p className="text-slate-300 leading-relaxed">
                            For privacy-related questions, contact us at:
                            <br />
                            <a href="mailto:privacy@continuum.hr" className="text-purple-400 hover:underline">
                                privacy@continuum.hr
                            </a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
