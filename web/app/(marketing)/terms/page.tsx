import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service | Continuum",
    description: "Terms and conditions for using Continuum"
};

export default function TermsPage() {
    return (
        <div className="py-32 px-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
                <p className="text-slate-400 mb-8">Last updated: January 22, 2026</p>

                <div className="prose prose-invert max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                        <p className="text-slate-300 leading-relaxed">
                            By accessing or using Continuum (&ldquo;the Service&rdquo;), you agree to be bound by these 
                            Terms of Service. If you disagree with any part of these terms, you may not 
                            access the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                        <p className="text-slate-300 leading-relaxed">
                            Continuum is a cloud-based HR management platform that provides:
                        </p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2 mt-2">
                            <li>Leave management and approval workflows</li>
                            <li>Attendance and time tracking</li>
                            <li>Employee database and organization management</li>
                            <li>AI-powered HR assistance</li>
                            <li>Reporting and analytics</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
                        <p className="text-slate-300 leading-relaxed">
                            To use the Service, you must:
                        </p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2 mt-2">
                            <li>Be at least 18 years old</li>
                            <li>Provide accurate registration information</li>
                            <li>Maintain the security of your account credentials</li>
                            <li>Accept responsibility for all activities under your account</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">4. Free Trial & Pricing</h2>
                        <p className="text-slate-300 leading-relaxed">
                            We offer a free tier for early adopters (up to 25 employees for 1 year). 
                            After the promotional period, standard pricing applies. We will notify you 
                            at least 30 days before any charges begin.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">5. Data Ownership</h2>
                        <p className="text-slate-300 leading-relaxed">
                            You retain full ownership of all data you upload to Continuum. We do not 
                            claim any intellectual property rights over your data. You grant us a 
                            license to process your data solely to provide the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">6. Acceptable Use</h2>
                        <p className="text-slate-300 leading-relaxed">You agree not to:</p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2 mt-2">
                            <li>Use the Service for any illegal purpose</li>
                            <li>Violate any laws in your jurisdiction</li>
                            <li>Upload malicious code or attempt to compromise our systems</li>
                            <li>Resell or redistribute the Service without authorization</li>
                            <li>Use automated systems to scrape or extract data</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">7. Service Level</h2>
                        <p className="text-slate-300 leading-relaxed">
                            We target 99.9% uptime for paid plans. Free tier users may experience 
                            occasional maintenance windows. We provide no SLA for the free tier.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
                        <p className="text-slate-300 leading-relaxed">
                            To the maximum extent permitted by law, Continuum shall not be liable for 
                            any indirect, incidental, special, consequential, or punitive damages, or 
                            any loss of profits or revenues, whether incurred directly or indirectly.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
                        <p className="text-slate-300 leading-relaxed">
                            Either party may terminate this agreement at any time. Upon termination, 
                            you may export your data within 30 days. After that period, your data 
                            will be permanently deleted.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
                        <p className="text-slate-300 leading-relaxed">
                            We may update these terms from time to time. We will notify you of any 
                            material changes via email or through the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
                        <p className="text-slate-300 leading-relaxed">
                            Questions about these Terms? Contact us at:
                            <br />
                            <a href="mailto:legal@continuum.hr" className="text-purple-400 hover:underline">
                                legal@continuum.hr
                            </a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
