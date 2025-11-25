import { resolve, isAbsolute } from 'path';

// Default upload directory inside project (ignored by webpack watch and git)
const DEFAULT_UPLOAD_DIR = './uploads';

export function getLocalUploadDir(): string {
  const configured = process.env.LOCAL_UPLOAD_DIR;

  if (configured && configured.trim().length > 0) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  return resolve(process.cwd(), DEFAULT_UPLOAD_DIR);
}
