#!/usr/bin/env node

/**
 * Fix script: Re-process artwork to extract visual_elements
 * Usage: pnpm exec tsx scripts/fix-visual-elements.ts [lessonId]
 */

import '@/scripts/load-env';
import { createPrismaClient } from '@/lib/db/client';
import { getQwenVLClient } from '@/lib/ocr/qwen-vl-client';
import { TriageService } from '@/lib/upload/triage-service';
import { getLocalUploadDir } from '@/lib/storage/paths';
import path from 'path';

const prisma = createPrismaClient();
const ocrClient = getQwenVLClient();
const triageService = new TriageService(prisma);

const LOCAL_UPLOAD_DIR = getLocalUploadDir();

function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  if (filePath.startsWith('uploads/')) {
    return path.join(process.cwd(), filePath);
  }
  const normalized = filePath.startsWith('uploads/')
    ? filePath.replace(/^uploads\//, '')
    : filePath;
  return path.join(LOCAL_UPLOAD_DIR, normalized);
}

async function fixVisualElements(lessonId?: number) {
  console.log(`\n🔧 Fixing visual_elements for artwork...\n`);

  // Find artwork with empty visual_elements
  const uploads = await prisma.upload.findMany({
    where: {
      ...(lessonId ? { lessonId } : {}),
      workType: {
        contains: '绘画',
      },
      OR: [{ visualElements: null }, { visualElements: '[]' }],
    },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${uploads.length} artwork records to fix\n`);

  let processed = 0;
  let errors = 0;

  for (const upload of uploads) {
    console.log(`\n📝 Processing upload #${upload.id}...`);
    console.log(`   File: ${upload.filePath}`);
    console.log(`   Type: ${upload.workType}`);

    try {
      const fullPath = resolveFilePath(upload.filePath);
      console.log(`   Path: ${fullPath}`);

      // Re-run OCR
      const ocrResult = await ocrClient.recognizeImage(fullPath);

      console.log(`   ✓ OCR complete`);
      console.log(`     - Visual elements: [${ocrResult.visualElements.join(', ')}]`);
      console.log(`     - Description: ${ocrResult.description.substring(0, 50)}...`);

      // Re-triage
      const triageResult = await triageService.triageUpload(upload.id, ocrResult);

      // Update database
      await triageService.updateUploadWithTriageResult(upload.id, ocrResult, triageResult);

      console.log(`   ✓ Database updated`);
      processed++;
    } catch (error) {
      console.error(`   ✗ Error:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Complete! Processed: ${processed}, Errors: ${errors}`);
}

async function main() {
  const lessonId = process.argv[2] ? parseInt(process.argv[2]) : undefined;

  if (lessonId) {
    console.log(`Fixing lesson ${lessonId} only`);
  }

  try {
    await fixVisualElements(lessonId);
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
