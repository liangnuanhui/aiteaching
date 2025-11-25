#!/usr/bin/env node

/**
 * Test script for artwork deep analysis
 * Usage: tsx scripts/test-artwork-analysis.ts [upload_id]
 */

import '@/scripts/load-env';
import { createPrismaClient } from '@/lib/db/client';
import { getQwenVLClient } from '@/lib/ocr/qwen-vl-client';
import { getLocalUploadDir } from '@/lib/storage/paths';
import path from 'path';

const prisma = createPrismaClient();
const ocrClient = getQwenVLClient();

async function testArtworkAnalysis(uploadId: number) {
  console.log(`\n🎨 Testing artwork analysis for upload #${uploadId}...\n`);

  // Get upload record
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
  });

  if (!upload) {
    console.error(`❌ Upload #${uploadId} not found`);
    return;
  }

  console.log(`📁 File: ${upload.filePath}`);
  console.log(`📊 Current status: ${upload.triageStatus}`);
  console.log(`🎭 Work type: ${upload.workType || 'Not analyzed'}`);
  console.log(`🖼️  Visual elements: ${upload.visualElements || '[]'}\n`);

  // Resolve file path
  const LOCAL_UPLOAD_DIR = getLocalUploadDir();
  const fullPath = upload.filePath.startsWith('uploads/')
    ? path.join(process.cwd(), upload.filePath)
    : path.join(LOCAL_UPLOAD_DIR, upload.filePath);

  console.log(`🔍 Full path: ${fullPath}\n`);

  // Check if file exists
  const fs = await import('fs');
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    return;
  }

  console.log(`✅ File exists (${upload.fileSize} bytes)\n`);
  console.log(`🤖 Running OCR analysis...\n`);

  try {
    const result = await ocrClient.recognizeImage(fullPath);

    console.log(`\n📋 OCR Results:`);
    console.log(`├─ Student Name: "${result.studentName}"`);
    console.log(`├─ Work Type: "${result.workType}"`);
    console.log(`├─ Description (${result.description.length} chars): "${result.description}"`);
    console.log(
      `├─ Text Content: "${result.textContent.substring(0, 50)}${result.textContent.length > 50 ? '...' : ''}"`
    );
    console.log(`├─ Keywords: [${result.keywords.join(', ')}]`);
    console.log(`├─ Emotions: [${result.emotions.join(', ')}]`);
    console.log(
      `└─ Visual Elements (${result.visualElements.length}): [${result.visualElements.join(', ')}]`
    );

    if (result.rawResponse) {
      console.log(`\n📝 Raw Response (first 500 chars):`);
      console.log(result.rawResponse.substring(0, 500));
      if (result.rawResponse.length > 500) {
        console.log('...');
      }
    }

    console.log(`\n✅ Analysis complete!`);
  } catch (error) {
    console.error(`\n❌ Analysis failed:`, error);
  }
}

async function main() {
  const uploadId = process.argv[2] ? parseInt(process.argv[2]) : 70;

  try {
    await testArtworkAnalysis(uploadId);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
