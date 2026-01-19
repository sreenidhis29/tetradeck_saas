"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
    const router = useRouter();

    useEffect(() => {
        // Default redirect to employee sign-up
        router.replace('/employee/sign-up');
    }, [router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
            <div className="text-white text-lg">Redirecting to sign up...</div>
        </div>
    );
}
