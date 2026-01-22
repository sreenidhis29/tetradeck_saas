
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

// ============================================================
// SECURITY CONFIGURATION
// ============================================================

const SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Rate limiting store (in-memory - use Redis for production cluster)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration per route type
const RATE_LIMITS = {
    api: { windowMs: 60000, maxRequests: 100 },      // 100 req/min for API
    auth: { windowMs: 300000, maxRequests: 10 },     // 10 req/5min for auth
    default: { windowMs: 60000, maxRequests: 200 }   // 200 req/min default
};

// ============================================================
// ROUTE MATCHERS
// ============================================================

const isPublicRoute = createRouteMatcher([
    '/',
    '/marketing(.*)',
    '/privacy(.*)',
    '/terms(.*)',
    '/waitlist(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/employee/auth(.*)',
    '/employee/sign-in(.*)',
    '/employee/sign-up(.*)',
    '/hr/auth(.*)',
    '/hr/sign-in(.*)',
    '/hr/sign-up(.*)',
    '/api/webhook(.*)',
    '/api/holidays(.*)',
    '/api/test-gmail(.*)',
    '/api/test-email(.*)',
    '/api/health(.*)',
    '/api/cron(.*)',
    '/api/enterprise(.*)',
    '/api/waitlist(.*)',
    '/status(.*)',
]);

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)']);
const isEmployeeRoute = createRouteMatcher(['/employee(.*)']);
const isHRRoute = createRouteMatcher(['/hr(.*)']);
const isAPIRoute = createRouteMatcher(['/api(.*)']);
const isAuthRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/auth(.*)']);
const isSensitiveRoute = createRouteMatcher([
    '/api/payroll(.*)',
    '/api/company/settings(.*)',
    '/hr/payroll(.*)',
    '/hr/security(.*)',
]);

// ============================================================
// RATE LIMITING
// ============================================================

function checkRateLimit(identifier: string, config: { windowMs: number; maxRequests: number }): boolean {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);
    
    if (!entry || entry.resetTime < now) {
        rateLimitStore.set(identifier, { count: 1, resetTime: now + config.windowMs });
        return true;
    }
    
    entry.count++;
    if (entry.count > config.maxRequests) {
        return false;
    }
    
    return true;
}

function getClientIP(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
           req.headers.get('x-real-ip') || 
           'unknown';
}

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

function applySecurityHeaders(response: NextResponse): NextResponse {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        response.headers.set(key, value);
    }
    return response;
}

export default clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims } = await auth();
    const ip = getClientIP(req);
    const path = req.nextUrl.pathname;
    
    // ============================================================
    // RATE LIMITING
    // ============================================================
    
    let rateLimitConfig = RATE_LIMITS.default;
    let rateLimitKey = `default:${ip}`;
    
    if (isAuthRoute(req)) {
        rateLimitConfig = RATE_LIMITS.auth;
        rateLimitKey = `auth:${ip}`;
    } else if (isAPIRoute(req)) {
        rateLimitConfig = RATE_LIMITS.api;
        rateLimitKey = `api:${ip}:${path}`;
    }
    
    if (!checkRateLimit(rateLimitKey, rateLimitConfig)) {
        const response = NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429 }
        );
        response.headers.set('Retry-After', '60');
        return applySecurityHeaders(response);
    }
    
    // ============================================================
    // ROUTE PROTECTION
    // ============================================================
    
    // Public routes - no auth needed
    if (isPublicRoute(req)) {
        const response = NextResponse.next();
        return applySecurityHeaders(response);
    }
    
    // Not logged in - redirect to sign-in
    if (!userId) {
        // For API routes, return 401 instead of redirect
        if (isAPIRoute(req)) {
            const response = NextResponse.json(
                { error: 'Unauthorized. Please sign in.' },
                { status: 401 }
            );
            return applySecurityHeaders(response);
        }
        return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    
    // User is logged in but on onboarding - let them continue
    if (isOnboardingRoute(req)) {
        const response = NextResponse.next();
        return applySecurityHeaders(response);
    }
    
    // Log access to sensitive routes
    if (isSensitiveRoute(req)) {
        console.log(`[SECURITY] Sensitive access: ${path} by user ${userId} from ${ip}`);
    }
    
    // For employee/HR routes, we let them through
    // The individual pages will check for profile completion and role
    const response = NextResponse.next();
    return applySecurityHeaders(response);
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
