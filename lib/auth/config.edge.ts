/**
 * Edge-compatible NextAuth Configuration
 * For use in middleware ONLY - does not include database adapter or OIDC providers
 *
 * This configuration is split from the main auth config to avoid Edge Runtime
 * compatibility issues with Prisma adapter and Google OIDC provider.
 * See: https://authjs.dev/guides/edge-compatibility
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfigEdge: NextAuthConfig = {
  // Use JWT strategy (edge compatible) - required for Edge Runtime
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Custom page paths
  pages: {
    signIn: '/login',
    error: '/login',
  },

  // Empty providers array - middleware only checks session, doesn't authenticate
  // Actual authentication happens in API routes with full config
  providers: [],

  // Callback functions for JWT/session handling
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },

    // Authorization callback for middleware route protection
    authorized({ auth, request: { nextUrl } }) {
      const isAuthenticated = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Define public routes that don't require authentication
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

      const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
      const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

      // Redirect authenticated users away from auth pages
      if (isAuthenticated && isAuthPage) {
        return Response.redirect(new URL('/', nextUrl));
      }

      // Allow public paths
      if (isPublicPath) {
        return true;
      }

      // Require authentication for all other routes
      return isAuthenticated;
    },
  },

  // Debug mode (development only)
  debug: process.env.NODE_ENV === 'development',
};
