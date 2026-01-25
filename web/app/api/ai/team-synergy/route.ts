import { NextResponse } from "next/server";
import { analyzeTeamSynergy } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await analyzeTeamSynergy();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            synergies: result.synergies,
            insights: result.insights
        });
    } catch (error) {
        console.error("Team synergy API error:", error);
        return NextResponse.json(
            { error: "Failed to analyze team synergy" },
            { status: 500 }
        );
    }
}
