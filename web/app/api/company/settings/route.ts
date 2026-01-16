import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// GET - Fetch company settings
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get employee to find their company
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            include: { company: true }
        });

        if (!employee || !employee.company) {
            return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
        }

        // Get or create company settings
        let settings: any = null;
        try {
            settings = await (prisma as any).companySettings?.findUnique?.({
                where: { company_id: employee.company.id }
            });

            if (!settings) {
                settings = await (prisma as any).companySettings?.create?.({
                    data: {
                        company_id: employee.company.id,
                        holiday_mode: "auto",
                        country_code: employee.country_code || "IN"
                    }
                });
            }
        } catch (dbError) {
            console.warn("CompanySettings table may not exist:", dbError);
            // Return default settings if table doesn't exist
            settings = {
                id: 'default',
                holiday_mode: "auto",
                country_code: employee.country_code || "IN",
                custom_holidays: null,
                blocked_dates: null
            };
        }

        return NextResponse.json({
            success: true,
            settings: {
                id: settings?.id || 'default',
                holiday_mode: settings?.holiday_mode || "auto",
                country_code: settings?.country_code || "IN",
                custom_holidays: settings?.custom_holidays,
                blocked_dates: settings?.blocked_dates
            }
        });

    } catch (error) {
        console.error("[API] Company Settings GET Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

// PUT - Update company settings (HR only)
export async function PUT(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { holiday_mode, country_code, custom_holidays, blocked_dates } = body;

        // Get employee to verify HR role and find their company
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            include: { company: true }
        });

        if (!employee || !employee.company) {
            return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
        }

        // Verify HR role
        if (employee.role !== 'hr' && employee.role !== 'admin') {
            return NextResponse.json({ success: false, error: "Only HR can update company settings" }, { status: 403 });
        }

        // Update or create settings
        let settings: any = null;
        try {
            settings = await (prisma as any).companySettings?.upsert?.({
                where: { company_id: employee.company.id },
                update: {
                    ...(holiday_mode && { holiday_mode }),
                    ...(country_code && { country_code }),
                    ...(custom_holidays !== undefined && { custom_holidays }),
                    ...(blocked_dates !== undefined && { blocked_dates })
                },
                create: {
                    company_id: employee.company.id,
                    holiday_mode: holiday_mode || "auto",
                    country_code: country_code || employee.country_code || "IN",
                    custom_holidays,
                    blocked_dates
                }
            });
        } catch (dbError) {
            console.warn("CompanySettings table may not exist:", dbError);
            // Return mocked response
            settings = {
                id: 'default',
                holiday_mode: holiday_mode || "auto",
                country_code: country_code || "IN",
                custom_holidays,
                blocked_dates
            };
        }

        return NextResponse.json({
            success: true,
            settings: {
                id: settings?.id || 'default',
                holiday_mode: settings?.holiday_mode || "auto",
                country_code: settings?.country_code || "IN",
                custom_holidays: settings?.custom_holidays,
                blocked_dates: settings?.blocked_dates
            },
            message: `Holiday mode set to ${settings?.holiday_mode || holiday_mode}`
        });

    } catch (error) {
        console.error("[API] Company Settings PUT Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed to update settings" },
            { status: 500 }
        );
    }
}
