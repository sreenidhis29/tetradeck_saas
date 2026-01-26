/**
 * REAL API ENDPOINT TESTS
 * Makes actual HTTP requests to running server
 * Tests real authentication, data flows, and edge cases
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

// Track all issues found
const issues = [];
const results = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function log(type, message) {
    const icons = { pass: '✅', fail: '❌', warn: '⚠️', info: 'ℹ️' };
    console.log(`   ${icons[type] || '•'} ${message}`);
    
    if (type === 'fail') {
        results.failed++;
        issues.push(message);
    } else if (type === 'pass') {
        results.passed++;
    } else if (type === 'warn') {
        results.warnings++;
    }
}

async function testEndpoint(method, path, options = {}) {
    try {
        const url = `${BASE_URL}${path}`;
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
            redirect: 'manual'
        });
        
        return {
            status: res.status,
            headers: res.headers,
            location: res.headers.get('location'),
            ok: res.ok,
            data: res.status !== 307 && res.status !== 308 ? await res.text().catch(() => '') : null
        };
    } catch (e) {
        return { error: e.message, status: 0 };
    }
}

async function testPublicEndpoints() {
    console.log('\n📡 TESTING PUBLIC ENDPOINTS');
    console.log('='.repeat(50));

    // Landing page should be accessible
    const landing = await testEndpoint('GET', '/');
    if (landing.status === 200 || landing.status === 307) {
        log('pass', `Landing page: ${landing.status}`);
    } else {
        log('fail', `Landing page failed: ${landing.status} ${landing.error || ''}`);
    }

    // Sign-in page
    const signin = await testEndpoint('GET', '/sign-in');
    if (signin.status === 200 || signin.status === 307) {
        log('pass', `Sign-in page: ${signin.status}`);
    } else {
        log('fail', `Sign-in page failed: ${signin.status}`);
    }

    // Sign-up page
    const signup = await testEndpoint('GET', '/sign-up');
    if (signup.status === 200 || signup.status === 307) {
        log('pass', `Sign-up page: ${signup.status}`);
    } else {
        log('fail', `Sign-up page failed: ${signup.status}`);
    }
}

async function testProtectedEndpoints() {
    console.log('\n🔒 TESTING PROTECTED ENDPOINTS (Without Auth)');
    console.log('='.repeat(50));

    const protectedRoutes = [
        { path: '/hr/dashboard', name: 'HR Dashboard' },
        { path: '/hr/employees', name: 'HR Employees' },
        { path: '/hr/approvals', name: 'HR Approvals' },
        { path: '/employee/dashboard', name: 'Employee Dashboard' },
        { path: '/employee/leave', name: 'Employee Leave' },
        { path: '/employee/attendance', name: 'Employee Attendance' },
        { path: '/onboarding', name: 'Onboarding' },
    ];

    for (const route of protectedRoutes) {
        const res = await testEndpoint('GET', route.path);
        if (res.status === 307 || res.status === 308 || res.status === 401 || res.status === 403) {
            log('pass', `${route.name}: Protected (${res.status})`);
        } else if (res.status === 200) {
            log('fail', `${route.name}: EXPOSED WITHOUT AUTH! (${res.status})`);
        } else {
            log('warn', `${route.name}: Unexpected response (${res.status})`);
        }
    }
}

async function testAPIEndpoints() {
    console.log('\n🔌 TESTING API ENDPOINTS (Without Auth)');
    console.log('='.repeat(50));

    const apiRoutes = [
        { method: 'GET', path: '/api/constraint-rules', name: 'Constraint Rules GET' },
        { method: 'POST', path: '/api/constraint-rules', name: 'Constraint Rules POST' },
        { method: 'GET', path: '/api/leaves/balances', name: 'Leave Balances' },
        { method: 'POST', path: '/api/leaves/submit', name: 'Leave Submit' },
        { method: 'GET', path: '/api/employees/pending', name: 'Pending Employees' },
    ];

    for (const route of apiRoutes) {
        const res = await testEndpoint(route.method, route.path);
        if (res.status === 401 || res.status === 403 || res.status === 307) {
            log('pass', `${route.name}: Auth required (${res.status})`);
        } else if (res.status === 200 || res.status === 201) {
            log('fail', `${route.name}: NO AUTH CHECK! Returns data without authentication`);
        } else if (res.status === 405) {
            log('pass', `${route.name}: Method validation (${res.status})`);
        } else {
            log('warn', `${route.name}: ${res.status} - ${res.data?.slice(0, 50) || res.error}`);
        }
    }
}

async function testDatabaseConnections() {
    console.log('\n💾 TESTING DATABASE DATA INTEGRITY');
    console.log('='.repeat(50));

    // Test 1: Check for orphaned records
    const orphanedEmployees = await prisma.employee.count({
        where: { org_id: { not: null }, company: null }
    });
    if (orphanedEmployees === 0) {
        log('pass', 'No orphaned employees');
    } else {
        log('fail', `${orphanedEmployees} orphaned employees found`);
    }

    // Test 2: Check leave balances consistency
    const companies = await prisma.company.findMany({
        include: { employees: true, leave_types: true }
    });

    for (const company of companies.slice(0, 3)) { // Check first 3
        const empCount = company.employees.length;
        const ltCount = company.leave_types.length;
        
        const expectedBalances = (empCount - 1) * ltCount; // -1 for HR
        const actualBalances = await prisma.leaveBalance.count({
            where: { employee: { org_id: company.id } }
        });

        if (Math.abs(actualBalances - expectedBalances) <= ltCount) {
            log('pass', `${company.name}: Leave balances consistent (${actualBalances})`);
        } else {
            log('warn', `${company.name}: Expected ~${expectedBalances} balances, got ${actualBalances}`);
        }
    }

    // Test 3: Cross-company isolation
    const company1 = companies[0];
    const company2 = companies[1];

    if (company1 && company2) {
        // Try to find employees that somehow belong to wrong company
        const crossLeaks = await prisma.leaveRequest.count({
            where: {
                employee: { org_id: company1.id },
                current_approver: {
                    in: company2.employees.map(e => e.emp_id)
                }
            }
        });

        if (crossLeaks === 0) {
            log('pass', 'Cross-company data isolation verified');
        } else {
            log('fail', `CRITICAL: ${crossLeaks} cross-company data leaks!`);
        }
    }

    // Test 4: Leave type uniqueness per company
    const duplicateTypes = await prisma.$queryRaw`
        SELECT company_id, code, COUNT(*) as cnt 
        FROM leave_types 
        GROUP BY company_id, code 
        HAVING COUNT(*) > 1
    `;
    
    if (duplicateTypes.length === 0) {
        log('pass', 'Leave type codes unique per company');
    } else {
        log('fail', `Duplicate leave type codes found: ${duplicateTypes.length}`);
    }
}

async function testBusinessLogic() {
    console.log('\n📊 TESTING BUSINESS LOGIC');
    console.log('='.repeat(50));

    // Test 1: Leave balance cannot go negative (unless allowed)
    const companies = await prisma.company.findMany({
        where: { negative_balance: false },
        include: {
            employees: {
                include: {
                    leave_balances: { where: { year: 2026 } }
                }
            }
        }
    });

    let negativeFound = 0;
    for (const company of companies) {
        for (const emp of company.employees) {
            for (const bal of emp.leave_balances) {
                const remaining = Number(bal.annual_entitlement) + Number(bal.carried_forward) - Number(bal.used_days);
                if (remaining < 0) {
                    negativeFound++;
                }
            }
        }
    }

    if (negativeFound === 0) {
        log('pass', 'No unauthorized negative balances');
    } else {
        log('warn', `${negativeFound} negative balances in companies that don't allow it`);
    }

    // Test 2: Pending leave requests have valid approvers
    const pendingWithoutApprover = await prisma.leaveRequest.count({
        where: {
            status: 'pending',
            current_approver: null
        }
    });

    if (pendingWithoutApprover === 0) {
        log('pass', 'All pending leaves have assigned approvers');
    } else {
        log('warn', `${pendingWithoutApprover} pending requests without approver`);
    }

    // Test 3: HR role exists in each company
    for (const company of companies.slice(0, 5)) {
        const hrCount = company.employees.filter(e => e.role === 'hr').length;
        if (hrCount > 0) {
            log('pass', `${company.name}: Has HR (${hrCount})`);
        } else {
            log('fail', `${company.name}: NO HR - employees can't be approved!`);
        }
    }
}

async function testConcurrentOperations() {
    console.log('\n⚡ TESTING CONCURRENT OPERATIONS');
    console.log('='.repeat(50));

    // Simulate concurrent requests (what happens in real multi-user scenario)
    const promises = [];
    for (let i = 0; i < 10; i++) {
        promises.push(testEndpoint('GET', '/'));
        promises.push(testEndpoint('GET', '/sign-in'));
    }

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    const successes = results.filter(r => r.status === 200 || r.status === 307).length;
    const failures = results.filter(r => r.status === 0 || r.status >= 500).length;

    log('info', `20 concurrent requests completed in ${duration}ms`);
    log(failures === 0 ? 'pass' : 'fail', `Success: ${successes}, Failures: ${failures}`);
}

async function testCompanyIsolation() {
    console.log('\n🏢 TESTING MULTI-COMPANY ISOLATION');
    console.log('='.repeat(50));

    const companies = await prisma.company.findMany({
        take: 3,
        include: {
            employees: { take: 5 },
            leave_types: true
        }
    });

    for (let i = 0; i < companies.length; i++) {
        for (let j = i + 1; j < companies.length; j++) {
            const c1 = companies[i];
            const c2 = companies[j];

            // Check employees don't overlap
            const c1EmpIds = new Set(c1.employees.map(e => e.emp_id));
            const c2EmpIds = new Set(c2.employees.map(e => e.emp_id));
            const overlap = [...c1EmpIds].filter(id => c2EmpIds.has(id));

            if (overlap.length === 0) {
                log('pass', `${c1.name} ↔ ${c2.name}: No employee overlap`);
            } else {
                log('fail', `${c1.name} ↔ ${c2.name}: ${overlap.length} shared employees!`);
            }

            // Check leave types are separate
            const c1Codes = new Set(c1.leave_types.map(lt => lt.id));
            const c2Codes = new Set(c2.leave_types.map(lt => lt.id));
            const ltOverlap = [...c1Codes].filter(id => c2Codes.has(id));

            if (ltOverlap.length === 0) {
                log('pass', `${c1.name} ↔ ${c2.name}: Leave types isolated`);
            } else {
                log('fail', `${c1.name} ↔ ${c2.name}: Shared leave type IDs!`);
            }
        }
    }
}

async function generateFinalReport() {
    console.log('\n' + '═'.repeat(60));
    console.log('📋 FINAL TEST REPORT');
    console.log('═'.repeat(60));

    console.log(`\n   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   ⚠️  Warnings: ${results.warnings}`);

    if (issues.length > 0) {
        console.log('\n🚨 ISSUES FOUND:');
        issues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`);
        });
    }

    const total = results.passed + results.failed;
    const score = total > 0 ? Math.round((results.passed / total) * 100) : 0;

    console.log(`\n📊 HEALTH SCORE: ${score}%`);
    
    if (score >= 90) {
        console.log('🎉 EXCELLENT - System is production-ready');
    } else if (score >= 70) {
        console.log('👍 GOOD - Minor issues to address');
    } else if (score >= 50) {
        console.log('⚠️  FAIR - Several issues need attention');
    } else {
        console.log('🔴 CRITICAL - Major issues require immediate fixes');
    }

    console.log('\n' + '═'.repeat(60));
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     COMPREHENSIVE SYSTEM TEST                              ║');
    console.log('║     Testing Real API Endpoints & Data Integrity            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    try {
        await testPublicEndpoints();
        await testProtectedEndpoints();
        await testAPIEndpoints();
        await testDatabaseConnections();
        await testBusinessLogic();
        await testConcurrentOperations();
        await testCompanyIsolation();
        await generateFinalReport();
    } catch (error) {
        console.error('\n❌ TEST EXECUTION ERROR:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
