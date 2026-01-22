"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { WelcomeAnimation } from "@/components/onboarding/welcome-animation";
import { TutorialGuide } from "@/components/onboarding/tutorial-guide";
import { checkFeatureAccess } from "@/app/actions/onboarding";

export default function HRWelcomePage() {
    const router = useRouter();
    const { user } = useUser();
    const [phase, setPhase] = useState<"welcome" | "tutorial" | "done">("welcome");
    const [accessData, setAccessData] = useState<any>(null);

    useEffect(() => {
        const check = async () => {
            const access = await checkFeatureAccess();
            setAccessData(access);
            
            // If welcome already shown, skip to tutorial
            if (!access.showWelcome && access.showTutorial) {
                setPhase("tutorial");
            } else if (!access.showWelcome && !access.showTutorial) {
                // Already completed everything
                router.push("/hr/dashboard");
            }
        };
        check();
    }, [router]);

    const handleWelcomeComplete = () => {
        if (accessData?.showTutorial) {
            setPhase("tutorial");
        } else {
            router.push("/hr/dashboard");
        }
    };

    const handleTutorialComplete = () => {
        router.push("/hr/dashboard");
    };

    const userName = user?.firstName || user?.fullName || "there";

    return (
        <>
            {phase === "welcome" && (
                <WelcomeAnimation 
                    userName={userName} 
                    onComplete={handleWelcomeComplete}
                />
            )}
            {phase === "tutorial" && (
                <TutorialGuide 
                    role="hr" 
                    onComplete={handleTutorialComplete}
                />
            )}
        </>
    );
}
