/**
 * NextAuth API Route Handler
 * Handles all authentication-related API requests
 */

import { handlers } from '@/lib/auth/config';

// Use Node.js runtime in local development to support Prisma Client
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
