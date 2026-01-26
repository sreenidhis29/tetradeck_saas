import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PendingApprovalStatus } from "@/components/onboarding/pending-approval";

export default async function EmployeePendingPage() {
    const user = await currentUser();
    if (!user) return redirect("/sign-in");

    // Get employee data
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        include: { company: true }
    });

    if (!employee) {
        return redirect("/onboarding?intent=employee");
    }

    // CRITICAL: If no org_id, they haven't joined a company yet - redirect to onboarding
    if (!employee.org_id || !employee.company) {
        return redirect("/onboarding?intent=employee");
    }

    // If already approved, redirect to welcome or dashboard
    if ((employee as any).approval_status === "approved") {
        if (!(employee as any).welcome_shown) {
            return redirect("/employee/welcome");
        }
        return redirect("/employee/dashboard");
    }

    // If rejected, redirect to the dedicated rejected page
    if ((employee as any).approval_status === "rejected") {
        return redirect("/employee/rejected");
    }

    return (
        <PendingApprovalStatus 
            employeeName={employee.full_name}
            companyName={employee.company?.name}
        />
    );
}
