/**
 * API Route: Batch operations for uploads
 * POST /api/uploads/batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { TriageService } from '@/lib/upload/triage-service';

// Use Node.js runtime for Prisma support
export const runtime = 'nodejs';

const prisma = createPrismaClient();
const triageService = new TriageService(prisma);

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = (await request.json()) as {
      action?: string;
      uploadIds?: Array<number | string>;
    };
    const { action, uploadIds } = body;
    const normalizedIds = (uploadIds ?? [])
      .map(id => Number(id))
      .filter(id => Number.isFinite(id)) as number[];

    if (!action || normalizedIds.length === 0) {
      return NextResponse.json({ error: 'action and uploadIds are required' }, { status: 400 });
    }

    // 3. Handle different actions
    if (action === 'confirm_auto_matched') {
      // Batch confirm auto_matched uploads
      const result = await triageService.batchConfirmAutoMatched(
        normalizedIds,
        Number(session.user.id)
      );

      return NextResponse.json({
        success: true,
        confirmed: result.success,
        failed: result.failed,
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to perform batch operation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
