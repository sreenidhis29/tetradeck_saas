import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncUser } from "@/app/actions/onboarding";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage(props: { searchParams: Promise<{ intent?: string }> }) {
    const searchParams = await props.searchParams;
    const user = await currentUser();
    if (!user) return redirect("/sign-in");

    // Attempt sync (idempotent)
    const syncRes = await syncUser();

    if (!syncRes?.success || !syncRes.employee) {
        // In production, redirection to an error page or refresh hint is better
        return <div className="text-white p-10">Error loading profile. Please refresh or contact support.</div>;
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
