/**
 * API Route: Batch operations for uploads
 * POST /api/uploads/batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { TriageService } from '@/lib/upload/triage-service';

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
    const body = await request.json();
    const { action, uploadIds } = body;

    if (!action || !Array.isArray(uploadIds)) {
      return NextResponse.json({ error: 'action and uploadIds are required' }, { status: 400 });
    }

    // 3. Handle different actions
    if (action === 'confirm_auto_matched') {
      // Batch confirm auto_matched uploads
      const result = await triageService.batchConfirmAutoMatched(
        uploadIds,
        Number(session.user.id)
      );

      return NextResponse.json({
        success: true,
        ...result,
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
