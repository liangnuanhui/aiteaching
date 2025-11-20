/**
 * Ensures standalone scripts (OCR worker, seeds, etc.) load the same env vars
 * as Next.js by reading .env.local/.env at process startup.
 */

import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const envFiles = ['.env.local', '.env'];

for (const file of envFiles) {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    loadEnv({ path: fullPath, override: false });
  }
}
