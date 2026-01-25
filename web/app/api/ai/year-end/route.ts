import { NextResponse } from "next/server";
import { optimizeYearEndLeave } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await optimizeYearEndLeave();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.optimization);
    } catch (error) {
        console.error("Year-end optimization API error:", error);
        return NextResponse.json(
            { error: "Failed to optimize year-end leave" },
            { status: 500 }
        );
    }
}
