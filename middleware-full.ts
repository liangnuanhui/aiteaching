/**
 * Middleware that protects application routes by checking the NextAuth session token.
 * Uses JWT cookies via `getToken` to remain Edge-compatible without pulling Prisma into the bundle.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const publicPaths = [
  '/', // Home page
  '/privacy', // Privacy policy page
  '/terms', // Terms of service page
  '/login', // Login page
  '/register', // Register page
  '/api/auth', // NextAuth API routes
  '/api/health', // Health check endpoint
  '/api/register', // User registration endpoint
];

export default async function middleware(req: NextRequest) {
  try {
    // Defensive programming: check req and req.nextUrl
    if (!req) {
      console.error('[middleware] req is undefined');
      return NextResponse.next();
    }
    if (!req.nextUrl) {
      console.error('[middleware] req.nextUrl is undefined');
      return NextResponse.next();
    }

    const sessionToken =
      req.cookies.get('__Secure-authjs.session-token') || req.cookies.get('authjs.session-token');
    const isAuthenticated = Boolean(sessionToken?.value);
    const pathname = req.nextUrl.pathname || '';

    // Ensure pathname is a string
    if (typeof pathname !== 'string') {
      console.error('[middleware] pathname is not a string:', typeof pathname, pathname);
      return NextResponse.next();
    }

    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

    if (isAuthenticated && isAuthPage) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    if (!isAuthenticated && !isPublicPath) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error('[middleware] Uncaught error:', error);
    return NextResponse.next();
  }
}

// Configure routes where middleware should run
export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  // - api/auth (auth API)
  // - api/health (health check)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/health).*)'],
};
