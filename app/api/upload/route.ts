import { NextRequest, NextResponse } from 'next/server';
import {
  validationErrorResponse,
  notFoundResponse,
  withMiddleware,
  withApiHandler,
} from '@/lib/api';
import { uploadFile, downloadFile } from '@/lib/storage';
import {
  FileSizeExceededError,
  FileUploadError,
  MissingRequiredFieldError,
  AuthenticationError,
  TooManyRequestsError,
  ValidationError,
} from '@/lib/errors';
import { auth } from '@/lib/auth/config';
import { checkUploadRateLimit, checkRateLimit } from '@/lib/rate-limiter';
import { createSignedDownloadUrl, verifySignedUrl } from '@/lib/signed-url';
import { getClientIdentifier, getAdjustedRateLimit } from '@/lib/utils/client-identifier';

export const runtime = 'nodejs';

// Max file size (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Signed URL expiration (1 hour)
const URL_EXPIRATION_SECONDS = 3600;

// POST /api/upload - Upload file to R2
export async function POST(request: NextRequest) {
  return withMiddleware(request, () =>
    withApiHandler(async () => {
      // Check authentication
      const session = await auth();
      if (!session?.user?.id) {
        throw new AuthenticationError('Please login to upload files');
      }

      const userId = session.user.id;

      // Check upload rate limit
      const rateLimit = await checkUploadRateLimit(userId);
      if (!rateLimit.allowed) {
        const resetDate = new Date(rateLimit.resetAt * 1000);
        throw new TooManyRequestsError(
          `Upload rate limit exceeded. You can upload ${rateLimit.limit} files per minute. Please try again after ${resetDate.toLocaleTimeString()}.`,
          {
            limit: rateLimit.limit,
            current: rateLimit.current,
            resetAt: rateLimit.resetAt,
          }
        );
      }

      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        throw new MissingRequiredFieldError('file');
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new FileSizeExceededError(
          `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const key = `h5/${filename}`;

      const stored = await uploadFile(key, file, {
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        },
        contentType: file.type || 'application/octet-stream',
      });

      if (!stored) {
        throw new FileUploadError('Storage not available');
      }

      // Generate signed download URL
      const signedUrl = await createSignedDownloadUrl(
        '/api/upload',
        stored.key,
        URL_EXPIRATION_SECONDS
      );

      return {
        key: stored.key,
        size: stored.size,
        uploaded: stored.uploadedAt,
        url: signedUrl,
        storageUrl: stored.url,
        expiresIn: URL_EXPIRATION_SECONDS,
        contentType: file.type || 'application/octet-stream',
        name: file.name,
        rateLimit: {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt,
        },
      };
    })
  );
}

// GET /api/upload?key=xxx&signature=xxx&expires=xxx - Download file
export async function GET(request: NextRequest) {
  return withMiddleware(request, async () => {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');
    const signature = searchParams.get('signature');
    const expiresStr = searchParams.get('expires');

    if (!key) {
      return validationErrorResponse('File key is required');
    }

    if (!signature || !expiresStr) {
      return validationErrorResponse('Invalid download URL: missing signature or expiration');
    }

    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires)) {
      return validationErrorResponse('Invalid expiration timestamp');
    }

    // Verify signed URL
    const verification = await verifySignedUrl(key, signature, expires);
    if (!verification.valid) {
      throw new ValidationError(verification.reason || 'Invalid or expired download URL');
    }

    // Get client identifier for rate limiting (IP or fingerprint)
    const clientId = await getClientIdentifier(request);

    // Get adjusted rate limit based on identifier type
    const { limit: adjustedLimit, isStrict } = getAdjustedRateLimit(clientId, 30);

    // Check download rate limit with adjusted limit
    const rateLimit = await checkRateLimit(clientId, {
      maxRequests: adjustedLimit,
      windowSeconds: 60,
      keyPrefix: 'rate-limit:download',
    });

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetAt * 1000);
      const strictWarning = isStrict
        ? ' (stricter limit applied due to incomplete client information)'
        : '';
      throw new TooManyRequestsError(
        `Download rate limit exceeded. You can download ${rateLimit.limit} files per minute${strictWarning}. Please try again after ${resetDate.toLocaleTimeString()}.`,
        {
          limit: rateLimit.limit,
          current: rateLimit.current,
          resetAt: rateLimit.resetAt,
          isStrict,
        }
      );
    }

    const fileBuffer = await downloadFile(key);
    if (!fileBuffer) {
      return notFoundResponse(`File not found: ${key}`);
    }

    const ext = key.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      txt: 'text/plain',
      json: 'application/json',
      html: 'text/html',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
    };

    const contentType = contentTypes[ext || ''] || 'application/octet-stream';
    const body = new Uint8Array(fileBuffer);

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'X-RateLimit-Limit': rateLimit.limit.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt.toString(),
      },
    });
  });
}
