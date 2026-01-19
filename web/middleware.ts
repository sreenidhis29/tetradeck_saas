
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
    '/',
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
    '/api/enterprise(.*)',
]);

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)']);
const isEmployeeRoute = createRouteMatcher(['/employee(.*)']);
const isHRRoute = createRouteMatcher(['/hr(.*)']);

export default clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims } = await auth();
    
    // Public routes - no auth needed
    if (isPublicRoute(req)) {
        return NextResponse.next();
    }
    
    // Not logged in - redirect to sign-in
    if (!userId) {
        return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    
    // User is logged in but on onboarding - let them continue
    if (isOnboardingRoute(req)) {
        return NextResponse.next();
    }
    
    // For employee/HR routes, we let them through
    // The individual pages will check for profile completion
    return NextResponse.next();
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
