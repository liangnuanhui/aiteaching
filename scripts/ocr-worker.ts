#!/usr/bin/env node

/**
 * OCR Worker
 *
 * Background process for processing uploaded student works:
 * 1. Find pending uploads
 * 2. Perform OCR recognition
 * 3. Triage based on confidence
 * 4. Update database
 *
 * Usage:
 *   pnpm dev              - Development mode with Next.js (auto-restarts)
 *   pnpm worker:dev       - Development mode (auto-restarts on file changes)
 *   pnpm worker           - Production mode (runs forever)
 *   pnpm worker:once      - Single run mode (process all pending, then exit)
 */

import { createPrismaClient } from '@/lib/db/client';
import { getQwenVLClient } from '@/lib/ocr/qwen-vl-client';
import { TriageService } from '@/lib/upload/triage-service';

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_DEV = NODE_ENV === 'development';

// Constants (adjusted based on environment)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = IS_DEV ? 2000 : 5000; // Faster retry in dev
const IDLE_DELAY_MS = IS_DEV ? 3000 : 5000; // Shorter idle time in dev
const BATCH_SIZE = 1; // Process one at a time to avoid database locks

// State
let isRunning = true;
let processedCount = 0;
let errorCount = 0;

/**
 * Color logging for development
 */
const log = {
  info: (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\x1b[36m[${timestamp}]\x1b[0m ${msg}`);
  },
  success: (msg: string) => {
    console.log(`\x1b[32m✓\x1b[0m ${msg}`);
  },
  error: (msg: string) => {
    console.log(`\x1b[31m✗\x1b[0m ${msg}`);
  },
  warning: (msg: string) => {
    console.log(`\x1b[33m⚠\x1b[0m ${msg}`);
  },
  worker: (msg: string) => {
    console.log(`\x1b[35m[Worker]\x1b[0m ${msg}`);
  },
};

/**
 * Initialize services
 */
const prisma = createPrismaClient();
const ocrClient = getQwenVLClient();
const triageService = new TriageService(prisma);

/**
 * Process a single pending upload
 */
async function processPendingUpload(): Promise<boolean> {
  // 1. Find next pending upload (oldest first, with retry limit)
  const upload = await prisma.upload.findFirst({
    where: {
      triageStatus: 'pending',
      retryCount: { lt: MAX_RETRIES },
    },
    orderBy: {
      uploadedAt: 'asc',
    },
  });

  if (!upload) {
    return false; // No more pending uploads
  }

  const uploadId = upload.id;

  try {
    log.info(`Processing upload #${uploadId}...`);

    // 2. Mark as processing
    await prisma.upload.update({
      where: { id: uploadId },
      data: { triageStatus: 'processing' },
    });

    // 3. Perform OCR recognition
    log.worker(`Running OCR on ${upload.filePath.split('/').pop()}...`);
    const ocrResult = await ocrClient.recognizeImage(upload.filePath);

    log.worker(`Recognized: "${ocrResult.studentName}" (${ocrResult.workType})`);

    // 4. Triage based on OCR result
    const triageResult = await triageService.triageUpload(uploadId, ocrResult);

    log.worker(
      `Status: ${triageResult.status} (confidence: ${(triageResult.confidence * 100).toFixed(0)}%)`
    );

    // 5. Update database with results
    await triageService.updateUploadWithTriageResult(uploadId, ocrResult, triageResult);

    log.success(`Successfully processed upload #${uploadId}`);
    processedCount++;

    return true;
  } catch (error) {
    errorCount++;

    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Failed to process upload #${uploadId}: ${errorMessage}`);

    // Update retry count and error message
    const newRetryCount = upload.retryCount + 1;
    const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        retryCount: newRetryCount,
        lastError: errorMessage,
        triageStatus: newStatus,
      },
    });

    if (newStatus === 'failed') {
      log.warning(`Upload #${uploadId} marked as failed after ${MAX_RETRIES} retries`);
    }

    // If it's a rate limit error, wait before continuing
    if (errorMessage.includes('rate limit')) {
      log.warning('Rate limit detected, waiting 60 seconds...');
      await sleep(60000);
    }

    return true; // Continue processing other uploads
  }
}

/**
 * Process all pending uploads
 */
async function processAll(): Promise<void> {
  let hasMore = true;

  while (hasMore && isRunning) {
    hasMore = await processPendingUpload();

    if (!hasMore) {
      log.info('No more pending uploads');
      break;
    }
  }
}

/**
 * Main worker loop (continuous mode)
 */
async function mainLoop(): Promise<void> {
  const envLabel = IS_DEV ? 'development' : 'production';
  log.success(`🤖 OCR Worker started (${envLabel} mode)`);

  if (IS_DEV) {
    log.info('📝 File watching enabled - worker will auto-restart on changes');
  }

  log.info('Press Ctrl+C to stop\n');

  while (isRunning) {
    const hasMore = await processPendingUpload();

    if (!hasMore) {
      // No tasks, wait before checking again
      const waitTime = IDLE_DELAY_MS / 1000;
      if (IS_DEV) {
        log.info(`💤 Idle, waiting ${waitTime}s for new uploads...`);
      } else {
        log.info(`Idle, waiting ${waitTime}s...`);
      }
      await sleep(IDLE_DELAY_MS);
    }
  }
}

/**
 * Single run mode - process all pending and exit
 */
async function singleRun(): Promise<void> {
  log.success('🤖 OCR Worker (single run mode)\n');

  await processAll();

  console.log('');
  log.success(`Done! Processed: ${processedCount}, Errors: ${errorCount}`);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown
 */
function shutdown(signal: string): void {
  console.log('');
  log.warning(`Received ${signal}, shutting down gracefully...`);
  isRunning = false;

  // Give time for current operation to complete
  setTimeout(async () => {
    log.info(`Processed: ${processedCount}, Errors: ${errorCount}`);
    await prisma.$disconnect();
    process.exit(0);
  }, 2000);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Handle graceful shutdown
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Check mode from command line args
  const mode = process.argv[2] || 'continuous';

  try {
    if (mode === 'once') {
      await singleRun();
      await prisma.$disconnect();
      process.exit(0);
    } else {
      await mainLoop();
    }
  } catch (error) {
    log.error(`Fatal error: ${error}`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run
main().catch(error => {
  log.error(`Unhandled error: ${error}`);
  process.exit(1);
});
