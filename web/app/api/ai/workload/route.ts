import { NextResponse } from "next/server";
import { analyzeWorkloadBalance } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await analyzeWorkloadBalance();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.departments);
    } catch (error) {
        console.error("Workload API error:", error);
        return NextResponse.json(
            { error: "Failed to analyze workload" },
            { status: 500 }
        );
    }
}
