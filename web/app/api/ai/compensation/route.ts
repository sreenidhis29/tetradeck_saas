import { NextResponse } from "next/server";
import { calculateCompensation } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await calculateCompensation();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.compensation);
    } catch (error) {
        console.error("Compensation API error:", error);
        return NextResponse.json(
            { error: "Failed to calculate compensation" },
            { status: 500 }
        );
    }
}
