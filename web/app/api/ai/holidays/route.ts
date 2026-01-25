import { NextResponse } from "next/server";
import { optimizeHolidays } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await optimizeHolidays();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.optimizations);
    } catch (error) {
        console.error("Holiday optimizer API error:", error);
        return NextResponse.json(
            { error: "Failed to optimize holidays" },
            { status: 500 }
        );
    }
}
