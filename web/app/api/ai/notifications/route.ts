import { NextResponse } from "next/server";
import { getSmartNotifications } from "@/app/actions/advanced-ai-features";

export async function GET() {
    try {
        const result = await getSmartNotifications();
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.notifications);
    } catch (error) {
        console.error("Notifications API error:", error);
        return NextResponse.json(
            { error: "Failed to get notifications" },
            { status: 500 }
        );
    }
}
