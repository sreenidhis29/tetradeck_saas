import Sidebar from "@/components/Sidebar";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Server-side guard: Check auth and onboarding/approval status
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
            approval_status: true,
            terms_accepted_at: true,
            company: {
                select: { id: true, name: true }
            }
        }
    });

    // No employee record - redirect to onboarding
    if (!employee) {
        return redirect("/onboarding?intent=employee");
    }

    // If HR/Admin, redirect to HR dashboard
    if (employee.role === "hr" || employee.role === "admin") {
        return redirect("/hr/dashboard");
    }

    // Check if pending approval - redirect to pending page
    if (employee.onboarding_status === "pending_approval" || 
        employee.approval_status === "pending") {
        return redirect("/employee/pending");
    }

    // Check if rejected
    if (employee.approval_status === "rejected") {
        return redirect("/employee/rejected");
    }

    // Check if onboarding is complete (for employees, need HR approval)
    // Note: HR sets onboarding_status to "approved" when approving employees
    const isOnboardingComplete = 
        (employee.onboarding_status === "completed" || employee.onboarding_status === "approved") &&
        employee.onboarding_completed === true &&
        employee.approval_status === "approved" &&
        employee.org_id !== null &&
        employee.company !== null;

    if (!isOnboardingComplete) {
        // If not approved yet but terms accepted and has org, they're pending
        if (employee.terms_accepted_at && employee.org_id) {
            return redirect("/employee/pending");
        }
        // Otherwise redirect to onboarding to complete the flow
        return redirect("/onboarding?intent=employee");
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
