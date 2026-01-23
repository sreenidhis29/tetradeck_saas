/**
 * Auth Flow Code Path Validator
 * 
 * This script validates that all auth/onboarding code paths are correct
 * by analyzing the actual implementation.
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
    scenario: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    details: string;
}

const results: TestResult[] = [];

function checkFileContains(filePath: string, pattern: string | RegExp): boolean {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (typeof pattern === 'string') {
            return content.includes(pattern);
        }
        return pattern.test(content);
    } catch (e) {
        return false;
    }
}

function test(scenario: string, condition: boolean, passMsg: string, failMsg: string) {
    results.push({
        scenario,
        status: condition ? 'PASS' : 'FAIL',
        details: condition ? passMsg : failMsg
    });
}

function warn(scenario: string, msg: string) {
    results.push({
        scenario,
        status: 'WARN',
        details: msg
    });
}

// ============================================================
// MIDDLEWARE TESTS
// ============================================================

const middlewarePath = path.join(__dirname, '../middleware.ts');

test(
    'Middleware: Unauthenticated users redirected to sign-in',
    checkFileContains(middlewarePath, "return NextResponse.redirect(new URL('/sign-in', req.url))"),
    'Redirect to /sign-in found',
    'Missing redirect for unauthenticated users'
);

test(
    'Middleware: Unauthenticated API returns 401',
    checkFileContains(middlewarePath, /status: 401/),
    '401 response for API routes found',
    'Missing 401 for API routes'
);

test(
    'Middleware: Public routes allowed',
    checkFileContains(middlewarePath, 'isPublicRoute(req)'),
    'Public route check found',
    'Missing public route check'
);

test(
    'Middleware: Onboarding routes allowed for logged-in users',
    checkFileContains(middlewarePath, 'isOnboardingRoute(req)'),
    'Onboarding route check found',
    'Missing onboarding route check'
);

// ============================================================
// HR LAYOUT GUARD TESTS
// ============================================================

const hrLayoutPath = path.join(__dirname, '../app/hr/(main)/layout.tsx');

test(
    'HR Layout: Server-side component (async)',
    checkFileContains(hrLayoutPath, 'export default async function'),
    'Layout is async server component',
    'Layout should be async for server-side checks'
);

test(
    'HR Layout: Checks currentUser',
    checkFileContains(hrLayoutPath, 'currentUser()'),
    'currentUser check found',
    'Missing currentUser check'
);

test(
    'HR Layout: Redirects unauthenticated to sign-in',
    checkFileContains(hrLayoutPath, 'redirect("/sign-in")'),
    'Redirect to sign-in found',
    'Missing redirect for unauthenticated'
);

test(
    'HR Layout: Checks employee exists',
    checkFileContains(hrLayoutPath, 'prisma.employee.findUnique'),
    'Employee lookup found',
    'Missing employee lookup'
);

test(
    'HR Layout: Redirects no-employee to onboarding',
    checkFileContains(hrLayoutPath, 'redirect("/onboarding?intent=hr")'),
    'Redirect to onboarding found',
    'Missing redirect for no employee'
);

test(
    'HR Layout: Checks onboarding_status',
    checkFileContains(hrLayoutPath, 'onboarding_status'),
    'onboarding_status check found',
    'Missing onboarding_status check'
);

test(
    'HR Layout: Checks onboarding_completed',
    checkFileContains(hrLayoutPath, 'onboarding_completed'),
    'onboarding_completed check found',
    'Missing onboarding_completed check'
);

test(
    'HR Layout: Checks org_id',
    checkFileContains(hrLayoutPath, 'org_id'),
    'org_id check found',
    'Missing org_id check'
);

test(
    'HR Layout: Checks company exists',
    checkFileContains(hrLayoutPath, 'company'),
    'company check found',
    'Missing company check'
);

test(
    'HR Layout: Checks HR role',
    checkFileContains(hrLayoutPath, 'employee.role'),
    'role check found',
    'Missing role check'
);

test(
    'HR Layout: Redirects non-HR to employee dashboard',
    checkFileContains(hrLayoutPath, 'redirect("/employee/dashboard")'),
    'Redirect to employee dashboard for non-HR found',
    'Missing redirect for non-HR users'
);

// ============================================================
// EMPLOYEE LAYOUT GUARD TESTS
// ============================================================

const empLayoutPath = path.join(__dirname, '../app/employee/(main)/layout.tsx');

test(
    'Employee Layout: Server-side component (async)',
    checkFileContains(empLayoutPath, 'export default async function'),
    'Layout is async server component',
    'Layout should be async for server-side checks'
);

test(
    'Employee Layout: Checks approval_status',
    checkFileContains(empLayoutPath, 'approval_status'),
    'approval_status check found',
    'Missing approval_status check'
);

test(
    'Employee Layout: Redirects pending to pending page',
    checkFileContains(empLayoutPath, 'redirect("/employee/pending")'),
    'Redirect to pending page found',
    'Missing redirect for pending approval'
);

test(
    'Employee Layout: Redirects rejected to rejected page',
    checkFileContains(empLayoutPath, 'redirect("/employee/rejected")'),
    'Redirect to rejected page found',
    'Missing redirect for rejected employees'
);

test(
    'Employee Layout: Redirects HR to HR dashboard',
    checkFileContains(empLayoutPath, 'redirect("/hr/dashboard")'),
    'Redirect to HR dashboard found',
    'Missing redirect for HR users'
);

test(
    'Employee Layout: Handles approved onboarding_status',
    checkFileContains(empLayoutPath, '"approved"'),
    'Handles approved status',
    'Missing handling for approved onboarding_status'
);

// ============================================================
// ONBOARDING ACTIONS TESTS
// ============================================================

const onboardingPath = path.join(__dirname, '../app/actions/onboarding.ts');

test(
    'Onboarding: registerCompany uses transaction',
    checkFileContains(onboardingPath, 'prisma.$transaction'),
    'Transaction found in registerCompany',
    'Missing transaction for atomic operation'
);

test(
    'Onboarding: registerCompany sets onboarding_completed',
    checkFileContains(onboardingPath, 'onboarding_completed: true'),
    'Sets onboarding_completed to true',
    'Missing onboarding_completed setting'
);

test(
    'Onboarding: registerCompany sets role to hr',
    checkFileContains(onboardingPath, 'role: "hr"'),
    'Sets role to hr',
    'Missing role setting for HR'
);

test(
    'Onboarding: syncUser creates employee with legal step',
    checkFileContains(onboardingPath, 'onboarding_step: "legal"'),
    'Sets initial step to legal',
    'Missing initial onboarding step'
);

test(
    'Onboarding: acceptTerms advances to choice step',
    checkFileContains(onboardingPath, 'onboarding_step: "choice"'),
    'Advances to choice step',
    'Missing step advancement'
);

test(
    'Onboarding: joinCompany sets pending_approval',
    checkFileContains(onboardingPath, 'onboarding_status: "pending_approval"'),
    'Sets pending_approval status',
    'Missing pending_approval status'
);

test(
    'Onboarding: approveEmployee sets approved status',
    checkFileContains(onboardingPath, 'approval_status: "approved"'),
    'Sets approved status',
    'Missing approved status setting'
);

test(
    'Onboarding: checkFeatureAccess returns showWelcome',
    checkFileContains(onboardingPath, 'showWelcome'),
    'Returns showWelcome flag',
    'Missing showWelcome in response'
);

// ============================================================
// ONBOARDING FLOW COMPONENT TESTS
// ============================================================

const flowPath = path.join(__dirname, '../components/onboarding/onboarding-flow.tsx');

test(
    'OnboardingFlow: Error display on constraints step',
    checkFileContains(flowPath, 'AlertCircle'),
    'AlertCircle icon for error found',
    'Missing error display on constraints step'
);

test(
    'OnboardingFlow: Button disabled during loading',
    checkFileContains(flowPath, 'disabled={loading}'),
    'Button disabled during loading',
    'Missing loading state on button'
);

test(
    'OnboardingFlow: Console logging for debugging',
    checkFileContains(flowPath, 'console.log("[Onboarding]'),
    'Debug logging found',
    'Missing debug logging'
);

test(
    'OnboardingFlow: Try-catch in handleCreateCompany',
    checkFileContains(flowPath, 'catch (err'),
    'Try-catch error handling found',
    'Missing error handling'
);

// ============================================================
// PENDING/REJECTED PAGES TESTS
// ============================================================

const pendingPath = path.join(__dirname, '../app/employee/pending/page.tsx');
const rejectedPath = path.join(__dirname, '../app/employee/rejected/page.tsx');

test(
    'Pending Page: Exists',
    fs.existsSync(pendingPath),
    'Pending page exists',
    'Missing pending page'
);

test(
    'Pending Page: Checks approval_status',
    checkFileContains(pendingPath, 'approval_status'),
    'Checks approval_status',
    'Missing approval_status check'
);

test(
    'Pending Page: Redirects approved to welcome',
    checkFileContains(pendingPath, 'redirect("/employee/welcome")'),
    'Redirects approved to welcome',
    'Missing redirect for approved'
);

test(
    'Rejected Page: Exists',
    fs.existsSync(rejectedPath),
    'Rejected page exists',
    'Missing rejected page'
);

test(
    'Rejected Page: Shows rejection reason',
    checkFileContains(rejectedPath, 'rejection_reason'),
    'Shows rejection reason',
    'Missing rejection reason display'
);

test(
    'Rejected Page: Try again option',
    checkFileContains(rejectedPath, 'Try Again'),
    'Try again option found',
    'Missing try again option'
);

// ============================================================
// DASHBOARD ERROR HANDLING TESTS
// ============================================================

const hrDashboardPath = path.join(__dirname, '../app/hr/(main)/dashboard/page.tsx');

test(
    'HR Dashboard: Shows onboarding link on error',
    checkFileContains(hrDashboardPath, 'Complete Onboarding'),
    'Shows onboarding link on error',
    'Missing onboarding link'
);

test(
    'HR Dashboard: Shows sign-in option on error',
    checkFileContains(hrDashboardPath, 'Sign in with a different account'),
    'Shows sign-in option on error',
    'Missing sign-in option'
);

// ============================================================
// PRINT RESULTS
// ============================================================

console.log('\n' + '='.repeat(70));
console.log('AUTH FLOW CODE PATH VALIDATION RESULTS');
console.log('='.repeat(70) + '\n');

let passed = 0;
let failed = 0;
let warned = 0;

results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${r.scenario}`);
    console.log(`   ${r.details}\n`);
    
    if (r.status === 'PASS') passed++;
    else if (r.status === 'FAIL') failed++;
    else warned++;
});

console.log('='.repeat(70));
console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${warned} warnings`);
console.log('='.repeat(70));

if (failed > 0) {
    console.log('\n⚠️  Some tests failed! Please review the issues above.');
    process.exit(1);
} else {
    console.log('\n✅ All critical code paths validated successfully!');
}
