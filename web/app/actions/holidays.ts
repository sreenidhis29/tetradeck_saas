"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// Types
interface Holiday {
    id: string;
    date: Date;
    name: string;
    local_name: string | null;
    country_code: string;
    is_global: boolean;
    is_custom: boolean;
}

interface BlockedDate {
    date: Date;
    reason: string;
}

// Verify HR access
async function verifyHRAccess() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        select: { emp_id: true, role: true, org_id: true }
    });
    
    if (!employee || (employee.role !== 'hr' && employee.role !== 'admin')) {
        return { success: false, error: "HR access required" };
    }
    
    return { success: true, employee };
}

// Get company holiday settings
export async function getHolidaySettings() {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    
    try {
        const settings = await prisma.companySettings.findUnique({
            where: { company_id: employee!.org_id || 'default' }
        });
        
        if (!settings) {
            // Create default settings
            const defaultSettings = await prisma.companySettings.create({
                data: {
                    company_id: employee!.org_id || 'default',
                    holiday_mode: 'auto',
                    country_code: 'IN',
                    custom_holidays: [],
                    blocked_dates: []
                }
            });
            
            return { success: true, settings: defaultSettings };
        }
        
        return { success: true, settings };
        
    } catch (error) {
        console.error("Get Holiday Settings Error:", error);
        return { success: false, error: "Failed to fetch holiday settings" };
    }
}

// Update holiday mode (auto/manual)
export async function updateHolidayMode(mode: 'auto' | 'manual') {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    
    try {
        const settings = await prisma.companySettings.upsert({
            where: { company_id: employee!.org_id || 'default' },
            create: {
                company_id: employee!.org_id || 'default',
                holiday_mode: mode,
                country_code: 'IN'
            },
            update: {
                holiday_mode: mode
            }
        });
        
        revalidatePath('/hr/holiday-settings');
        
        return {
            success: true,
            settings,
            message: `Holiday mode updated to ${mode.toUpperCase()}`
        };
        
    } catch (error) {
        console.error("Update Holiday Mode Error:", error);
        return { success: false, error: "Failed to update holiday mode" };
    }
}

// Update country for holiday fetching
export async function updateCountryCode(countryCode: string) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    
    // Validate country code (basic validation)
    if (!/^[A-Z]{2}$/.test(countryCode)) {
        return { success: false, error: "Invalid country code. Use 2-letter ISO code (e.g., IN, US, GB)" };
    }
    
    try {
        const settings = await prisma.companySettings.upsert({
            where: { company_id: employee!.org_id || 'default' },
            create: {
                company_id: employee!.org_id || 'default',
                country_code: countryCode,
                holiday_mode: 'auto'
            },
            update: {
                country_code: countryCode
            }
        });
        
        revalidatePath('/hr/holiday-settings');
        
        return {
            success: true,
            settings,
            message: `Country updated to ${countryCode}`
        };
        
    } catch (error) {
        console.error("Update Country Error:", error);
        return { success: false, error: "Failed to update country" };
    }
}

// Add custom holiday (manual mode)
export async function addCustomHoliday(data: {
    date: string; // ISO date string
    name: string;
    local_name?: string;
}) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    
    // Validate inputs
    if (!data.date || !data.name) {
        return { success: false, error: "Date and name are required" };
    }
    
    const holidayDate = new Date(data.date);
    if (isNaN(holidayDate.getTime())) {
        return { success: false, error: "Invalid date format" };
    }
    
    if (data.name.length < 2 || data.name.length > 100) {
        return { success: false, error: "Holiday name must be 2-100 characters" };
    }
    
    try {
        // Get current settings
        let settings = await prisma.companySettings.findUnique({
            where: { company_id: employee!.org_id || 'default' }
        });
        
        if (!settings) {
            settings = await prisma.companySettings.create({
                data: {
                    company_id: employee!.org_id || 'default',
                    holiday_mode: 'manual',
                    country_code: 'IN',
                    custom_holidays: []
                }
            });
        }
        
        // Add to custom holidays array
        const customHolidays = (settings.custom_holidays as any[]) || [];
        
        // Check for duplicate date
        const dateStr = holidayDate.toISOString().split('T')[0];
        if (customHolidays.some((h: any) => h.date === dateStr)) {
            return { success: false, error: "A holiday already exists on this date" };
        }
        
        customHolidays.push({
            id: `custom-${Date.now()}`,
            date: dateStr,
            name: data.name.trim(),
            local_name: data.local_name?.trim() || null,
            is_custom: true,
            created_at: new Date().toISOString()
        });
        
        // Update settings
        const updatedSettings = await prisma.companySettings.update({
            where: { company_id: employee!.org_id || 'default' },
            data: {
                custom_holidays: customHolidays
            }
        });
        
        revalidatePath('/hr/holiday-settings');
        
        return {
            success: true,
            message: `Holiday "${data.name}" added for ${dateStr}`,
            settings: updatedSettings
        };
        
    } catch (error) {
        console.error("Add Custom Holiday Error:", error);
        return { success: false, error: "Failed to add custom holiday" };
    }
}

// Delete custom holiday
export async function deleteCustomHoliday(holidayId: string) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    
    try {
        const settings = await prisma.companySettings.findUnique({
            where: { company_id: employee!.org_id || 'default' }
        });
        
        if (!settings) {
            return { success: false, error: "Settings not found" };
        }
        
        const customHolidays = (settings.custom_holidays as any[]) || [];
        const updatedHolidays = customHolidays.filter((h: any) => h.id !== holidayId);
        
        if (updatedHolidays.length === customHolidays.length) {
            return { success: false, error: "Holiday not found" };
        }
        
        await prisma.companySettings.update({
            where: { company_id: employee!.org_id || 'default' },
            data: {
                custom_holidays: updatedHolidays
            }
        });
        
        revalidatePath('/hr/holiday-settings');
        
        return {
            success: true,
            message: "Holiday deleted successfully"
        };
        
    } catch (error) {
        console.error("Delete Custom Holiday Error:", error);
        return { success: false, error: "Failed to delete holiday" };
    }
}

// Add blocked date (dates when leave cannot be requested)
export async function addBlockedDate(data: {
    date: string;
    reason: string;
}) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    
    // Validate inputs
    if (!data.date || !data.reason) {
        return { success: false, error: "Date and reason are required" };
    }
    
    const blockedDate = new Date(data.date);
    if (isNaN(blockedDate.getTime())) {
        return { success: false, error: "Invalid date format" };
    }
    
    if (blockedDate < new Date()) {
        return { success: false, error: "Cannot block a past date" };
    }
    
    try {
        let settings = await prisma.companySettings.findUnique({
            where: { company_id: employee!.org_id || 'default' }
        });
        
        if (!settings) {
            settings = await prisma.companySettings.create({
                data: {
                    company_id: employee!.org_id || 'default',
                    holiday_mode: 'auto',
                    country_code: 'IN',
                    blocked_dates: []
                }
            });
        }
        
        const blockedDates = (settings.blocked_dates as any[]) || [];
        const dateStr = blockedDate.toISOString().split('T')[0];
        
        // Check for duplicate
        if (blockedDates.some((b: any) => b.date === dateStr)) {
            return { success: false, error: "This date is already blocked" };
        }
        
        blockedDates.push({
            id: `blocked-${Date.now()}`,
            date: dateStr,
            reason: data.reason.trim(),
            created_at: new Date().toISOString()
        });
        
        await prisma.companySettings.update({
            where: { company_id: employee!.org_id || 'default' },
            data: {
                blocked_dates: blockedDates
            }
        });
        
        revalidatePath('/hr/holiday-settings');
        
        return {
            success: true,
            message: `Date ${dateStr} blocked: ${data.reason}`
        };
        
    } catch (error) {
        console.error("Add Blocked Date Error:", error);
        return { success: false, error: "Failed to block date" };
    }
}

// Remove blocked date
export async function removeBlockedDate(blockedId: string) {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    
    try {
        const settings = await prisma.companySettings.findUnique({
            where: { company_id: employee!.org_id || 'default' }
        });
        
        if (!settings) {
            return { success: false, error: "Settings not found" };
        }
        
        const blockedDates = (settings.blocked_dates as any[]) || [];
        const updated = blockedDates.filter((b: any) => b.id !== blockedId);
        
        await prisma.companySettings.update({
            where: { company_id: employee!.org_id || 'default' },
            data: {
                blocked_dates: updated
            }
        });
        
        revalidatePath('/hr/holiday-settings');
        
        return {
            success: true,
            message: "Blocked date removed"
        };
        
    } catch (error) {
        console.error("Remove Blocked Date Error:", error);
        return { success: false, error: "Failed to remove blocked date" };
    }
}

// Force refresh holidays from external API
export async function refreshHolidays(year: number, countryCode: string = 'IN') {
    const authResult = await verifyHRAccess();
    if (!authResult.success) return authResult;
    
    try {
        // Delete existing cached holidays for this year/country
        await prisma.publicHoliday.deleteMany({
            where: {
                year,
                country_code: countryCode
            }
        });
        
        // Fetch fresh data from Nager.Date API
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
        
        if (!response.ok) {
            return { success: false, error: `Failed to fetch holidays: API returned ${response.status}` };
        }
        
        const holidays = await response.json();
        
        // Cache in database
        const cached = await Promise.all(
            holidays.map(async (h: any) => {
                return prisma.publicHoliday.create({
                    data: {
                        date: new Date(h.date),
                        name: h.name,
                        local_name: h.localName,
                        country_code: countryCode,
                        year,
                        is_global: h.global,
                        types: h.types
                    }
                });
            })
        );
        
        revalidatePath('/hr/holiday-settings');
        
        return {
            success: true,
            message: `Refreshed ${cached.length} holidays for ${countryCode} ${year}`,
            count: cached.length
        };
        
    } catch (error) {
        console.error("Refresh Holidays Error:", error);
        return { success: false, error: "Failed to refresh holidays" };
    }
}

// Get all holidays (public + custom) for a year
export async function getAllHolidays(year: number) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    try {
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true }
        });
        
        if (!employee) {
            return { success: false, error: "Employee not found" };
        }
        
        // Get company settings
        const settings = await prisma.companySettings.findUnique({
            where: { company_id: employee.org_id || 'default' }
        });
        
        const countryCode = settings?.country_code || 'IN';
        
        // Get public holidays from cache
        const publicHolidays = await prisma.publicHoliday.findMany({
            where: {
                year,
                country_code: countryCode
            },
            orderBy: { date: 'asc' }
        });
        
        // Get custom holidays from settings
        const customHolidays = ((settings?.custom_holidays as any[]) || [])
            .filter((h: any) => {
                const hYear = new Date(h.date).getFullYear();
                return hYear === year;
            });
        
        // Get blocked dates
        const blockedDates = ((settings?.blocked_dates as any[]) || [])
            .filter((b: any) => {
                const bYear = new Date(b.date).getFullYear();
                return bYear === year;
            });
        
        // Combine and sort all holidays
        const allHolidays = [
            ...publicHolidays.map(h => ({
                id: h.id,
                date: h.date.toISOString().split('T')[0],
                name: h.name,
                local_name: h.local_name,
                is_global: h.is_global,
                is_custom: false,
                source: 'public'
            })),
            ...customHolidays.map((h: any) => ({
                id: h.id,
                date: h.date,
                name: h.name,
                local_name: h.local_name,
                is_global: false,
                is_custom: true,
                source: 'custom'
            }))
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return {
            success: true,
            holidays: allHolidays,
            blocked_dates: blockedDates,
            settings: {
                holiday_mode: settings?.holiday_mode || 'auto',
                country_code: countryCode
            }
        };
        
    } catch (error) {
        console.error("Get All Holidays Error:", error);
        return { success: false, error: "Failed to fetch holidays" };
    }
}

// Check if a date is a holiday or blocked
export async function checkDateStatus(date: string) {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    try {
        const checkDate = new Date(date);
        const year = checkDate.getFullYear();
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true }
        });
        
        if (!employee) {
            return { success: false, error: "Employee not found" };
        }
        
        // Get settings
        const settings = await prisma.companySettings.findUnique({
            where: { company_id: employee.org_id || 'default' }
        });
        
        // Check if it's a public holiday
        const publicHoliday = await prisma.publicHoliday.findFirst({
            where: {
                date: checkDate,
                country_code: settings?.country_code || 'IN'
            }
        });
        
        // Check if it's a custom holiday
        const customHolidays = (settings?.custom_holidays as any[]) || [];
        const customHoliday = customHolidays.find((h: any) => h.date === dateStr);
        
        // Check if it's blocked
        const blockedDates = (settings?.blocked_dates as any[]) || [];
        const blockedDate = blockedDates.find((b: any) => b.date === dateStr);
        
        // Check if it's a weekend
        const dayOfWeek = checkDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        return {
            success: true,
            date: dateStr,
            is_holiday: !!(publicHoliday || customHoliday),
            holiday_name: publicHoliday?.name || customHoliday?.name || null,
            is_blocked: !!blockedDate,
            block_reason: blockedDate?.reason || null,
            is_weekend: isWeekend,
            can_request_leave: !blockedDate && (settings?.holiday_mode !== 'auto' || !publicHoliday)
        };
        
    } catch (error) {
        console.error("Check Date Status Error:", error);
        return { success: false, error: "Failed to check date status" };
    }
}
