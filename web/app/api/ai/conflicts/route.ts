import { NextResponse } from "next/server";
import { resolveLeaveConflicts } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await resolveLeaveConflicts();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.conflicts);
    } catch (error) {
        console.error("Conflicts API error:", error);
        return NextResponse.json(
            { error: "Failed to resolve conflicts" },
            { status: 500 }
        );
    }
}
