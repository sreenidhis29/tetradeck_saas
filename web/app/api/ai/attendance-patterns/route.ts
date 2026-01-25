import { NextResponse } from "next/server";
import { analyzeAttendancePatterns } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await analyzeAttendancePatterns();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.patterns);
    } catch (error) {
        console.error("Attendance patterns API error:", error);
        return NextResponse.json(
            { error: "Failed to analyze patterns" },
            { status: 500 }
        );
    }
}
