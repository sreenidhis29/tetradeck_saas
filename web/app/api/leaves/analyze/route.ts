import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Helper function to format date as YYYY-MM-DD without timezone conversion
function formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to get max days in a month
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

// Helper function to get suggested valid dates for invalid date
function getSuggestedDates(year: number, month: number, invalidDay: number): string[] {
    const maxDay = getDaysInMonth(year, month);
    const suggestions: string[] = [];
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    // Suggest the last valid day of the month
    suggestions.push(`${monthNames[month]} ${maxDay}, ${year}`);
    
    // Suggest the first day of next month
    const nextMonth = (month + 1) % 12;
    const nextYear = month === 11 ? year + 1 : year;
    suggestions.push(`${monthNames[nextMonth]} 1, ${nextYear}`);
    
    return suggestions;
}

// Simple NLP parser for leave requests
function parseLeaveRequest(text: string): {
    leaveType: string;
    startDate: string | null;
    endDate: string | null;
    duration: number;
    invalidDate?: { requested: string; reason: string; suggestions: string[] };
} {
    const lowerText = text.toLowerCase();
    
    // Detect leave type
    let leaveType = "casual"; // default
    if (lowerText.includes("sick")) leaveType = "sick";
    else if (lowerText.includes("emergency") || lowerText.includes("urgent")) leaveType = "emergency";
    else if (lowerText.includes("vacation") || lowerText.includes("annual")) leaveType = "vacation";
    else if (lowerText.includes("casual")) leaveType = "casual";
    else if (lowerText.includes("personal") || lowerText.includes("private")) leaveType = "personal";
    else if (lowerText.includes("maternity")) leaveType = "maternity";
    else if (lowerText.includes("paternity")) leaveType = "paternity";
    else if (lowerText.includes("bereavement")) leaveType = "bereavement";
    else if (lowerText.includes("comp off") || lowerText.includes("compensatory")) leaveType = "comp_off";
    
    // Parse dates - handle various formats
    const today = new Date();
    const currentYear = today.getFullYear();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let duration = 1;
    let invalidDate: { requested: string; reason: string; suggestions: string[] } | undefined;
    
    // Month names mapping
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const fullMonthNames = ["january", "february", "march", "april", "may", "june", 
                           "july", "august", "september", "october", "november", "december"];
    
    const monthPattern = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
    
    // Pattern 1: "jan 20-23rd", "january 20 to 23" (month first)
    const monthFirstRangePattern = new RegExp(
        `(${monthPattern})\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|to|through|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?`,
        'gi'
    );
    
    // Pattern 2: "20th to 22nd jan", "20-23 january" (day range first, then month)
    const dayRangeFirstPattern = new RegExp(
        `(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|to|through|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s*)?(${monthPattern})`,
        'gi'
    );
    
    // Try both patterns
    const monthFirstMatch = monthFirstRangePattern.exec(lowerText);
    const dayRangeFirstMatch = dayRangeFirstPattern.exec(lowerText);
    
    let matchedMonthStr: string = "";
    let startDay: number = 0;
    let endDay: number = 0;
    let rangeMatchFound = false;
    
    if (monthFirstMatch) {
        // "jan 20-23" format
        matchedMonthStr = monthFirstMatch[1].toLowerCase();
        startDay = parseInt(monthFirstMatch[2]);
        endDay = parseInt(monthFirstMatch[3]);
        rangeMatchFound = true;
    } else if (dayRangeFirstMatch) {
        // "20th to 22nd jan" format
        startDay = parseInt(dayRangeFirstMatch[1]);
        endDay = parseInt(dayRangeFirstMatch[2]);
        matchedMonthStr = dayRangeFirstMatch[3].toLowerCase();
        rangeMatchFound = true;
    }
    
    if (rangeMatchFound && matchedMonthStr) {
        
        // Resolve month index
        let monthIndex = monthNames.findIndex(m => matchedMonthStr.startsWith(m));
        if (monthIndex === -1) {
            monthIndex = fullMonthNames.findIndex(m => matchedMonthStr.startsWith(m.substring(0, 3)));
        }
        
        if (monthIndex >= 0) {
            // Determine year
            let year = currentYear;
            const todayMonth = today.getMonth();
            const todayDay = today.getDate();
            
            if (monthIndex < todayMonth || (monthIndex === todayMonth && startDay < todayDay)) {
                year = currentYear + 1;
            }
            
            // Validate dates
            const maxDaysInMonth = getDaysInMonth(year, monthIndex);
            
            if (startDay > maxDaysInMonth || endDay > maxDaysInMonth) {
                const monthDisplayName = fullMonthNames[monthIndex].charAt(0).toUpperCase() + fullMonthNames[monthIndex].slice(1);
                invalidDate = {
                    requested: `${monthDisplayName} ${startDay}-${endDay}`,
                    reason: `${monthDisplayName} only has ${maxDaysInMonth} days in ${year}`,
                    suggestions: getSuggestedDates(year, monthIndex, Math.max(startDay, endDay))
                };
            } else {
                startDate = new Date(year, monthIndex, startDay);
                endDate = new Date(year, monthIndex, endDay);
                duration = endDay - startDay + 1;
            }
        }
    } else {
        // Try single date patterns
        // Pattern: "month day" (e.g., "feb 1st", "january 20th")
        const monthFirstPattern = new RegExp(`(${monthPattern})\\s*(\\d{1,2})(?:st|nd|rd|th)?`, 'gi');
        // Pattern: "day month" (e.g., "1st feb", "20 january")
        const dayFirstPattern = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})`, 'gi');
        
        let day: number | null = null;
        let monthIndex: number = -1;
        let matchedMonthStr: string = "";
        
        // Try month-first pattern first (more common)
        const monthFirstMatches = Array.from(lowerText.matchAll(monthFirstPattern));
        if (monthFirstMatches.length > 0) {
            const match = monthFirstMatches[0];
            matchedMonthStr = match[1].toLowerCase();
            day = parseInt(match[2]);
        } else {
            // Try day-first pattern
            const dayFirstMatches = Array.from(lowerText.matchAll(dayFirstPattern));
            if (dayFirstMatches.length > 0) {
                const match = dayFirstMatches[0];
                day = parseInt(match[1]);
                matchedMonthStr = match[2].toLowerCase();
            }
        }
        
        // Resolve month index
        if (matchedMonthStr) {
            monthIndex = monthNames.findIndex(m => matchedMonthStr.startsWith(m));
            if (monthIndex === -1) {
                monthIndex = fullMonthNames.findIndex(m => matchedMonthStr.startsWith(m.substring(0, 3)));
            }
        }
        
        if (day !== null && monthIndex >= 0) {
            // Determine the year - if month is in the past, use next year
            let year = currentYear;
            const todayMonth = today.getMonth();
            const todayDay = today.getDate();
            
            if (monthIndex < todayMonth || (monthIndex === todayMonth && day < todayDay)) {
                year = currentYear + 1;
            }
            
            // Validate if the date actually exists
            const maxDaysInMonth = getDaysInMonth(year, monthIndex);
            
            if (day > maxDaysInMonth) {
                const monthDisplayName = fullMonthNames[monthIndex].charAt(0).toUpperCase() + 
                                         fullMonthNames[monthIndex].slice(1);
                invalidDate = {
                    requested: `${monthDisplayName} ${day}`,
                    reason: `${monthDisplayName} only has ${maxDaysInMonth} days in ${year}`,
                    suggestions: getSuggestedDates(year, monthIndex, day)
                };
            } else {
                startDate = new Date(year, monthIndex, day);
                
                // Double-check the date was created correctly
                if (startDate.getDate() !== day || startDate.getMonth() !== monthIndex) {
                    const monthDisplayName = fullMonthNames[monthIndex].charAt(0).toUpperCase() + 
                                             fullMonthNames[monthIndex].slice(1);
                    invalidDate = {
                        requested: `${monthDisplayName} ${day}`,
                        reason: `Invalid date: ${monthDisplayName} ${day} does not exist`,
                        suggestions: getSuggestedDates(year, monthIndex, day)
                    };
                    startDate = null;
                }
            }
        }
    }
    
    // Check for "tomorrow" (overrides other dates if present)
    if (lowerText.includes("tomorrow") && !invalidDate) {
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() + 1);
    }
    
    // Check for "today"
    if (lowerText.includes("today") && !invalidDate) {
        startDate = new Date(today);
    }
    
    // Check for duration
    const durationMatch = lowerText.match(/(\d+)\s*days?/);
    if (durationMatch) {
        duration = parseInt(durationMatch[1]);
    }
    
    // Set end date based on duration
    if (startDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration - 1);
    }
    
    return {
        leaveType,
        startDate: startDate ? formatDateLocal(startDate) : null,
        endDate: endDate ? formatDateLocal(endDate) : null,
        duration,
        ...(invalidDate && { invalidDate })
    };
}

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { request: text } = body;

        if (!text) {
            return NextResponse.json({ success: false, error: "Request text is required" }, { status: 400 });
        }

        // Parse the natural language request
        const parsed = parseLeaveRequest(text);
        console.log("[API] Parsed leave request:", parsed);

        // Get employee from database
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: userId },
            include: {
                company: true,
                leave_balances: {
                    where: { year: new Date().getFullYear() }
                }
            }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee profile not found. Please complete onboarding." }, { status: 404 });
        }

        // Calculate remaining leave balance for the requested type
        const balanceMap: Record<string, number> = {};
        employee.leave_balances.forEach(bal => {
            const total = Number(bal.annual_entitlement) + Number(bal.carried_forward);
            const used = Number(bal.used_days) + Number(bal.pending_days);
            const typeKey = bal.leave_type.toLowerCase().replace(/\s+/g, "_");
            balanceMap[typeKey] = total - used;
        });
        
        const leaveTypeKey = parsed.leaveType.toLowerCase().replace(/\s+/g, "_");
        const remainingLeave = balanceMap[leaveTypeKey] || balanceMap['casual_leave'] || 20;

        // Check if there's an invalid date
        if (parsed.invalidDate) {
            return NextResponse.json({
                success: true,
                data: {
                    invalidDate: true,
                    error: parsed.invalidDate.reason,
                    requested_date: parsed.invalidDate.requested,
                    suggestions: parsed.invalidDate.suggestions,
                    parsed: parsed,
                    employee: {
                        emp_id: employee.emp_id,
                        name: employee.full_name,
                        department: employee.department
                    }
                }
            });
        }

        // Check holiday mode and validate against public holidays
        let holidayWarning = null;
        let holidayBlocker = null;
        
        if (parsed.startDate) {
            try {
                // Get company settings for holiday mode
                let companySettings: any = null;
                try {
                    companySettings = await (prisma as any).companySettings?.findFirst?.({
                        where: { company_id: employee.company?.id }
                    });
                } catch (dbError) {
                    console.warn("CompanySettings lookup failed:", dbError);
                }
                
                const holidayMode = companySettings?.holiday_mode || "auto";
                
                // Check if the requested date(s) fall on a public holiday
                const holidayRes = await fetch(
                    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/holidays?date=${parsed.startDate}&country=${employee.country_code || 'IN'}`
                );
                const holidayData = await holidayRes.json();
                
                if (holidayData.success && holidayData.isHoliday) {
                    if (holidayMode === "auto") {
                        // In auto mode, block leave requests on holidays
                        return NextResponse.json({
                            success: true,
                            data: {
                                holidayConflict: true,
                                error: `Cannot request leave on ${holidayData.holiday?.name || 'a public holiday'}`,
                                holiday: holidayData.holiday,
                                message: `${parsed.startDate} is ${holidayData.holiday?.name}. In AUTO holiday mode, leave cannot be requested on public holidays as they are already off days.`,
                                parsed: parsed,
                                employee: {
                                    emp_id: employee.emp_id,
                                    name: employee.full_name,
                                    department: employee.department
                                }
                            }
                        });
                    } else {
                        // In manual mode, add a warning but allow the request
                        holidayWarning = {
                            type: 'holiday_notice',
                            message: `${parsed.startDate} is ${holidayData.holiday?.name}. You can work on this day or take leave.`,
                            holiday: holidayData.holiday
                        };
                    }
                }
            } catch (error) {
                console.error("[API] Holiday check error:", error);
                // Continue without holiday check if it fails
            }
        }

        // Get REAL team stats for the employee's department
        const department = employee.department || 'General';
        
        let teamCount = 1;
        let onLeaveCount = 0;
        
        try {
            // Count team members in same department
            teamCount = await prisma.employee.count({
                where: {
                    org_id: employee.org_id,
                    department: department
                }
            });
            
            // Count who's on leave during the requested period
            if (parsed.startDate && parsed.endDate) {
                onLeaveCount = await prisma.leaveRequest.count({
                    where: {
                        status: 'approved',
                        employee: {
                            org_id: employee.org_id,
                            department: department
                        },
                        start_date: { lte: new Date(parsed.endDate) },
                        end_date: { gte: new Date(parsed.startDate) }
                    }
                });
            }
        } catch (teamErr) {
            console.warn("[API] Team stats lookup failed:", teamErr);
        }

        // Build request for AI engine - it expects leave_type at root level
        const aiRequest: any = {
            employee_id: employee.emp_id,
            emp_id: employee.emp_id,
            country_code: employee.country_code || "IN",
            leave_type: parsed.leaveType,
            total_days: parsed.duration,
            working_days: parsed.duration,
            is_half_day: false,
            reason: text,
            text: text,
            team_state: {
                team: {
                    teamSize: teamCount || 1,
                    alreadyOnLeave: onLeaveCount,
                    min_coverage: 3,
                    max_concurrent_leave: 5
                },
                blackoutDates: []
            },
            leave_balance: {
                remaining: remainingLeave
            },
            holiday_warning: holidayWarning
        };

        // Add dates if parsed successfully
        if (parsed.startDate && parsed.endDate) {
            aiRequest.start_date = parsed.startDate;
            aiRequest.end_date = parsed.endDate;
        }

        console.log("[API] Sending to AI:", JSON.stringify(aiRequest, null, 2));

        // Call the AI constraint engine
        const aiResponse = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8001'}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(aiRequest),
        });

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error("[API] AI Engine error:", errorText);
            throw new Error(`AI Engine returned ${aiResponse.status}: ${errorText}`);
        }

        const data = await aiResponse.json();
        
        return NextResponse.json({ 
            success: true, 
            data: {
                ...data,
                parsed: parsed,
                holiday_warning: holidayWarning,
                employee: {
                    emp_id: employee.emp_id,
                    name: employee.full_name,
                    department: employee.department
                }
            }
        });
    } catch (error) {
        console.error("[API] Leave Analysis Error:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : "Failed to analyze leave request" 
            }, 
            { status: 500 }
        );
    }
}
