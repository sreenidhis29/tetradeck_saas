# Complete User Journeys - Continuum HR Platform

## Overview

This document defines the COMPLETE user journeys for all roles in the Continuum HR platform. These flows must work exactly as described - no errors, no broken states, no dead ends.

---

## 1. AUTHENTICATION FLOW

### 1.1 Entry Points

| URL | Purpose | Target Role |
|-----|---------|-------------|
| `/sign-in` | Generic sign-in (redirects to role selection) | All |
| `/hr/sign-in` | HR Manager sign-in | HR |
| `/employee/sign-in` | Employee sign-in | Employee |
| `/sign-up` | Generic sign-up (redirects to role selection) | All |
| `/hr/sign-up` | HR Manager registration (create company) | HR |
| `/employee/sign-up` | Employee registration (join company) | Employee |

### 1.2 Sign-In Logic

```
User clicks Sign In
    ↓
Clerk authentication
    ↓
Check if user exists in DB
    ├── YES → Check onboarding_completed
    │         ├── TRUE → Redirect to dashboard (based on role)
    │         └── FALSE → Redirect to /onboarding (with intent)
    └── NO → Create employee record → Redirect to /onboarding
```

---

## 2. HR MANAGER JOURNEY

### 2.1 Pre-Onboarding (First-Time HR)

```
HR visits /hr/sign-up
    ↓
Clerk sign-up (email/Google/etc)
    ↓
Redirect to /onboarding?intent=hr
    ↓
STEP 1: Legal/Compliance Gate
    - Accept terms & conditions
    - Timestamp recorded
    ↓
STEP 2: Create Company
    - Company name (required)
    - Industry (required)
    - Company size (optional)
    - Location (optional)
    - Website (optional)
    ↓
Company created with unique code (e.g., ABC-123)
HR linked as admin with role="hr"
    ↓
STEP 3: Configure Company Settings
    - Work Schedule (start/end time, work days, timezone)
    - Leave Types (CL, SL, PL, ML, PTL, LWP)
    - Leave Policies (auto-approve, escalation rules, blackout dates)
    ↓
OPTIONS:
    [Complete Setup] → Save all settings → Mark onboarding_completed=true
    [Skip for Now] → Use DEFAULT settings → Mark onboarding_completed=true
    ↓
Both options should work WITHOUT ERRORS
    ↓
Redirect to /hr/welcome (first-time animation)
    ↓
Redirect to /hr/dashboard
```

### 2.2 Returning HR (Already Onboarded)

```
HR visits /hr/sign-in
    ↓
Clerk authentication
    ↓
Check employee.onboarding_completed
    ├── TRUE → Redirect to /hr/dashboard
    └── FALSE → Redirect to /onboarding?intent=hr (resume from saved step)
```

### 2.3 HR Dashboard Features

Once onboarded, HR can access:
- `/hr/dashboard` - Main dashboard
- `/hr/employee-registrations` - Approve/reject new employees
- `/hr/leave-requests` - Manage leave requests
- `/hr/employees` - Employee directory
- `/hr/settings` - Company settings
- `/hr/constraint-rules` - Edit leave rules
- `/hr/reports` - Generate reports

---

## 3. EMPLOYEE JOURNEY

### 3.1 Pre-Onboarding (First-Time Employee)

```
Employee visits /employee/sign-up
    ↓
Clerk sign-up (email/Google/etc)
    ↓
Redirect to /onboarding?intent=employee
    ↓
STEP 1: Legal/Compliance Gate
    - Accept terms & conditions
    ↓
STEP 2: Employee Details
    - Department (required)
    - Position/Job Title (required)
    - Work Location (required)
    ↓
STEP 3: Join Company
    - Enter company code (from HR)
    - Code validated against companies table
    ↓
SUCCESS:
    - Employee linked to company (org_id set)
    - Status: pending_approval
    - Notification sent to HR
    ↓
Redirect to /employee/pending
    - Shows "Waiting for HR Approval"
    - Poll for approval status
    ↓
[HR Approves] → Redirect to /employee/welcome → /employee/dashboard
[HR Rejects] → Show rejection reason
```

### 3.2 Returning Employee (Pending Approval)

```
Employee visits /employee/sign-in
    ↓
Check approval_status
    ├── "pending" → Redirect to /employee/pending
    ├── "approved" → Check onboarding_completed
    │               ├── TRUE → /employee/dashboard
    │               └── FALSE → Complete remaining steps
    └── "rejected" → Show /employee/rejected with reason
```

### 3.3 Returning Employee (Already Approved)

```
Employee visits /employee/sign-in
    ↓
onboarding_completed=true AND approval_status="approved"
    ↓
Redirect to /employee/dashboard
```

### 3.4 Employee Dashboard Features

Once approved, Employee can access:
- `/employee/dashboard` - Personal dashboard
- `/employee/leave` - Apply for leave
- `/employee/attendance` - View attendance
- `/employee/profile` - Update profile

---

## 4. CRITICAL STATE MACHINE

### 4.1 Employee States

| State | org_id | onboarding_status | approval_status | onboarding_completed | Destination |
|-------|--------|-------------------|-----------------|----------------------|-------------|
| New (no terms) | null | in_progress | null | false | /onboarding (legal) |
| Terms accepted | null | in_progress | null | false | /onboarding (choice/details) |
| Joined company | set | pending_approval | pending | false | /employee/pending |
| Approved | set | completed | approved | true | /employee/dashboard |
| Rejected | set | rejected | rejected | false | /employee/rejected |

### 4.2 HR States

| State | org_id | role | onboarding_status | onboarding_completed | Destination |
|-------|--------|------|-------------------|----------------------|-------------|
| New (no terms) | null | null | in_progress | false | /onboarding (legal) |
| Company created | set | hr | in_progress | false | /onboarding (constraints) |
| Setup complete | set | hr | completed | true | /hr/dashboard |
| Skipped setup | set | hr | completed | true | /hr/dashboard (with defaults) |

---

## 5. SKIP FOR NOW - CORRECT BEHAVIOR

When HR clicks "Skip for Now" during company settings:

1. **MUST** save default work schedule
2. **MUST** save default leave settings  
3. **MUST** save default approval settings
4. **MUST** seed default leave types (CL, SL, PL, ML, PTL, LWP)
5. **MUST** mark onboarding_completed = true
6. **MUST** mark onboarding_status = 'completed'
7. **MUST** redirect to /hr/welcome without errors

**NO ERRORS SHOULD OCCUR** - defaults are saved silently.

---

## 6. CONSTRAINT ENGINE INTEGRATION

When HR saves company settings (or skips with defaults):

### 6.1 Rules Applied to Constraint Engine

| Setting | Constraint Rule |
|---------|-----------------|
| auto_approve_max_days | RULE001: Max Leave Duration |
| auto_approve_min_notice | RULE006: Advance Notice |
| max_concurrent_leaves | RULE004: Max Concurrent |
| min_team_coverage | RULE003: Team Coverage |
| blackout_dates | RULE005: Blackout Periods |
| escalate_above_days | RULE001: Escalation Threshold |

### 6.2 Leave Quotas

Leave types created → LeaveBalance records created for each employee:
- CL: 12 days/year
- SL: 12 days/year
- PL: 15 days/year (carry forward enabled)
- ML: 182 days (female only)
- PTL: 15 days (male only)
- LWP: 0 (unpaid, unlimited)

---

## 7. ERROR HANDLING

### 7.1 Database Errors
- Show user-friendly message
- Log detailed error server-side
- Provide retry option

### 7.2 Missing Data
- Redirect to correct onboarding step
- Never show broken UI

### 7.3 Permission Errors
- Redirect to appropriate sign-in page
- Show clear message about access requirements

---

## 8. IMPLEMENTATION CHECKLIST

- [ ] HR sign-in redirects correctly based on state
- [ ] Employee sign-in redirects correctly based on state
- [ ] Legal gate works for both roles
- [ ] HR can create company without errors
- [ ] HR can configure settings without errors
- [ ] HR can SKIP settings without errors (defaults applied)
- [ ] Employee can fill details without errors
- [ ] Employee can join company without errors
- [ ] Employee pending page shows correctly
- [ ] HR can approve employees
- [ ] Approved employee redirects to dashboard
- [ ] All constraint rules saved correctly
- [ ] Leave quotas created for new employees
- [ ] Page navigation flows logically
- [ ] No dead ends in any flow

---

## 9. TESTING SCENARIOS

### Scenario 1: New HR Registration
1. Go to /hr/sign-up
2. Create account
3. Accept terms
4. Create company
5. Configure settings (or skip)
6. See welcome animation
7. Access HR dashboard

### Scenario 2: New Employee Registration
1. Go to /employee/sign-up
2. Create account
3. Accept terms
4. Fill employee details
5. Enter company code
6. See pending approval page
7. Wait for HR approval
8. Access employee dashboard

### Scenario 3: HR Skips Setup
1. Complete steps 1-4 of Scenario 1
2. Click "Skip for Now"
3. NO ERRORS
4. Defaults applied
5. Redirected to welcome/dashboard

---

*Document Version: 1.0*
*Last Updated: 2026-01-25*
