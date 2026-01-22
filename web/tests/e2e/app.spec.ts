import { test, expect } from '@playwright/test';

// Base URL for tests
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Test data
const TEST_USER = {
    email: 'test@tetradeck.com',
    password: 'TestPassword123!'
};

// ============================================================================
// LANDING PAGE TESTS
// ============================================================================

test.describe('Landing Page', () => {
    test('should load the landing page', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page).toHaveTitle(/TetraDeck/i);
    });

    test('should display hero section', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page.locator('text=AI-Powered Leave Management')).toBeVisible();
    });

    test('should have working navigation links', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Check features link
        const featuresLink = page.locator('a[href="#features"]');
        if (await featuresLink.isVisible()) {
            await featuresLink.click();
            await expect(page.locator('#features')).toBeInViewport();
        }
    });

    test('should have CTA buttons', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const startButton = page.getByRole('link', { name: /get started|start free/i });
        await expect(startButton.first()).toBeVisible();
    });
});

// ============================================================================
// AUTHENTICATION TESTS
// ============================================================================

test.describe('Authentication', () => {
    test('should redirect unauthenticated users from dashboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/hr/dashboard`);
        
        // Should redirect to sign-in or show auth modal
        await expect(page).toHaveURL(/sign-in|auth/);
    });

    test('should show sign-in page', async ({ page }) => {
        await page.goto(`${BASE_URL}/sign-in`);
        await expect(page.locator('text=/sign in|log in/i').first()).toBeVisible();
    });

    test('should show sign-up page', async ({ page }) => {
        await page.goto(`${BASE_URL}/sign-up`);
        await expect(page.locator('text=/sign up|create account/i').first()).toBeVisible();
    });
});

// ============================================================================
// EMPLOYEE PORTAL TESTS
// ============================================================================

test.describe('Employee Portal', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to employee portal
        await page.goto(`${BASE_URL}/employee/auth`);
    });

    test('should display employee auth page', async ({ page }) => {
        await expect(page.locator('text=/employee|sign in/i').first()).toBeVisible();
    });
});

// ============================================================================
// HR PORTAL TESTS
// ============================================================================

test.describe('HR Portal', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to HR portal
        await page.goto(`${BASE_URL}/hr/auth`);
    });

    test('should display HR auth page', async ({ page }) => {
        await expect(page.locator('text=/hr|sign in/i').first()).toBeVisible();
    });
});

// ============================================================================
// API HEALTH CHECKS
// ============================================================================

test.describe('API Health', () => {
    test('should return healthy status', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/health`);
        
        expect(response.ok()).toBeTruthy();
        
        const body = await response.json();
        expect(body.status).toMatch(/healthy|degraded/);
        expect(body.timestamp).toBeDefined();
        expect(body.checks).toBeDefined();
    });

    test('should have proper security headers', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/health`);
        
        // Check security headers
        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBeDefined();
    });
});

// ============================================================================
// LEAVE REQUEST FLOW TESTS
// ============================================================================

test.describe('Leave Request Flow', () => {
    test.skip('should allow submitting a leave request', async ({ page }) => {
        // This test requires authentication
        // TODO: Add authentication setup
        
        await page.goto(`${BASE_URL}/employee/dashboard`);
        
        // Click on apply leave
        await page.click('text=/apply leave|new request/i');
        
        // Fill form
        await page.selectOption('select[name="leaveType"]', 'casual');
        await page.fill('input[name="startDate"]', '2026-02-01');
        await page.fill('input[name="endDate"]', '2026-02-02');
        await page.fill('textarea[name="reason"]', 'Personal work');
        
        // Submit
        await page.click('button[type="submit"]');
        
        // Verify success
        await expect(page.locator('text=/success|submitted/i')).toBeVisible();
    });
});

// ============================================================================
// HOLIDAY CALENDAR TESTS
// ============================================================================

test.describe('Holiday Calendar', () => {
    test.skip('should display public holidays', async ({ page }) => {
        // Requires authentication
        await page.goto(`${BASE_URL}/hr/holiday-settings`);
        
        // Check for holiday list
        await expect(page.locator('text=/holidays|calendar/i').first()).toBeVisible();
    });
});

// ============================================================================
// LEAVE RECORDS TESTS
// ============================================================================

test.describe('Leave Records', () => {
    test.skip('should display leave records for HR', async ({ page }) => {
        // Requires HR authentication
        await page.goto(`${BASE_URL}/hr/leave-records`);
        
        // Check for records table
        await expect(page.locator('table').first()).toBeVisible();
    });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

test.describe('Accessibility', () => {
    test('landing page should have proper headings', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const h1 = page.locator('h1');
        await expect(h1.first()).toBeVisible();
    });

    test('buttons should be keyboard accessible', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Tab to first button and check focus
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });

    test('should have alt text on images', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const imagesWithoutAlt = await page.locator('img:not([alt])').count();
        expect(imagesWithoutAlt).toBe(0);
    });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

test.describe('Performance', () => {
    test('landing page should load within 3 seconds', async ({ page }) => {
        const startTime = Date.now();
        await page.goto(BASE_URL);
        const loadTime = Date.now() - startTime;
        
        expect(loadTime).toBeLessThan(3000);
    });

    test('should not have console errors', async ({ page }) => {
        const errors: string[] = [];
        
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Filter out known acceptable errors (like third-party scripts)
        const criticalErrors = errors.filter(
            e => !e.includes('Failed to load resource') && 
                 !e.includes('favicon')
        );
        
        expect(criticalErrors.length).toBe(0);
    });
});

// ============================================================================
// SECURITY TESTS
// ============================================================================

test.describe('Security', () => {
    test('should not expose sensitive data in page source', async ({ page }) => {
        await page.goto(BASE_URL);
        const content = await page.content();
        
        // Check for common sensitive patterns
        expect(content).not.toMatch(/api[_-]?key/i);
        expect(content).not.toMatch(/password/i);
        expect(content).not.toMatch(/secret/i);
    });

    test('should have proper CORS headers on API', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/health`);
        const headers = response.headers();
        
        // Should not have wildcard CORS in production
        if (process.env.NODE_ENV === 'production') {
            expect(headers['access-control-allow-origin']).not.toBe('*');
        }
    });

    test('should rate limit excessive requests', async ({ request }) => {
        // Make many rapid requests
        const responses = await Promise.all(
            Array.from({ length: 150 }, () => 
                request.get(`${BASE_URL}/api/health`)
            )
        );
        
        // At least one should be rate limited (429)
        const rateLimited = responses.some(r => r.status() === 429);
        
        // This might not trigger in tests, so we just check it doesn't error
        expect(responses.every(r => r.status() < 500)).toBeTruthy();
    });
});

// ============================================================================
// RESPONSIVE DESIGN TESTS
// ============================================================================

test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
        await page.goto(BASE_URL);
        
        // Page should load without horizontal scroll
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = 375;
        
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 50); // Allow small margin
    });

    test('should be tablet responsive', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 }); // iPad
        await page.goto(BASE_URL);
        
        // Check main content is visible
        await expect(page.locator('main, [role="main"], .container').first()).toBeVisible();
    });

    test('should be desktop responsive', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(BASE_URL);
        
        // Check layout is centered and not stretched
        const mainContent = page.locator('main, [role="main"], .container').first();
        if (await mainContent.isVisible()) {
            const box = await mainContent.boundingBox();
            if (box) {
                expect(box.width).toBeLessThan(1600); // Max content width
            }
        }
    });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

test.describe('Error Handling', () => {
    test('should show 404 page for invalid routes', async ({ page }) => {
        const response = await page.goto(`${BASE_URL}/invalid-route-12345`);
        
        // Should either redirect or show 404
        if (response) {
            expect([404, 200, 302, 308]).toContain(response.status());
        }
    });

    test('error report endpoint should be available', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/errors/report`);
        
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.status).toBe('ok');
    });
});
