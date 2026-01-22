import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PendingApprovalStatus } from "@/components/onboarding/pending-approval";

export default async function EmployeePendingPage() {
    const user = await currentUser();
    if (!user) return redirect("/employee/sign-in");

    // Get employee data
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        include: { company: true }
    });

    if (!employee) {
        return redirect("/onboarding?intent=employee");
    }

    // If already approved, redirect to welcome or dashboard
    if ((employee as any).approval_status === "approved") {
        if (!(employee as any).welcome_shown) {
            return redirect("/employee/welcome");
        }
        return redirect("/employee/dashboard");
    }

    // If rejected, show different UI
    if ((employee as any).approval_status === "rejected") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
                <div className="max-w-md w-full bg-white/5 border border-red-500/20 rounded-2xl p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Registration Declined</h1>
                    <p className="text-slate-400 mb-4">
                        Your registration request was not approved.
                    </p>
                    {(employee as any).rejection_reason && (
                        <div className="p-4 bg-red-500/10 rounded-xl text-left mb-6">
                            <p className="text-sm text-slate-400 mb-1">Reason:</p>
                            <p className="text-red-300">{(employee as any).rejection_reason}</p>
                        </div>
                    )}
                    <p className="text-sm text-slate-500">
                        Please contact your HR department for more information.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <PendingApprovalStatus 
            employeeName={employee.full_name}
            companyName={employee.company?.name}
        />
    );
}
