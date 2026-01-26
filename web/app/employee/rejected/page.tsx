import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RejectedPageClient } from "./rejected-client";

export default async function EmployeeRejectedPage() {
    const user = await currentUser();
    if (!user) return redirect("/employee/sign-in");

    // Get employee data
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        select: {
            approval_status: true,
            rejection_reason: true,
            welcome_shown: true,
            full_name: true,
        }
    });

    if (!employee) {
        return redirect("/onboarding?intent=employee");
    }

    // If not rejected, redirect appropriately
    if (employee.approval_status === "approved") {
        if (!employee.welcome_shown) {
            return redirect("/employee/welcome");
        }
        return redirect("/employee/dashboard");
    }

    if (employee.approval_status === "pending") {
        return redirect("/employee/pending");
    }

    // If approval_status is null or anything else except rejected, go to onboarding
    if (employee.approval_status !== "rejected") {
        return redirect("/onboarding?intent=employee");
    }

    return (
        <RejectedPageClient 
            rejectionReason={employee.rejection_reason || undefined}
            employeeName={employee.full_name || "there"}
        />
    );
}
