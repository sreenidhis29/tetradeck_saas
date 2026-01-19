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

    // If fully onboarded, redirect away
    if (employee.terms_accepted_at && employee.org_id) {
        if (employee.position?.includes("HR") || employee.position?.includes("Admin")) {
            return redirect("/hr/dashboard");
        }
        return redirect("/employee/dashboard");
    }

    // Pass necessary props if needed
    return <OnboardingFlow user={JSON.parse(JSON.stringify(employee))} intent={searchParams.intent || 'employee'} />;
}
