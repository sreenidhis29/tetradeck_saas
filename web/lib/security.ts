/**
 * Production Security Utilities
 * Rate limiting, CSRF protection, input validation, and security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// ============================================================
// RATE LIMITING
// ============================================================

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory rate limit store (use Redis in production cluster)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}, 60000); // Clean every minute

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
    identifier?: string;   // Custom identifier (default: IP)
}

export async function checkRateLimit(
    req: NextRequest,
    config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 
               headersList.get('x-real-ip') || 
               'unknown';
    
    const identifier = config.identifier || `rate:${ip}:${req.nextUrl.pathname}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(identifier);
    
    if (!entry || entry.resetTime < now) {
        // Create new window
        entry = {
            count: 1,
            resetTime: now + config.windowMs
        };
        rateLimitStore.set(identifier, entry);
        return { allowed: true, remaining: config.maxRequests - 1, resetTime: entry.resetTime };
    }
    
    entry.count++;
    
    if (entry.count > config.maxRequests) {
        return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }
    
    return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

export function rateLimitResponse(resetTime: number): NextResponse {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter },
        { 
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(resetTime)
            }
        }
    );
}

// ============================================================
// CSRF PROTECTION
// ============================================================

const CSRF_SECRET = process.env.CSRF_SECRET || 'tetradeck-csrf-secret-change-in-prod';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = '__csrf';

export function generateCSRFToken(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const payload = `${timestamp}.${random}`;
    
    // Simple HMAC-like signature (use crypto.createHmac in production)
    const signature = Buffer.from(
        `${payload}:${CSRF_SECRET}`
    ).toString('base64').substring(0, 16);
    
    return `${payload}.${signature}`;
}

export function validateCSRFToken(token: string | null): boolean {
    if (!token) return false;
    
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const [timestamp, random, signature] = parts;
    const payload = `${timestamp}.${random}`;
    
    // Verify signature
    const expectedSignature = Buffer.from(
        `${payload}:${CSRF_SECRET}`
    ).toString('base64').substring(0, 16);
    
    if (signature !== expectedSignature) return false;
    
    // Check token age (24 hour expiry)
    const tokenTime = parseInt(timestamp, 36);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (Date.now() - tokenTime > maxAge) return false;
    
    return true;
}

export async function verifyCSRF(req: NextRequest): Promise<boolean> {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return true;
    }
    
    const headersList = await headers();
    const token = headersList.get(CSRF_TOKEN_HEADER);
    
    return validateCSRFToken(token);
}

// ============================================================
// INPUT VALIDATION & SANITIZATION
// ============================================================

export function sanitizeString(input: unknown): string {
    if (typeof input !== 'string') return '';
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove HTML brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .substring(0, 10000); // Limit length
}

export function sanitizeEmail(email: unknown): string | null {
    if (typeof email !== 'string') return null;
    
    const cleaned = email.trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    
    if (!emailRegex.test(cleaned)) return null;
    if (cleaned.length > 254) return null;
    
    return cleaned;
}

export function sanitizeId(id: unknown): string | null {
    if (typeof id !== 'string') return null;
    
    // Allow UUIDs, alphanumeric IDs, and underscore/hyphen
    const idRegex = /^[a-zA-Z0-9_-]{1,128}$/;
    
    if (!idRegex.test(id)) return null;
    
    return id;
}

export function sanitizeNumber(input: unknown, min?: number, max?: number): number | null {
    const num = Number(input);
    
    if (isNaN(num) || !isFinite(num)) return null;
    if (min !== undefined && num < min) return null;
    if (max !== undefined && num > max) return null;
    
    return num;
}

export function sanitizeDate(input: unknown): Date | null {
    if (!input) return null;
    
    const date = new Date(String(input));
    
    if (isNaN(date.getTime())) return null;
    
    // Reasonable date range (1900 - 2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) return null;
    
    return date;
}

// ============================================================
// SECURITY HEADERS
// ============================================================

export function getSecurityHeaders(): Record<string, string> {
    return {
        // Prevent clickjacking
        'X-Frame-Options': 'DENY',
        
        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        
        // Enable XSS filter
        'X-XSS-Protection': '1; mode=block',
        
        // Referrer policy
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        // Permissions policy
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        
        // Content Security Policy
        'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.clerk.dev https://cdn.clerk.dev https://va.vercel-scripts.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.clerk.dev https://*.clerk.accounts.dev wss://*.clerk.dev https://api.clerk.dev https://vitals.vercel-insights.com",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'"
        ].join('; '),
        
        // Strict Transport Security (HTTPS only)
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    };
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
    const headers = getSecurityHeaders();
    
    for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
    }
    
    return response;
}

// ============================================================
// API KEY VALIDATION (for external integrations)
// ============================================================

const API_KEYS = new Set([
    process.env.INTERNAL_API_KEY,
    process.env.WEBHOOK_API_KEY
].filter(Boolean));

export async function validateAPIKey(req: NextRequest): Promise<boolean> {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key') || headersList.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) return false;
    
    return API_KEYS.has(apiKey);
}

// ============================================================
// REQUEST LOGGING (for audit trail)
// ============================================================

export interface AuditLogEntry {
    timestamp: Date;
    userId?: string;
    action: string;
    resource: string;
    ip: string;
    userAgent: string;
    success: boolean;
    details?: Record<string, unknown>;
}

export async function logSecurityEvent(
    action: string,
    resource: string,
    success: boolean,
    userId?: string,
    details?: Record<string, unknown>
): Promise<void> {
    const headersList = await headers();
    
    const entry: AuditLogEntry = {
        timestamp: new Date(),
        userId,
        action,
        resource,
        ip: headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: headersList.get('user-agent') || 'unknown',
        success,
        details
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.log('[SECURITY]', JSON.stringify(entry, null, 2));
    }
    
    // In production, send to logging service
    // TODO: Integrate with your logging service (e.g., DataDog, LogRocket, etc.)
}

// ============================================================
// SECURE RESPONSE WRAPPER
// ============================================================

export function secureResponse<T>(
    data: T,
    status: number = 200
): NextResponse {
    const response = NextResponse.json(data, { status });
    return applySecurityHeaders(response);
}

export function errorResponse(
    message: string,
    status: number = 400
): NextResponse {
    const response = NextResponse.json({ error: message }, { status });
    return applySecurityHeaders(response);
}

// ============================================================
// IP BLOCKING (for abuse prevention)
// ============================================================

const blockedIPs = new Set<string>();
const suspiciousActivity = new Map<string, number>();

export async function checkIPBlock(req: NextRequest): Promise<boolean> {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    
    return blockedIPs.has(ip);
}

export async function recordSuspiciousActivity(req: NextRequest): Promise<void> {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    
    const count = (suspiciousActivity.get(ip) || 0) + 1;
    suspiciousActivity.set(ip, count);
    
    // Auto-block after 10 suspicious requests
    if (count >= 10) {
        blockedIPs.add(ip);
        await logSecurityEvent('IP_BLOCKED', ip, true, undefined, { reason: 'Excessive suspicious activity' });
    }
}
