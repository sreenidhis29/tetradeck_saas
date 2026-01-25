import Sidebar from "@/components/Sidebar";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Server-side guard: Check auth and onboarding status
    const user = await currentUser();
    if (!user) {
        return redirect("/sign-in");
    }

    // Check employee exists and has completed onboarding
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        select: {
            org_id: true,
            role: true,
            onboarding_status: true,
            onboarding_completed: true,
            terms_accepted_at: true,
            approval_status: true,
            company: {
                select: { id: true, name: true }
            }
        }
    });

    // No employee record - redirect to onboarding
    if (!employee) {
        return redirect("/onboarding?intent=hr");
    }

    // FIRST: Check if user has HR role - redirect non-HR users BEFORE other checks
    if (employee.role !== "hr" && employee.role !== "admin") {
        // Not an HR user - redirect to employee dashboard (will be handled there)
        return redirect("/employee/dashboard");
    }

    // CRITICAL: HR MUST have registered a company (org_id)
    // This catches HR users who signed up but never completed company registration
    if (!employee.org_id || !employee.company) {
        return redirect("/onboarding?intent=hr");
    }

    // Check if onboarding is complete - allow for both statuses
    // Either onboarding_completed=true OR onboarding_status='completed' should work
    const isOnboardingComplete = 
        employee.onboarding_completed === true ||
        employee.onboarding_status === "completed";

    if (!isOnboardingComplete) {
        // Redirect to onboarding to complete the flow
        return redirect("/onboarding?intent=hr");
    }

    return (
        <div className="flex min-h-screen bg-[#0f172a]">
            <Sidebar />
            <main className="flex-1 ml-[280px] p-8 relative z-10">
                {/* Background Glow Effects */}
                <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]"></div>
                    <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-pink-500/10 rounded-full blur-[100px]"></div>
                </div>
                <div className="relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
