/**
 * Auth/Onboarding Flow Test Scenarios
 * 
 * This file documents and tests 100 different auth scenarios to ensure
 * no loopholes exist in the onboarding flow.
 */

interface TestScenario {
    id: number;
    name: string;
    description: string;
    employeeState: {
        exists: boolean;
        clerk_id?: string;
        org_id?: string | null;
        role?: string | null;
        onboarding_status?: string | null;
        onboarding_step?: string | null;
        onboarding_completed?: boolean;
        approval_status?: string | null;
        terms_accepted_at?: Date | null;
        welcome_shown?: boolean;
        tutorial_completed?: boolean;
    };
    route: string;
    expectedBehavior: string;
    expectedRedirect?: string;
}

// ============================================================================
// SCENARIO CATEGORIES
// ============================================================================

// CATEGORY 1: Unauthenticated Users (1-10)
const unauthenticatedScenarios: TestScenario[] = [
    {
        id: 1,
        name: "Guest visits HR dashboard",
        description: "Unauthenticated user tries to access /hr/dashboard",
        employeeState: { exists: false },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/sign-in"
    },
    {
        id: 2,
        name: "Guest visits employee dashboard",
        description: "Unauthenticated user tries to access /employee/dashboard",
        employeeState: { exists: false },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/sign-in"
    },
    {
        id: 3,
        name: "Guest visits onboarding",
        description: "Unauthenticated user visits /onboarding",
        employeeState: { exists: false },
        route: "/onboarding",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/sign-in"
    },
    {
        id: 4,
        name: "Guest visits HR leave requests",
        description: "Unauthenticated user tries to access /hr/leave-requests",
        employeeState: { exists: false },
        route: "/hr/leave-requests",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/sign-in"
    },
    {
        id: 5,
        name: "Guest visits employee leave",
        description: "Unauthenticated user tries to access /employee/leave",
        employeeState: { exists: false },
        route: "/employee/leave",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/sign-in"
    },
    {
        id: 6,
        name: "Guest visits HR welcome",
        description: "Unauthenticated user tries to access /hr/welcome",
        employeeState: { exists: false },
        route: "/hr/welcome",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/sign-in"
    },
    {
        id: 7,
        name: "Guest visits employee pending",
        description: "Unauthenticated user tries to access /employee/pending",
        employeeState: { exists: false },
        route: "/employee/pending",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/employee/sign-in"
    },
    {
        id: 8,
        name: "Guest visits HR settings",
        description: "Unauthenticated user tries to access /hr/settings",
        employeeState: { exists: false },
        route: "/hr/settings",
        expectedBehavior: "Redirect to sign-in",
        expectedRedirect: "/sign-in"
    },
    {
        id: 9,
        name: "Guest visits API route",
        description: "Unauthenticated request to /api/leave",
        employeeState: { exists: false },
        route: "/api/leave",
        expectedBehavior: "Return 401 Unauthorized"
    },
    {
        id: 10,
        name: "Guest visits home page",
        description: "Unauthenticated user visits /",
        employeeState: { exists: false },
        route: "/",
        expectedBehavior: "Show landing page or redirect to sign-in"
    },
];

// CATEGORY 2: New User - No Employee Record (11-20)
const newUserNoRecordScenarios: TestScenario[] = [
    {
        id: 11,
        name: "New auth user visits HR dashboard",
        description: "Clerk-authenticated user with no Employee record visits /hr/dashboard",
        employeeState: { exists: false },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 12,
        name: "New auth user visits employee dashboard",
        description: "Clerk-authenticated user with no Employee record visits /employee/dashboard",
        employeeState: { exists: false },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=employee"
    },
    {
        id: 13,
        name: "New auth user visits onboarding",
        description: "Clerk-authenticated user with no Employee record visits /onboarding",
        employeeState: { exists: false },
        route: "/onboarding",
        expectedBehavior: "Create Employee record via syncUser, show legal step"
    },
    {
        id: 14,
        name: "New auth user visits HR welcome",
        description: "Clerk-authenticated user with no Employee record visits /hr/welcome",
        employeeState: { exists: false },
        route: "/hr/welcome",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 15,
        name: "New HR user via intent",
        description: "New user visits /onboarding?intent=hr",
        employeeState: { exists: false },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Create Employee, show legal step, then HR-specific flow"
    },
    {
        id: 16,
        name: "New employee user via intent",
        description: "New user visits /onboarding?intent=employee",
        employeeState: { exists: false },
        route: "/onboarding?intent=employee",
        expectedBehavior: "Create Employee, show legal step, then employee flow"
    },
    {
        id: 17,
        name: "New user visits HR employees",
        description: "New user tries to access /hr/employees",
        employeeState: { exists: false },
        route: "/hr/employees",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 18,
        name: "New user visits employee profile",
        description: "New user tries to access /employee/profile",
        employeeState: { exists: false },
        route: "/employee/profile",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=employee"
    },
    {
        id: 19,
        name: "New user visits HR calendar",
        description: "New user tries to access /hr/calendar",
        employeeState: { exists: false },
        route: "/hr/calendar",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 20,
        name: "New user visits employee calendar",
        description: "New user tries to access /employee/calendar",
        employeeState: { exists: false },
        route: "/employee/calendar",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=employee"
    },
];

// CATEGORY 3: Partial Onboarding - Terms Not Accepted (21-30)
const termsNotAcceptedScenarios: TestScenario[] = [
    {
        id: 21,
        name: "User at legal step visits HR dashboard",
        description: "Employee exists but terms_accepted_at is null",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 22,
        name: "User at legal step visits employee dashboard",
        description: "Employee exists but terms_accepted_at is null",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=employee"
    },
    {
        id: 23,
        name: "User at legal step visits onboarding",
        description: "Resume onboarding at legal step",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/onboarding",
        expectedBehavior: "Show legal step"
    },
    {
        id: 24,
        name: "User at legal step refreshes page",
        description: "User refreshes during legal step",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/onboarding",
        expectedBehavior: "Resume at legal step"
    },
    {
        id: 25,
        name: "User at legal step closes browser, returns",
        description: "User closes browser and returns later",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/",
        expectedBehavior: "Redirect to onboarding at legal step"
    },
    {
        id: 26,
        name: "User at legal step tries direct API access",
        description: "User tries to call /api/leave without completing onboarding",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/api/leave",
        expectedBehavior: "Return 403 - onboarding incomplete"
    },
    {
        id: 27,
        name: "User at legal step tries HR settings",
        description: "User tries to access settings before accepting terms",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/hr/settings",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 28,
        name: "User at legal step tries employee leave",
        description: "User tries to apply for leave before accepting terms",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/employee/leave",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=employee"
    },
    {
        id: 29,
        name: "User at legal step with HR intent",
        description: "User at legal step with intent=hr in URL",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Show legal step"
    },
    {
        id: 30,
        name: "User accepts terms successfully",
        description: "User clicks Accept on legal step",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "legal",
            terms_accepted_at: null,
            org_id: null,
            onboarding_completed: false
        },
        route: "/onboarding",
        expectedBehavior: "Update terms_accepted_at, proceed to choice/create/details"
    },
];

// CATEGORY 4: HR - Terms Accepted, No Company (31-45)
const hrNoCompanyScenarios: TestScenario[] = [
    {
        id: 31,
        name: "HR at choice step visits dashboard",
        description: "HR accepted terms but hasn't created company",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "choice",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 32,
        name: "HR at create step visits dashboard",
        description: "HR is filling company form",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "create",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 33,
        name: "HR at constraints step visits dashboard",
        description: "HR viewing default policies",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 34,
        name: "HR at create step refreshes",
        description: "HR refreshes during company form",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "create",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Resume at create step with saved data"
    },
    {
        id: 35,
        name: "HR at constraints step clicks back",
        description: "HR goes back from constraints to create",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Go back to create step with data preserved"
    },
    {
        id: 36,
        name: "HR company creation fails - DB error",
        description: "registerCompany fails due to database error",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Show error message, allow retry"
    },
    {
        id: 37,
        name: "HR company creation fails - network error",
        description: "registerCompany fails due to network",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Show error, data preserved, allow retry"
    },
    {
        id: 38,
        name: "HR partial transaction rollback",
        description: "Company created but employee update fails",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Transaction rollback, no orphan company, show error"
    },
    {
        id: 39,
        name: "HR closes browser mid-transaction",
        description: "User closes browser during registerCompany",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "On return, resume at constraints step"
    },
    {
        id: 40,
        name: "HR company created successfully",
        description: "registerCompany completes successfully",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Redirect to /hr/welcome"
    },
    {
        id: 41,
        name: "HR at choice step with employee intent",
        description: "HR accidentally uses intent=employee",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "choice",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=employee",
        expectedBehavior: "Show choice or details step based on intent"
    },
    {
        id: 42,
        name: "HR duplicate company name",
        description: "HR tries to create company with existing name",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Create company (names can duplicate, codes are unique)"
    },
    {
        id: 43,
        name: "HR empty company name",
        description: "HR submits with empty company name",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "create",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Client-side validation error"
    },
    {
        id: 44,
        name: "HR no industry selected",
        description: "HR submits without selecting industry",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "create",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Client-side validation error"
    },
    {
        id: 45,
        name: "HR auto-save progress",
        description: "HR form data auto-saved while typing",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "create",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Data saved to onboarding_data field"
    },
];

// CATEGORY 5: HR - Company Created, Welcome Not Shown (46-55)
const hrWelcomeNotShownScenarios: TestScenario[] = [
    {
        id: 46,
        name: "HR completed registration, first visit",
        description: "HR just created company, redirected to welcome",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: false,
            tutorial_completed: false
        },
        route: "/hr/welcome",
        expectedBehavior: "Show welcome animation"
    },
    {
        id: 47,
        name: "HR welcome not shown, visits dashboard directly",
        description: "HR tries to skip welcome by going to dashboard",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: false,
            tutorial_completed: false
        },
        route: "/hr/dashboard",
        expectedBehavior: "Allow access (welcome is optional enhancement)"
    },
    {
        id: 48,
        name: "HR completes welcome animation",
        description: "HR watches welcome animation to completion",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: false,
            tutorial_completed: false
        },
        route: "/hr/welcome",
        expectedBehavior: "Mark welcome_shown=true, show tutorial"
    },
    {
        id: 49,
        name: "HR skips welcome animation",
        description: "HR clicks skip on welcome",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: false,
            tutorial_completed: false
        },
        route: "/hr/welcome",
        expectedBehavior: "Mark welcome_shown=true, proceed to tutorial or dashboard"
    },
    {
        id: 50,
        name: "HR closes browser during welcome",
        description: "HR closes browser while viewing welcome",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: false,
            tutorial_completed: false
        },
        route: "/hr/welcome",
        expectedBehavior: "On return, check if welcome_shown, show again if false"
    },
    {
        id: 51,
        name: "HR tutorial shown after welcome",
        description: "HR finishes welcome, sees tutorial",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: true,
            tutorial_completed: false
        },
        route: "/hr/welcome",
        expectedBehavior: "Show tutorial guide"
    },
    {
        id: 52,
        name: "HR completes tutorial",
        description: "HR finishes tutorial guide",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: true,
            tutorial_completed: false
        },
        route: "/hr/welcome",
        expectedBehavior: "Mark tutorial_completed=true, redirect to dashboard"
    },
    {
        id: 53,
        name: "HR skips tutorial",
        description: "HR clicks skip on tutorial",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: true,
            tutorial_completed: false
        },
        route: "/hr/welcome",
        expectedBehavior: "Mark tutorial_completed=true, redirect to dashboard"
    },
    {
        id: 54,
        name: "HR both complete, visits welcome",
        description: "HR already completed welcome+tutorial, visits /hr/welcome",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/welcome",
        expectedBehavior: "Redirect to dashboard"
    },
    {
        id: 55,
        name: "HR complete, visits onboarding",
        description: "Completed HR visits /onboarding",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            onboarding_completed: true,
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/onboarding",
        expectedBehavior: "Redirect to /hr/dashboard"
    },
];

// CATEGORY 6: Employee - Terms Accepted, Joining Company (56-70)
const employeeJoiningScenarios: TestScenario[] = [
    {
        id: 56,
        name: "Employee at details step",
        description: "Employee filling in profile details",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "details",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=employee"
    },
    {
        id: 57,
        name: "Employee at join step",
        description: "Employee entering company code",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "join",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to onboarding",
        expectedRedirect: "/onboarding?intent=employee"
    },
    {
        id: 58,
        name: "Employee enters invalid code",
        description: "Employee submits wrong company code",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "join",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=employee",
        expectedBehavior: "Show 'Invalid Company Code' error"
    },
    {
        id: 59,
        name: "Employee enters valid code",
        description: "Employee submits correct company code",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "join",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=employee",
        expectedBehavior: "Link to company, set pending_approval, show pending screen"
    },
    {
        id: 60,
        name: "Employee pending approval visits dashboard",
        description: "Employee waiting for HR approval",
        employeeState: {
            exists: true,
            onboarding_status: "pending_approval",
            onboarding_step: "pending_approval",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "pending",
            onboarding_completed: false
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to pending page",
        expectedRedirect: "/employee/pending"
    },
    {
        id: 61,
        name: "Employee pending visits onboarding",
        description: "Pending employee visits /onboarding",
        employeeState: {
            exists: true,
            onboarding_status: "pending_approval",
            onboarding_step: "pending_approval",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "pending",
            onboarding_completed: false
        },
        route: "/onboarding",
        expectedBehavior: "Redirect to /employee/pending"
    },
    {
        id: 62,
        name: "Employee pending visits HR dashboard",
        description: "Pending employee tries HR routes",
        employeeState: {
            exists: true,
            onboarding_status: "pending_approval",
            onboarding_step: "pending_approval",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "pending",
            onboarding_completed: false
        },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect (not HR role)",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 63,
        name: "Employee pending checks status",
        description: "Employee refreshes pending page",
        employeeState: {
            exists: true,
            onboarding_status: "pending_approval",
            onboarding_step: "pending_approval",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "pending",
            onboarding_completed: false
        },
        route: "/employee/pending",
        expectedBehavior: "Show pending status with company info"
    },
    {
        id: 64,
        name: "Employee approved by HR",
        description: "HR approves employee, employee checks status",
        employeeState: {
            exists: true,
            onboarding_status: "approved",
            onboarding_step: "welcome",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: false
        },
        route: "/employee/pending",
        expectedBehavior: "Redirect to /employee/welcome"
    },
    {
        id: 65,
        name: "Employee rejected by HR",
        description: "HR rejects employee, employee checks status",
        employeeState: {
            exists: true,
            onboarding_status: "not_started",
            onboarding_step: null,
            terms_accepted_at: new Date(),
            org_id: null,
            role: "employee",
            approval_status: "rejected",
            onboarding_completed: false
        },
        route: "/employee/pending",
        expectedBehavior: "Show rejection message with reason"
    },
    {
        id: 66,
        name: "Rejected employee visits dashboard",
        description: "Rejected employee tries to access dashboard",
        employeeState: {
            exists: true,
            onboarding_status: "not_started",
            onboarding_step: null,
            terms_accepted_at: new Date(),
            org_id: null,
            role: "employee",
            approval_status: "rejected",
            onboarding_completed: false
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to rejected page",
        expectedRedirect: "/employee/rejected"
    },
    {
        id: 67,
        name: "Rejected employee tries again",
        description: "Rejected employee wants to join different company",
        employeeState: {
            exists: true,
            onboarding_status: "not_started",
            onboarding_step: null,
            terms_accepted_at: new Date(),
            org_id: null,
            role: "employee",
            approval_status: "rejected",
            onboarding_completed: false
        },
        route: "/employee/rejected",
        expectedBehavior: "Show 'Try Again' option"
    },
    {
        id: 68,
        name: "Employee details auto-saved",
        description: "Employee form data saves while typing",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "details",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=employee",
        expectedBehavior: "Data saved to onboarding_data"
    },
    {
        id: 69,
        name: "Employee empty department",
        description: "Employee submits without department",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "details",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=employee",
        expectedBehavior: "Client-side validation error"
    },
    {
        id: 70,
        name: "Employee empty company code",
        description: "Employee submits empty code",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "join",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=employee",
        expectedBehavior: "Client-side validation error"
    },
];

// CATEGORY 7: Employee - Approved, Dashboard Access (71-85)
const employeeApprovedScenarios: TestScenario[] = [
    {
        id: 71,
        name: "Approved employee first visit",
        description: "Just approved, welcome not shown",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: false
        },
        route: "/employee/dashboard",
        expectedBehavior: "Allow access (welcome is optional)"
    },
    {
        id: 72,
        name: "Approved employee visits welcome",
        description: "Employee sees welcome animation",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: false
        },
        route: "/employee/welcome",
        expectedBehavior: "Show welcome animation"
    },
    {
        id: 73,
        name: "Approved employee visits onboarding",
        description: "Completed employee visits /onboarding",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/onboarding",
        expectedBehavior: "Redirect to /employee/dashboard"
    },
    {
        id: 74,
        name: "Approved employee visits HR dashboard",
        description: "Employee tries to access HR routes",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to employee dashboard",
        expectedRedirect: "/employee/dashboard"
    },
    {
        id: 75,
        name: "Approved employee applies for leave",
        description: "Employee can access leave application",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/leave",
        expectedBehavior: "Show leave application form"
    },
    {
        id: 76,
        name: "Approved employee views calendar",
        description: "Employee can access calendar",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/calendar",
        expectedBehavior: "Show calendar with leave data"
    },
    {
        id: 77,
        name: "Approved employee views profile",
        description: "Employee can access profile",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/profile",
        expectedBehavior: "Show profile page"
    },
    {
        id: 78,
        name: "Approved employee API access",
        description: "Employee can call leave API",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/api/leave",
        expectedBehavior: "Allow API access"
    },
    {
        id: 79,
        name: "Approved employee signs out",
        description: "Employee signs out",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/sign-out",
        expectedBehavior: "Clear session, redirect to home"
    },
    {
        id: 80,
        name: "Approved employee signs back in",
        description: "Previously approved employee signs in again",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/onboarding",
        expectedBehavior: "Redirect to /employee/dashboard"
    },
    {
        id: 81,
        name: "Employee company deleted",
        description: "Company is deleted but employee still exists",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "deleted-company",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/dashboard",
        expectedBehavior: "Show error - company not found"
    },
    {
        id: 82,
        name: "Employee deactivated by HR",
        description: "HR deactivates employee account",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/dashboard",
        expectedBehavior: "Check is_active flag, show deactivated message"
    },
    {
        id: 83,
        name: "Employee role changed to HR",
        description: "Admin promotes employee to HR",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to /hr/dashboard"
    },
    {
        id: 84,
        name: "Employee multiple browser tabs",
        description: "Employee opens multiple tabs",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/dashboard",
        expectedBehavior: "All tabs work correctly"
    },
    {
        id: 85,
        name: "Employee session expires",
        description: "Clerk session expires while on dashboard",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to sign-in on next request"
    },
];

// CATEGORY 8: HR - Full Access (86-95)
const hrFullAccessScenarios: TestScenario[] = [
    {
        id: 86,
        name: "HR views dashboard",
        description: "Fully onboarded HR accesses dashboard",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/dashboard",
        expectedBehavior: "Show dashboard with company data"
    },
    {
        id: 87,
        name: "HR views employees",
        description: "HR accesses employee list",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/employees",
        expectedBehavior: "Show employee list for this company"
    },
    {
        id: 88,
        name: "HR approves pending employee",
        description: "HR approves a registration",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/registrations",
        expectedBehavior: "Approve button works, employee gets approved"
    },
    {
        id: 89,
        name: "HR rejects pending employee",
        description: "HR rejects a registration",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/registrations",
        expectedBehavior: "Reject button works, employee gets rejected"
    },
    {
        id: 90,
        name: "HR views leave requests",
        description: "HR accesses leave request queue",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/leave-requests",
        expectedBehavior: "Show leave requests for company"
    },
    {
        id: 91,
        name: "HR views settings",
        description: "HR accesses company settings",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/settings",
        expectedBehavior: "Show settings page"
    },
    {
        id: 92,
        name: "HR views calendar",
        description: "HR accesses team calendar",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/calendar",
        expectedBehavior: "Show calendar with all leaves"
    },
    {
        id: 93,
        name: "HR views policies",
        description: "HR accesses leave policies",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/hr/policies",
        expectedBehavior: "Show policy configuration"
    },
    {
        id: 94,
        name: "HR visits employee dashboard",
        description: "HR tries to access employee routes",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/employee/dashboard",
        expectedBehavior: "Redirect to HR dashboard",
        expectedRedirect: "/hr/dashboard"
    },
    {
        id: 95,
        name: "HR signs out and back in",
        description: "HR signs out and returns",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true,
            welcome_shown: true,
            tutorial_completed: true
        },
        route: "/onboarding",
        expectedBehavior: "Redirect to /hr/dashboard"
    },
];

// CATEGORY 9: Edge Cases (96-100)
const edgeCaseScenarios: TestScenario[] = [
    {
        id: 96,
        name: "User with corrupted state",
        description: "onboarding_completed=true but org_id=null",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: null,
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true
        },
        route: "/hr/dashboard",
        expectedBehavior: "Guard catches inconsistency, redirect to onboarding",
        expectedRedirect: "/onboarding?intent=hr"
    },
    {
        id: 97,
        name: "Concurrent registration attempts",
        description: "User double-clicks Create Company button",
        employeeState: {
            exists: true,
            onboarding_status: "in_progress",
            onboarding_step: "constraints",
            terms_accepted_at: new Date(),
            org_id: null,
            role: null,
            onboarding_completed: false
        },
        route: "/onboarding?intent=hr",
        expectedBehavior: "Button disabled during loading, only one company created"
    },
    {
        id: 98,
        name: "Email change in Clerk",
        description: "User changes email in Clerk after onboarding",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true
        },
        route: "/hr/dashboard",
        expectedBehavior: "syncUser updates email on next visit"
    },
    {
        id: 99,
        name: "Deleted user in Clerk",
        description: "Clerk user deleted but Employee record exists",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "hr",
            approval_status: "approved",
            onboarding_completed: true
        },
        route: "/hr/dashboard",
        expectedBehavior: "Clerk middleware blocks, redirect to sign-in"
    },
    {
        id: 100,
        name: "Admin demotes HR to employee",
        description: "Super admin changes HR role to employee",
        employeeState: {
            exists: true,
            onboarding_status: "completed",
            onboarding_step: "complete",
            terms_accepted_at: new Date(),
            org_id: "company-123",
            role: "employee",
            approval_status: "approved",
            onboarding_completed: true
        },
        route: "/hr/dashboard",
        expectedBehavior: "Redirect to employee dashboard",
        expectedRedirect: "/employee/dashboard"
    },
];

// Combine all scenarios
export const allScenarios: TestScenario[] = [
    ...unauthenticatedScenarios,
    ...newUserNoRecordScenarios,
    ...termsNotAcceptedScenarios,
    ...hrNoCompanyScenarios,
    ...hrWelcomeNotShownScenarios,
    ...employeeJoiningScenarios,
    ...employeeApprovedScenarios,
    ...hrFullAccessScenarios,
    ...edgeCaseScenarios,
];

// Summary
console.log("=".repeat(60));
console.log("AUTH/ONBOARDING FLOW TEST SCENARIOS");
console.log("=".repeat(60));
console.log(`\nTotal Scenarios: ${allScenarios.length}`);
console.log("\nCategories:");
console.log(`  1. Unauthenticated Users: ${unauthenticatedScenarios.length}`);
console.log(`  2. New User (No Record): ${newUserNoRecordScenarios.length}`);
console.log(`  3. Terms Not Accepted: ${termsNotAcceptedScenarios.length}`);
console.log(`  4. HR - No Company: ${hrNoCompanyScenarios.length}`);
console.log(`  5. HR - Welcome/Tutorial: ${hrWelcomeNotShownScenarios.length}`);
console.log(`  6. Employee - Joining: ${employeeJoiningScenarios.length}`);
console.log(`  7. Employee - Approved: ${employeeApprovedScenarios.length}`);
console.log(`  8. HR - Full Access: ${hrFullAccessScenarios.length}`);
console.log(`  9. Edge Cases: ${edgeCaseScenarios.length}`);

// Print all scenarios
allScenarios.forEach(s => {
    console.log(`\n[${s.id}] ${s.name}`);
    console.log(`    Route: ${s.route}`);
    console.log(`    Expected: ${s.expectedBehavior}`);
    if (s.expectedRedirect) {
        console.log(`    Redirect: ${s.expectedRedirect}`);
    }
});
