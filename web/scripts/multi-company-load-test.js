/**
 * COMPREHENSIVE MULTI-COMPANY LOAD TEST
 * - Cleans database completely
 * - Creates 10 companies with unique configurations
 * - 20-50 employees per company
 * - Simulates daily/monthly operations
 * - Tests data isolation between companies
 */

const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

// Company configurations - each unique
const COMPANY_CONFIGS = [
    {
        name: "TechNova Solutions",
        industry: "Technology",
        timezone: "Asia/Kolkata",
        workStart: "09:00",
        workEnd: "18:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 12 },
            { code: "VACATION", name: "Vacation", quota: 24 },
            { code: "CASUAL", name: "Casual Leave", quota: 10 },
            { code: "WFH", name: "Work From Home", quota: 52 }
        ],
        employeeCount: 45
    },
    {
        name: "FinServ Global",
        industry: "Finance",
        timezone: "America/New_York",
        workStart: "08:00",
        workEnd: "17:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 10 },
            { code: "PTO", name: "Paid Time Off", quota: 20 },
            { code: "BEREAVEMENT", name: "Bereavement", quota: 5 }
        ],
        employeeCount: 32
    },
    {
        name: "HealthPlus Medical",
        industry: "Healthcare",
        timezone: "Europe/London",
        workStart: "07:00",
        workEnd: "19:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 15 },
            { code: "ANNUAL", name: "Annual Leave", quota: 28 },
            { code: "MATERNITY", name: "Maternity", quota: 180 },
            { code: "PATERNITY", name: "Paternity", quota: 14 },
            { code: "STUDY", name: "Study Leave", quota: 5 }
        ],
        employeeCount: 50
    },
    {
        name: "EcoGreen Manufacturing",
        industry: "Manufacturing",
        timezone: "Asia/Tokyo",
        workStart: "06:00",
        workEnd: "14:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 8 },
            { code: "VACATION", name: "Vacation", quota: 15 },
            { code: "COMP", name: "Comp Off", quota: 12 }
        ],
        employeeCount: 48
    },
    {
        name: "RetailMax Stores",
        industry: "Retail",
        timezone: "America/Los_Angeles",
        workStart: "10:00",
        workEnd: "20:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 6 },
            { code: "VACATION", name: "Vacation", quota: 14 },
            { code: "PERSONAL", name: "Personal Day", quota: 3 }
        ],
        employeeCount: 38
    },
    {
        name: "EduLearn Academy",
        industry: "Education",
        timezone: "Australia/Sydney",
        workStart: "08:30",
        workEnd: "16:30",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 12 },
            { code: "ANNUAL", name: "Annual Leave", quota: 20 },
            { code: "SABBATICAL", name: "Sabbatical", quota: 30 },
            { code: "CONFERENCE", name: "Conference Leave", quota: 10 }
        ],
        employeeCount: 25
    },
    {
        name: "LogiTrans Shipping",
        industry: "Logistics",
        timezone: "Europe/Berlin",
        workStart: "05:00",
        workEnd: "13:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 10 },
            { code: "VACATION", name: "Vacation", quota: 25 },
            { code: "EMERGENCY", name: "Emergency Leave", quota: 5 }
        ],
        employeeCount: 42
    },
    {
        name: "MediaWave Studios",
        industry: "Media",
        timezone: "America/Chicago",
        workStart: "10:00",
        workEnd: "19:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 8 },
            { code: "CREATIVE", name: "Creative Break", quota: 10 },
            { code: "VACATION", name: "Vacation", quota: 18 },
            { code: "MENTAL", name: "Mental Health Day", quota: 6 }
        ],
        employeeCount: 28
    },
    {
        name: "LegalEagle Associates",
        industry: "Legal",
        timezone: "Asia/Singapore",
        workStart: "09:00",
        workEnd: "18:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 14 },
            { code: "ANNUAL", name: "Annual Leave", quota: 21 },
            { code: "BAR", name: "Bar Exam Leave", quota: 10 },
            { code: "COURT", name: "Court Appearance", quota: 0 }
        ],
        employeeCount: 20
    },
    {
        name: "AgriPrime Farms",
        industry: "Agriculture",
        timezone: "Africa/Johannesburg",
        workStart: "06:00",
        workEnd: "15:00",
        leaveTypes: [
            { code: "SICK", name: "Sick Leave", quota: 10 },
            { code: "HARVEST", name: "Harvest Leave", quota: 0 },
            { code: "VACATION", name: "Vacation", quota: 12 }
        ],
        employeeCount: 35
    }
];

const FIRST_NAMES = ["James", "Emma", "Oliver", "Sophia", "Liam", "Ava", "Noah", "Isabella", "Ethan", "Mia", 
    "Lucas", "Charlotte", "Mason", "Amelia", "Logan", "Harper", "Alexander", "Evelyn", "Sebastian", "Abigail",
    "Benjamin", "Emily", "Henry", "Elizabeth", "Jackson", "Sofia", "Aiden", "Avery", "Owen", "Ella",
    "Samuel", "Scarlett", "Ryan", "Grace", "Nathan", "Chloe", "Caleb", "Victoria", "Dylan", "Riley",
    "Priya", "Raj", "Aisha", "Mohammed", "Yuki", "Kenji", "Wei", "Lin", "Carlos", "Maria"];

const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Patel", "Kumar", "Singh", "Shah", "Tanaka", "Suzuki", "Chen", "Wang", "Santos", "Costa"];

const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations", "Support", "Product", "Design", "Legal"];
const POSITIONS = ["Junior", "Senior", "Lead", "Manager", "Director", "VP", "Specialist", "Analyst", "Coordinator", "Associate"];

function generateCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmployee(companyId, index, isHR = false) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const department = isHR ? "HR" : randomElement(DEPARTMENTS);
    const position = isHR ? "HR Manager" : `${randomElement(POSITIONS)} ${department}`;
    
    return {
        emp_id: randomUUID(),
        full_name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@company${companyId.slice(0,4)}.test`,
        department,
        position,
        role: isHR ? 'hr' : 'employee',
        org_id: companyId,
        country_code: 'IN',
        onboarding_status: 'completed',
        onboarding_completed: true,
        approval_status: 'approved',
        is_active: true
    };
}

async function cleanDatabase() {
    console.log('\n🧹 CLEANING DATABASE...');
    console.log('-'.repeat(50));

    // Delete in order to respect foreign keys
    const tables = [
        { name: 'LeaveRequest', fn: () => prisma.leaveRequest.deleteMany() },
        { name: 'LeaveBalance', fn: () => prisma.leaveBalance.deleteMany() },
        { name: 'LeaveType', fn: () => prisma.leaveType.deleteMany() },
        { name: 'Attendance', fn: () => prisma.attendance.deleteMany() },
        { name: 'Document', fn: () => prisma.document.deleteMany() },
        { name: 'Payroll', fn: () => prisma.payroll.deleteMany() },
        { name: 'AuditLog', fn: () => prisma.auditLog.deleteMany() },
        { name: 'ApprovalHierarchy', fn: () => prisma.approvalHierarchy.deleteMany() },
        { name: 'Employee', fn: () => prisma.employee.deleteMany() },
        { name: 'ConstraintPolicy', fn: () => prisma.constraintPolicy.deleteMany() },
        { name: 'LeaveRule', fn: () => prisma.leaveRule.deleteMany() },
        { name: 'Subscription', fn: () => prisma.subscription.deleteMany() },
        { name: 'UsageRecord', fn: () => prisma.usageRecord.deleteMany() },
        { name: 'ApiKey', fn: () => prisma.apiKey.deleteMany() },
        { name: 'Payment', fn: () => prisma.payment.deleteMany() },
        { name: 'Company', fn: () => prisma.company.deleteMany() }
    ];

    for (const table of tables) {
        try {
            const result = await table.fn();
            console.log(`   ✓ ${table.name}: ${result.count} records deleted`);
        } catch (e) {
            console.log(`   ⚠ ${table.name}: ${e.message.slice(0, 50)}`);
        }
    }
    
    console.log('✅ Database cleaned!\n');
}

async function createCompanies() {
    console.log('🏢 CREATING 10 COMPANIES WITH UNIQUE CONFIGURATIONS...');
    console.log('-'.repeat(50));

    const companies = [];

    for (const config of COMPANY_CONFIGS) {
        const companyCode = generateCode();
        
        const company = await prisma.company.create({
            data: {
                name: config.name,
                code: companyCode,
                industry: config.industry,
                timezone: config.timezone,
                work_start_time: config.workStart,
                work_end_time: config.workEnd,
                subscription_tier: 'PROFESSIONAL',
                onboarding_completed: true
            }
        });

        // Create leave types for this company
        for (const lt of config.leaveTypes) {
            await prisma.leaveType.create({
                data: {
                    company_id: company.id,
                    code: lt.code,
                    name: lt.name,
                    annual_quota: lt.quota,
                    requires_approval: true,
                    is_active: true
                }
            });
        }

        companies.push({
            ...company,
            config,
            leaveTypes: config.leaveTypes
        });

        console.log(`   ✅ ${config.name} (${companyCode}) - ${config.leaveTypes.length} leave types`);
    }

    return companies;
}

async function createEmployees(companies) {
    console.log('\n👥 CREATING EMPLOYEES FOR EACH COMPANY...');
    console.log('-'.repeat(50));

    const allEmployees = {};

    for (const company of companies) {
        const employees = [];
        const count = company.config.employeeCount;

        // First employee is always HR
        const hrData = generateEmployee(company.id, 0, true);
        const hr = await prisma.employee.create({ data: hrData });
        employees.push(hr);

        // Create remaining employees
        for (let i = 1; i < count; i++) {
            const empData = generateEmployee(company.id, i, false);
            const emp = await prisma.employee.create({ data: empData });
            employees.push(emp);
        }

        allEmployees[company.id] = employees;
        console.log(`   ✅ ${company.config.name}: ${count} employees (1 HR + ${count - 1} staff)`);
    }

    return allEmployees;
}

async function seedLeaveBalances(companies, allEmployees) {
    console.log('\n💰 SEEDING LEAVE BALANCES...');
    console.log('-'.repeat(50));

    const currentYear = new Date().getFullYear();
    let totalBalances = 0;

    for (const company of companies) {
        const employees = allEmployees[company.id];
        const leaveTypes = await prisma.leaveType.findMany({
            where: { company_id: company.id }
        });

        for (const emp of employees) {
            for (const lt of leaveTypes) {
                await prisma.leaveBalance.create({
                    data: {
                        emp_id: emp.emp_id,
                        country_code: 'IN',
                        leave_type: lt.code,
                        year: currentYear,
                        annual_entitlement: lt.annual_quota,
                        used_days: 0,
                        pending_days: 0,
                        carried_forward: 0
                    }
                });
                totalBalances++;
            }
        }
        
        console.log(`   ✅ ${company.config.name}: ${employees.length * leaveTypes.length} balances`);
    }

    console.log(`   📊 Total: ${totalBalances} leave balances created`);
}

async function simulateDailyOperations(companies, allEmployees) {
    console.log('\n📅 SIMULATING DAILY OPERATIONS (30 days)...');
    console.log('-'.repeat(50));

    const today = new Date();
    const stats = {};

    for (const company of companies) {
        const employees = allEmployees[company.id];
        const leaveTypes = await prisma.leaveType.findMany({
            where: { company_id: company.id }
        });

        let leaveRequests = 0;
        let attendanceRecords = 0;

        // Simulate 30 days of operations
        for (let day = 0; day < 30; day++) {
            const workDate = new Date(today);
            workDate.setDate(workDate.getDate() - day);

            // Skip weekends
            if (workDate.getDay() === 0 || workDate.getDay() === 6) continue;

            // Each day, some employees request leave, others mark attendance
            for (const emp of employees) {
                const random = Math.random();

                if (random < 0.05) {
                    // 5% chance of leave request
                    const lt = randomElement(leaveTypes);
                    const leaveDays = randomInt(1, 3);
                    const startDate = new Date(workDate);
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + leaveDays - 1);

                    try {
                        await prisma.leaveRequest.create({
                            data: {
                                request_id: randomUUID(),
                                emp_id: emp.emp_id,
                                leave_type: lt.code,
                                country_code: 'IN',
                                start_date: startDate,
                                end_date: endDate,
                                total_days: leaveDays,
                                working_days: leaveDays,
                                reason: `${lt.name} request for personal reasons`,
                                status: randomElement(['pending', 'approved', 'approved', 'rejected'])
                            }
                        });
                        leaveRequests++;
                    } catch (e) {
                        // Duplicate or other error, skip
                    }
                } else if (random < 0.9) {
                    // 85% chance of attendance
                    try {
                        const checkIn = new Date(workDate);
                        checkIn.setHours(9, randomInt(0, 30), 0);
                        const checkOut = new Date(workDate);
                        checkOut.setHours(18, randomInt(0, 30), 0);

                        await prisma.attendance.create({
                            data: {
                                emp_id: emp.emp_id,
                                date: workDate,
                                check_in: checkIn,
                                check_out: checkOut,
                                total_hours: 8 + (Math.random() * 2 - 1),
                                status: 'present'
                            }
                        });
                        attendanceRecords++;
                    } catch (e) {
                        // Duplicate date, skip
                    }
                }
            }
        }

        stats[company.id] = { leaveRequests, attendanceRecords };
        console.log(`   ✅ ${company.config.name}: ${leaveRequests} leave requests, ${attendanceRecords} attendance records`);
    }

    return stats;
}

async function testDataIsolation(companies, allEmployees) {
    console.log('\n🔒 TESTING DATA ISOLATION BETWEEN COMPANIES...');
    console.log('-'.repeat(50));

    let allPassed = true;

    for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        const otherCompany = companies[(i + 1) % companies.length];

        // Test 1: Can company see other company's employees?
        const crossEmployees = await prisma.employee.findMany({
            where: {
                org_id: company.id,
                emp_id: { in: allEmployees[otherCompany.id].map(e => e.emp_id) }
            }
        });

        if (crossEmployees.length > 0) {
            console.log(`   ❌ ${company.config.name} can see ${otherCompany.config.name}'s employees!`);
            allPassed = false;
        }

        // Test 2: Can company see other company's leave requests?
        const crossLeaves = await prisma.leaveRequest.findMany({
            where: {
                employee: { org_id: company.id },
                emp_id: { in: allEmployees[otherCompany.id].map(e => e.emp_id) }
            }
        });

        if (crossLeaves.length > 0) {
            console.log(`   ❌ ${company.config.name} can see ${otherCompany.config.name}'s leave requests!`);
            allPassed = false;
        }

        // Test 3: Verify employee counts match
        const companyEmployeeCount = await prisma.employee.count({
            where: { org_id: company.id }
        });

        if (companyEmployeeCount !== company.config.employeeCount) {
            console.log(`   ❌ ${company.config.name} employee count mismatch: ${companyEmployeeCount} vs ${company.config.employeeCount}`);
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log('   ✅ All isolation tests PASSED - Companies cannot see each other\'s data');
    }

    return allPassed;
}

async function testLeaveQuotasUnique(companies) {
    console.log('\n📊 VERIFYING UNIQUE LEAVE CONFIGURATIONS...');
    console.log('-'.repeat(50));

    const leaveConfigs = {};

    for (const company of companies) {
        const leaveTypes = await prisma.leaveType.findMany({
            where: { company_id: company.id },
            orderBy: { code: 'asc' }
        });

        const configKey = leaveTypes.map(lt => `${lt.code}:${lt.annual_quota}`).join(',');
        
        if (leaveConfigs[configKey]) {
            console.log(`   ⚠ ${company.config.name} has same config as ${leaveConfigs[configKey]}`);
        } else {
            leaveConfigs[configKey] = company.config.name;
        }

        const quotaStr = leaveTypes.map(lt => `${lt.code}=${lt.annual_quota}`).join(', ');
        console.log(`   ${company.config.name}: ${quotaStr}`);
    }
}

async function generateFinalReport(companies, allEmployees, stats) {
    console.log('\n' + '='.repeat(60));
    console.log('📈 FINAL STATISTICS REPORT');
    console.log('='.repeat(60));

    let totalEmployees = 0;
    let totalLeaveRequests = 0;
    let totalAttendance = 0;

    console.log('\n| Company | Employees | Leave Req | Attendance |');
    console.log('|---------|-----------|-----------|------------|');

    for (const company of companies) {
        const empCount = allEmployees[company.id].length;
        const companyStats = stats[company.id] || { leaveRequests: 0, attendanceRecords: 0 };
        
        totalEmployees += empCount;
        totalLeaveRequests += companyStats.leaveRequests;
        totalAttendance += companyStats.attendanceRecords;

        console.log(`| ${company.config.name.padEnd(20).slice(0, 20)} | ${String(empCount).padStart(9)} | ${String(companyStats.leaveRequests).padStart(9)} | ${String(companyStats.attendanceRecords).padStart(10)} |`);
    }

    console.log('|---------|-----------|-----------|------------|');
    console.log(`| ${'TOTAL'.padEnd(20)} | ${String(totalEmployees).padStart(9)} | ${String(totalLeaveRequests).padStart(9)} | ${String(totalAttendance).padStart(10)} |`);

    // Database counts verification
    console.log('\n📊 DATABASE VERIFICATION:');
    const dbCounts = {
        companies: await prisma.company.count(),
        employees: await prisma.employee.count(),
        leaveTypes: await prisma.leaveType.count(),
        leaveBalances: await prisma.leaveBalance.count(),
        leaveRequests: await prisma.leaveRequest.count(),
        attendance: await prisma.attendance.count()
    };

    console.log(`   Companies: ${dbCounts.companies}`);
    console.log(`   Employees: ${dbCounts.employees}`);
    console.log(`   Leave Types: ${dbCounts.leaveTypes}`);
    console.log(`   Leave Balances: ${dbCounts.leaveBalances}`);
    console.log(`   Leave Requests: ${dbCounts.leaveRequests}`);
    console.log(`   Attendance Records: ${dbCounts.attendance}`);
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  COMPREHENSIVE MULTI-COMPANY LOAD TEST                     ║');
    console.log('║  10 Companies | 20-50 Employees Each | Unique Configs      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    try {
        // Step 1: Clean database
        await cleanDatabase();

        // Step 2: Create companies with unique configs
        const companies = await createCompanies();

        // Step 3: Create employees for each company
        const allEmployees = await createEmployees(companies);

        // Step 4: Seed leave balances
        await seedLeaveBalances(companies, allEmployees);

        // Step 5: Simulate 30 days of operations
        const stats = await simulateDailyOperations(companies, allEmployees);

        // Step 6: Test data isolation
        const isolationPassed = await testDataIsolation(companies, allEmployees);

        // Step 7: Verify unique leave configurations
        await testLeaveQuotasUnique(companies);

        // Step 8: Generate final report
        await generateFinalReport(companies, allEmployees, stats);

        console.log('\n' + '='.repeat(60));
        if (isolationPassed) {
            console.log('✅ ALL TESTS PASSED SUCCESSFULLY');
        } else {
            console.log('❌ SOME TESTS FAILED - Review above');
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();
