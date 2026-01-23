import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { syncUser } from "@/app/actions/onboarding";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { RefreshCw, AlertTriangle, Home } from "lucide-react";

// Error component with better UX
function OnboardingError({ error, canRetry = true }: { error?: string; canRetry?: boolean }) {
    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-10 h-10 text-amber-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Unable to Load Profile</h1>
                <p className="text-slate-400 mb-6">
                    {error || "We couldn't load your profile. This might be a temporary issue."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {canRetry && (
                        <a
                            href="/onboarding"
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                        </a>
                    )}
                    <a
                        href="/"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                    >
                        <Home className="w-4 h-4" />
                        Go Home
                    </a>
                </div>
                <p className="mt-8 text-sm text-slate-500">
                    If this persists, please{" "}
                    <a href="mailto:support@continuum.hr" className="text-cyan-400 hover:text-cyan-300">
                        contact support
                    </a>
                </p>
            </div>
        </div>
    );
}

export default async function OnboardingPage(props: { searchParams: Promise<{ intent?: string }> }) {
    const searchParams = await props.searchParams;
    const user = await currentUser();
    if (!user) return redirect("/sign-in");

    // Attempt sync (idempotent)
    const syncRes = await syncUser();

    if (!syncRes?.success || !syncRes.employee) {
        const errorMessage = syncRes?.error || "Failed to sync your identity. Please try again.";
        console.error("[Onboarding] Sync failed:", errorMessage);
        return <OnboardingError error={errorMessage} />;
    }

    const employee = syncRes.employee;

    // If employee is pending HR approval, redirect to pending page
    if ((employee as any).onboarding_status === "pending_approval") {
        return redirect("/employee/pending");
    }

    // If fully onboarded and approved, check for welcome/tutorial
    if (employee.terms_accepted_at && employee.org_id && (employee as any).approval_status === "approved") {
        // Check if we need to show welcome animation
        if (!(employee as any).welcome_shown) {
            if ((employee as any).role === "hr" || employee.position?.includes("HR") || employee.position?.includes("Admin")) {
                return redirect("/hr/welcome");
            }
            return redirect("/employee/welcome");
        }

        // Otherwise go to dashboard
        if ((employee as any).role === "hr" || employee.position?.includes("HR") || employee.position?.includes("Admin")) {
            return redirect("/hr/dashboard");
        }
        return redirect("/employee/dashboard");
    }

    // For HR who just registered, they're auto-approved
    if (employee.terms_accepted_at && employee.org_id && (employee as any).role === "hr") {
        if (!(employee as any).welcome_shown) {
            return redirect("/hr/welcome");
        }
        return redirect("/hr/dashboard");
    }

    // Pass necessary props for onboarding flow
    return (
        <OnboardingFlow 
            user={JSON.parse(JSON.stringify(employee))} 
            intent={searchParams.intent || 'employee'}
            savedData={(syncRes as any).onboardingData || null}
        />
    );
}
