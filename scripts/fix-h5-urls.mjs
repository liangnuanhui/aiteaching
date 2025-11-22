#!/usr/bin/env node
/**
 * Fix H5 courseware URLs after file migration
 * Updates lesson card 22's h5_json to include proper storage URLs
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dbPath = './prisma/dev.db';

try {
  // Get lesson card 22's h5_json
  const jsonStr = execSync(
    `sqlite3 ${dbPath} "SELECT h5_json FROM lesson_cards WHERE id = 22;"`,
    { encoding: 'utf-8' }
  ).trim();

  if (!jsonStr) {
    console.log('❌ Lesson card 22 not found');
    process.exit(1);
  }

  const data = JSON.parse(jsonStr);
  const slides = data.h5_data?.slides || [];
  let updated = false;

  // Update slides with local file references
  slides.forEach((slide, index) => {
    if (slide.type === 'image' || slide.type === 'video') {
      const desc = slide.description;

      // Check if this is a local file reference without URL
      if (desc && !desc.startsWith('http') && desc.includes('.') && !slide.url) {
        // Map description to actual filename
        let actualFilename;
        if (desc.includes('browserleaks')) {
          actualFilename = '1763704576250-browserleaks-webrtc-2025_11_20_21_11_18.png';
        } else if (desc.includes('cursorful')) {
          actualFilename = '1763704682242-cursorful-video-1763352829885.mp4';
        }

        if (actualFilename) {
          slide.url = `/api/storage/local/h5/${actualFilename}`;
          console.log(`✅ Updated slide ${index + 1}: ${slide.title || slide.type}`);
          console.log(`   URL: ${slide.url}`);
          updated = true;
        }
      }
    }
  });

  if (updated) {
    // Write SQL to temp file to avoid shell escaping issues
    const tmpFile = join(tmpdir(), 'fix-h5-urls.sql');
    const newJson = JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000);

    // Write SQL with proper escaping
    const sql = `UPDATE lesson_cards SET h5_json = json('${newJson.replace(/'/g, "''")}'), updated_at = ${timestamp} WHERE id = 22;`;
    writeFileSync(tmpFile, sql);

    // Execute SQL from file
    execSync(`sqlite3 ${dbPath} < ${tmpFile}`, { encoding: 'utf-8' });

    // Clean up
    unlinkSync(tmpFile);

    console.log('\n✅ Database updated successfully!');
    console.log('\n现在可以访问 http://localhost:3000/lessons/22 测试H5课件播放功能');
  } else {
    console.log('\nℹ️  No slides needed URL updates');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
