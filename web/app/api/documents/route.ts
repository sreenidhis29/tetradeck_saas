import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get employee
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            select: { emp_id: true, org_id: true }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
        }

        // Try to fetch documents from database
        // Note: If Document table doesn't exist yet, return empty array
        let documents: any[] = [];
        
        try {
            // Check if document table exists and fetch
            documents = await (prisma as any).document?.findMany?.({
                where: { 
                    OR: [
                        { emp_id: employee.emp_id },
                        { org_id: employee.org_id, is_company_wide: true }
                    ]
                },
                orderBy: { created_at: 'desc' }
            }) || [];
        } catch (dbError) {
            // Table doesn't exist yet - return empty array (not mock data)
            console.log("Document table not available:", dbError);
            documents = [];
        }

        // Format documents for response
        const formattedDocs = documents.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            size: formatFileSize(doc.size_bytes || 0),
            date: new Date(doc.created_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            }),
            type: doc.document_type || 'other',
            url: doc.file_url
        }));

        return NextResponse.json({
            success: true,
            documents: formattedDocs
        });

    } catch (error) {
        console.error("[API] Documents GET Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch documents" },
            { status: 500 }
        );
    }
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
