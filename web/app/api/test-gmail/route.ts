/**
 * Gmail API Test Endpoint
 * Tests real email functionality with leave request data
 * 
 * POST /api/test-gmail
 * Body: {
 *   testType: 'leave-submission' | 'leave-approval' | 'leave-rejection' | 'check-in-reminder' | 'check-out-reminder' | 'all'
 *   recipientEmail?: string (defaults to test email)
 *   cleanup?: boolean (remove test data after)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    sendEmail,
    sendCheckInReminderEmail,
    sendCheckOutReminderEmail,
    sendLeaveApprovalEmail,
    sendLeaveRejectionEmail,
    sendLeaveSubmissionEmail,
    EmailTemplates
} from '@/lib/email-service';

// Test configuration
const TEST_CONFIG = {
    defaultRecipient: 'kirancompany094@gmail.com', // Your test email
    testEmployeeId: 'TEST_GMAIL_001',
    testEmployeeName: 'Gmail Test Employee',
    testEmployeeEmail: 'continuum1105@gmail.com'
};

interface TestResult {
    test: string;
    success: boolean;
    details: Record<string, unknown>;
    error?: string;
    duration: number;
}

/**
 * Create test employee if doesn't exist
 */
async function ensureTestEmployee() {
    const existing = await prisma.employee.findUnique({
        where: { emp_id: TEST_CONFIG.testEmployeeId }
    });

    if (existing) {
        return existing;
    }

    return prisma.employee.create({
        data: {
            emp_id: TEST_CONFIG.testEmployeeId,
            full_name: TEST_CONFIG.testEmployeeName,
            email: TEST_CONFIG.testEmployeeEmail,
            department: 'Quality Assurance',
            position: 'API Tester',
            is_active: true,
            role: 'employee'
        }
    });
}

/**
 * Create test leave request
 */
async function createTestLeaveRequest(employeeId: string) {
    const requestId = `TEST_LEAVE_${Date.now()}`;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7); // 7 days from now
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2); // 3 day leave

    return prisma.leaveRequest.create({
        data: {
            request_id: requestId,
            emp_id: employeeId,
            country_code: 'IN',
            leave_type: 'ANNUAL',
            start_date: startDate,
            end_date: endDate,
            total_days: 3,
            working_days: 3,
            is_half_day: false,
            reason: '[GMAIL API TEST] Vacation leave for testing email integration',
            status: 'pending',
            ai_confidence: 0.95,
            ai_recommendation: 'approve',
            ai_analysis_json: {
                testMode: true,
                recommendation: 'approve',
                confidence: 0.95,
                factors: [
                    'Good historical attendance',
                    'No conflicting leaves',
                    'Adequate leave balance'
                ]
            }
        }
    });
}

/**
 * Create test attendance record
 */
async function createTestAttendance(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if attendance already exists for today
    const existing = await prisma.attendance.findUnique({
        where: {
            emp_id_date: {
                emp_id: employeeId,
                date: today
            }
        }
    });

    if (existing) {
        return existing;
    }

    const checkIn = new Date();
    checkIn.setHours(9, 0, 0, 0);

    return prisma.attendance.create({
        data: {
            emp_id: employeeId,
            date: today,
            check_in: checkIn,
            status: 'PRESENT'
        }
    });
}

/**
 * Test: Leave Submission Email
 */
async function testLeaveSubmissionEmail(recipientEmail: string): Promise<TestResult> {
    const start = Date.now();
    try {
        const employee = await ensureTestEmployee();
        const leaveRequest = await createTestLeaveRequest(employee.emp_id);

        const result = await sendLeaveSubmissionEmail(
            { email: recipientEmail, full_name: employee.full_name },
            {
                requestId: leaveRequest.request_id,
                leaveType: leaveRequest.leave_type,
                startDate: leaveRequest.start_date.toISOString().split('T')[0],
                endDate: leaveRequest.end_date.toISOString().split('T')[0],
                totalDays: Number(leaveRequest.total_days),
                reason: leaveRequest.reason
            }
        );

        return {
            test: 'leave-submission',
            success: result.success,
            details: {
                recipientEmail,
                leaveRequestId: leaveRequest.request_id,
                leaveType: leaveRequest.leave_type,
                dates: `${leaveRequest.start_date.toLocaleDateString()} - ${leaveRequest.end_date.toLocaleDateString()}`
            },
            error: result.error,
            duration: Date.now() - start
        };
    } catch (error) {
        return {
            test: 'leave-submission',
            success: false,
            details: {},
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - start
        };
    }
}

/**
 * Test: Leave Approval Email
 */
async function testLeaveApprovalEmail(recipientEmail: string): Promise<TestResult> {
    const start = Date.now();
    try {
        const employee = await ensureTestEmployee();

        const result = await sendLeaveApprovalEmail(
            { email: recipientEmail, full_name: employee.full_name },
            {
                leaveType: 'ANNUAL',
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                totalDays: 3,
                approvedBy: 'HR Manager (John Smith)',
                reason: '[GMAIL API TEST] Approved vacation leave'
            }
        );

        return {
            test: 'leave-approval',
            success: result.success,
            details: {
                recipientEmail,
                approvedBy: 'HR Manager (John Smith)',
                leaveType: 'ANNUAL',
                totalDays: 3
            },
            error: result.error,
            duration: Date.now() - start
        };
    } catch (error) {
        return {
            test: 'leave-approval',
            success: false,
            details: {},
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - start
        };
    }
}

/**
 * Test: Leave Rejection Email
 */
async function testLeaveRejectionEmail(recipientEmail: string): Promise<TestResult> {
    const start = Date.now();
    try {
        const employee = await ensureTestEmployee();

        const result = await sendLeaveRejectionEmail(
            { email: recipientEmail, full_name: employee.full_name },
            {
                leaveType: 'SICK',
                startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                rejectedBy: 'Department Manager (Jane Doe)',
                reason: '[GMAIL API TEST] Insufficient documentation provided'
            }
        );

        return {
            test: 'leave-rejection',
            success: result.success,
            details: {
                recipientEmail,
                rejectedBy: 'Department Manager (Jane Doe)',
                leaveType: 'SICK',
                reason: 'Insufficient documentation provided'
            },
            error: result.error,
            duration: Date.now() - start
        };
    } catch (error) {
        return {
            test: 'leave-rejection',
            success: false,
            details: {},
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - start
        };
    }
}

/**
 * Test: Check-in Reminder Email
 */
async function testCheckInReminderEmail(recipientEmail: string): Promise<TestResult> {
    const start = Date.now();
    try {
        const employee = await ensureTestEmployee();

        // Test both reminder types
        const result1 = await sendCheckInReminderEmail(
            { email: recipientEmail, full_name: employee.full_name },
            1
        );

        return {
            test: 'check-in-reminder',
            success: result1.success,
            details: {
                recipientEmail,
                reminderType: 'First reminder',
                time: new Date().toLocaleTimeString()
            },
            error: result1.error,
            duration: Date.now() - start
        };
    } catch (error) {
        return {
            test: 'check-in-reminder',
            success: false,
            details: {},
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - start
        };
    }
}

/**
 * Test: Check-out Reminder Email
 */
async function testCheckOutReminderEmail(recipientEmail: string): Promise<TestResult> {
    const start = Date.now();
    try {
        const employee = await ensureTestEmployee();
        await createTestAttendance(employee.emp_id);

        const result = await sendCheckOutReminderEmail(
            {
                email: recipientEmail,
                full_name: employee.full_name,
                check_in_time: '09:00 AM'
            },
            1
        );

        return {
            test: 'check-out-reminder',
            success: result.success,
            details: {
                recipientEmail,
                reminderType: 'First reminder',
                checkInTime: '09:00 AM'
            },
            error: result.error,
            duration: Date.now() - start
        };
    } catch (error) {
        return {
            test: 'check-out-reminder',
            success: false,
            details: {},
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - start
        };
    }
}

/**
 * Cleanup test data
 */
async function cleanupTestData() {
    try {
        // Delete test leave requests
        await prisma.leaveRequest.deleteMany({
            where: {
                emp_id: TEST_CONFIG.testEmployeeId
            }
        });

        // Delete test attendance
        await prisma.attendance.deleteMany({
            where: {
                emp_id: TEST_CONFIG.testEmployeeId
            }
        });

        // Delete test employee
        await prisma.employee.deleteMany({
            where: {
                emp_id: TEST_CONFIG.testEmployeeId
            }
        });

        return { success: true, message: 'Test data cleaned up successfully' };
    } catch (error) {
        return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Cleanup failed'
        };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            testType = 'all',
            recipientEmail = TEST_CONFIG.defaultRecipient,
            cleanup = true
        } = body;

        const results: TestResult[] = [];
        const startTime = Date.now();

        // Run requested tests
        switch (testType) {
            case 'leave-submission':
                results.push(await testLeaveSubmissionEmail(recipientEmail));
                break;
            case 'leave-approval':
                results.push(await testLeaveApprovalEmail(recipientEmail));
                break;
            case 'leave-rejection':
                results.push(await testLeaveRejectionEmail(recipientEmail));
                break;
            case 'check-in-reminder':
                results.push(await testCheckInReminderEmail(recipientEmail));
                break;
            case 'check-out-reminder':
                results.push(await testCheckOutReminderEmail(recipientEmail));
                break;
            case 'all':
            default:
                results.push(await testLeaveSubmissionEmail(recipientEmail));
                results.push(await testLeaveApprovalEmail(recipientEmail));
                results.push(await testLeaveRejectionEmail(recipientEmail));
                results.push(await testCheckInReminderEmail(recipientEmail));
                results.push(await testCheckOutReminderEmail(recipientEmail));
                break;
        }

        // Calculate summary
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        const totalDuration = Date.now() - startTime;

        // Cleanup if requested
        let cleanupResult = null;
        if (cleanup) {
            cleanupResult = await cleanupTestData();
        }

        return NextResponse.json({
            success: failureCount === 0,
            timestamp: new Date().toISOString(),
            summary: {
                total: results.length,
                passed: successCount,
                failed: failureCount,
                duration: `${totalDuration}ms`
            },
            configuration: {
                oauthConfigured: !!process.env.GMAIL_REFRESH_TOKEN,
                smtpFallback: !!process.env.GMAIL_APP_PASSWORD,
                senderEmail: process.env.GMAIL_USER || 'continuum1105@gmail.com',
                recipientEmail
            },
            results,
            cleanup: cleanupResult
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        endpoint: '/api/test-gmail',
        description: 'Gmail API Test Endpoint - Tests real email functionality with leave request data',
        methods: {
            POST: {
                body: {
                    testType: {
                        type: 'string',
                        options: ['leave-submission', 'leave-approval', 'leave-rejection', 'check-in-reminder', 'check-out-reminder', 'all'],
                        default: 'all'
                    },
                    recipientEmail: {
                        type: 'string',
                        default: TEST_CONFIG.defaultRecipient
                    },
                    cleanup: {
                        type: 'boolean',
                        default: true,
                        description: 'Remove test data after tests complete'
                    }
                }
            }
        },
        currentConfig: {
            oauthConfigured: !!process.env.GMAIL_REFRESH_TOKEN,
            smtpFallback: !!process.env.GMAIL_APP_PASSWORD,
            senderEmail: process.env.GMAIL_USER || 'continuum1105@gmail.com',
            defaultRecipient: TEST_CONFIG.defaultRecipient
        },
        examples: {
            runAllTests: 'POST /api/test-gmail with body: {}',
            runSpecificTest: 'POST /api/test-gmail with body: { "testType": "leave-submission" }',
            customRecipient: 'POST /api/test-gmail with body: { "recipientEmail": "your-email@example.com" }',
            keepTestData: 'POST /api/test-gmail with body: { "cleanup": false }'
        }
    });
}
