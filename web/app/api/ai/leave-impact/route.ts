import { NextRequest, NextResponse } from "next/server";
import { simulateLeaveImpact } from "@/app/actions/advanced-ai-features";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { startDate, endDate, days } = body;

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "Start date and end date are required" },
                { status: 400 }
            );
        }

        const result = await simulateLeaveImpact(startDate, endDate, days || 1);
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.impact);
    } catch (error) {
        console.error("Leave impact API error:", error);
        return NextResponse.json(
            { error: "Failed to simulate impact" },
            { status: 500 }
        );
    }
}
