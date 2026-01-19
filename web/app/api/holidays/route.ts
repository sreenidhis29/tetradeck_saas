import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Nager.Date API Base URL
const NAGER_API_BASE = "https://date.nager.at/api/v3";

interface NagerHoliday {
    date: string;
    localName: string;
    name: string;
    countryCode: string;
    fixed: boolean;
    global: boolean;
    counties: string[] | null;
    launchYear: number | null;
    types: string[];
}

interface CachedHoliday {
    id: string;
    date: Date;
    name: string;
    local_name: string | null;
    country_code: string;
    year: number;
    is_global: boolean;
    types: any;
}

// Fetch and cache holidays from Nager.Date API
async function fetchAndCacheHolidays(year: number, countryCode: string = "IN"): Promise<CachedHoliday[]> {
    try {
        // Check if we already have cached holidays for this year
        const cachedCount = await (prisma as any).publicHoliday?.count?.({
            where: {
                year,
                country_code: countryCode
            }
        }).catch(() => 0);

        // If holidays are already cached, return them from DB
        if (cachedCount > 0) {
            const cached = await (prisma as any).publicHoliday.findMany({
                where: {
                    year,
                    country_code: countryCode
                },
                orderBy: { date: 'asc' }
            });
            return cached;
        }

        // Fetch from Nager.Date API
        const response = await fetch(`${NAGER_API_BASE}/PublicHolidays/${year}/${countryCode}`);
        
        if (!response.ok) {
            throw new Error(`Nager.Date API returned ${response.status}`);
        }

        const holidays: NagerHoliday[] = await response.json();

        // Try to cache the holidays in database (if table exists)
        try {
            const cachedHolidays = await Promise.all(
                holidays.map(async (holiday) => {
                    return (prisma as any).publicHoliday.upsert({
                        where: {
                            date_country_code: {
                                date: new Date(holiday.date),
                                country_code: countryCode
                            }
                        },
                        update: {
                            name: holiday.name,
                            local_name: holiday.localName,
                            is_global: holiday.global,
                            types: holiday.types
                        },
                        create: {
                            date: new Date(holiday.date),
                            name: holiday.name,
                            local_name: holiday.localName,
                            country_code: countryCode,
                            year,
                            is_global: holiday.global,
                            types: holiday.types
                        }
                    });
                })
            );
            return cachedHolidays;
        } catch (dbError) {
            console.warn("Could not cache holidays in DB:", dbError);
            // Return directly from API response if caching fails
            return holidays.map((h, idx) => ({
                id: `temp-${idx}`,
                date: new Date(h.date),
                name: h.name,
                local_name: h.localName,
                country_code: countryCode,
                year,
                is_global: h.global,
                types: h.types
            }));
        }
    } catch (error) {
        console.error("Error fetching holidays:", error);
        throw error;
    }
}

// Check if a specific date is a public holiday
async function isPublicHoliday(date: string, countryCode: string = "IN"): Promise<{ isHoliday: boolean; holiday?: any }> {
    try {
        // First check our cache
        try {
            const cachedHoliday = await (prisma as any).publicHoliday?.findFirst?.({
                where: {
                    date: new Date(date),
                    country_code: countryCode
                }
            });

            if (cachedHoliday) {
                return { isHoliday: true, holiday: cachedHoliday };
            }
        } catch (dbError) {
            console.warn("DB check failed, falling back to API:", dbError);
        }

        // If not in cache, check Nager.Date API directly
        const response = await fetch(
            `${NAGER_API_BASE}/IsPublicHoliday/${countryCode}/${date}`
        );

        // The API returns 200 if it's a holiday, 204 if not
        if (response.status === 200) {
            // Get holiday details
            const year = new Date(date).getFullYear();
            const allHolidays = await fetch(`${NAGER_API_BASE}/PublicHolidays/${year}/${countryCode}`);
            const holidaysData: NagerHoliday[] = await allHolidays.json();
            const holiday = holidaysData.find(h => h.date === date);
            return { isHoliday: true, holiday };
        }
        return { isHoliday: false };
    } catch (error) {
        console.error("Error checking holiday:", error);
        return { isHoliday: false };
    }
}

// GET - Fetch holidays for a year
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const countryCode = searchParams.get('country') || "IN";
        const checkDate = searchParams.get('date'); // Optional: check if specific date is holiday
        const upcoming = searchParams.get('upcoming') === 'true';

        // If checking a specific date
        if (checkDate) {
            const result = await isPublicHoliday(checkDate, countryCode);
            return NextResponse.json({
                success: true,
                isHoliday: result.isHoliday,
                holiday: result.holiday || { date: checkDate, name: "Public Holiday" }
            });
        }

        // If fetching upcoming holidays
        if (upcoming) {
            const response = await fetch(`${NAGER_API_BASE}/NextPublicHolidays/${countryCode}`);
            if (!response.ok) {
                throw new Error(`Nager.Date API error: ${response.status}`);
            }
            const upcomingHolidays = await response.json();
            return NextResponse.json({
                success: true,
                holidays: upcomingHolidays
            });
        }

        // Fetch all holidays for the year
        const holidays = await fetchAndCacheHolidays(year, countryCode);

        return NextResponse.json({
            success: true,
            year,
            countryCode,
            total: holidays.length,
            holidays: holidays.map((h: CachedHoliday) => ({
                id: h.id,
                date: h.date,
                name: h.name,
                localName: h.local_name,
                isGlobal: h.is_global
            }))
        });

    } catch (error) {
        console.error("[API] Holidays Error:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : "Failed to fetch holidays" 
            }, 
            { status: 500 }
        );
    }
}
