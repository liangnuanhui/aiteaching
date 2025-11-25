#!/usr/bin/env node

/**
 * Test multi-model fusion for artwork
 * Usage: pnpm exec tsx scripts/test-multi-model.ts [upload_id]
 */

import '@/scripts/load-env';
import { getMultiModelClient } from '@/lib/ocr/multi-model-client';
import { getLocalUploadDir } from '@/lib/storage/paths';
import { createPrismaClient } from '@/lib/db/client';
import path from 'path';

const prisma = createPrismaClient();
const multiModelClient = getMultiModelClient();

async function testMultiModel(uploadId: number) {
  console.log(`\n🎨 Testing multi-model fusion for upload #${uploadId}...\n`);

  // Get upload record
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
  });

  if (!upload) {
    console.error(`❌ Upload #${uploadId} not found`);
    return;
  }

  console.log(`📁 File: ${upload.filePath}`);
  console.log(`🎭 Work type: ${upload.workType || 'Not analyzed'}\n`);

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
  console.log(`🤖 Running multi-model analysis (Qwen30B + Qwen235B)...\n`);

  try {
    const startTime = Date.now();
    const fusedResult = await multiModelClient.analyzeImageMultiModel(fullPath);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n⏱️  Analysis completed in ${duration}s\n`);
    console.log(`📊 Multi-Model Fusion Results:`);
    console.log(`├─ Models used: ${fusedResult.detailedResults.length}`);
    console.log(`├─ Fusion method: ${fusedResult.fusionMethod}`);
    console.log(`├─ Model consensus: ${(fusedResult.modelConsensus * 100).toFixed(0)}%`);
    console.log(`├─ Student Name: "${fusedResult.studentName}"`);
    console.log(`├─ Work Type: "${fusedResult.workType}"`);
    console.log(
      `├─ Description (${fusedResult.description.length} chars): "${fusedResult.description}"`
    );
    console.log(
      `├─ Keywords (${fusedResult.keywords.length}): [${fusedResult.keywords.join(', ')}]`
    );
    console.log(
      `├─ Emotions (${fusedResult.emotions.length}): [${fusedResult.emotions.join(', ')}]`
    );
    console.log(
      `└─ Visual Elements (${fusedResult.visualElements.length}): [${fusedResult.visualElements.join(', ')}]`
    );

    if (fusedResult.educationalInsights) {
      console.log(`\n📚 Educational Insights:`);
      console.log(`├─ Observations: "${fusedResult.educationalInsights.observations}"`);
      console.log(`├─ Suggestions: "${fusedResult.educationalInsights.suggestions}"`);
      console.log(
        `├─ Age Appropriateness: "${fusedResult.educationalInsights.ageAppropriateness}"`
      );
      console.log(`└─ Creative Elements: "${fusedResult.educationalInsights.creativeElements}"`);
    }

    console.log(`\n🔬 Individual Model Results:`);
    fusedResult.detailedResults.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.modelName.toUpperCase()} (${result.analysisTime}ms)`);
      console.log(`  ├─ Visual elements: [${result.visualElements.join(', ')}]`);
      console.log(`  ├─ Keywords: [${result.keywords.join(', ')}]`);
      console.log(`  └─ Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    });

    console.log(`\n✅ Multi-model fusion test complete!`);
  } catch (error) {
    console.error(`\n❌ Analysis failed:`, error);
  }
}

async function main() {
  const uploadId = process.argv[2] ? parseInt(process.argv[2]) : 86;

  try {
    await testMultiModel(uploadId);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
