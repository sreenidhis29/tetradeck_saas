import { NextResponse } from "next/server";
import { processAutoEscalations } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await processAutoEscalations();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.escalated);
    } catch (error) {
        console.error("Escalation API error:", error);
        return NextResponse.json(
            { error: "Failed to process escalations" },
            { status: 500 }
        );
    }
}
