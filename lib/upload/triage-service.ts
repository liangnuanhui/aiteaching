/**
 * Triage Service for Student Work Archiving
 *
 * Implements three-state triage logic:
 * - auto_matched (confidence > 0.8): Automatically archived
 * - pending_confirmation (0.6 - 0.8): AI suggestion, teacher confirms
 * - pending_manual (confidence < 0.6): Manual archiving required
 */

import type { PrismaClient } from '@prisma/client';
import type { OCRResult } from '@/lib/ocr/qwen-vl-client';
import { fuzzyMatchStudent, calculateConfidence, type Student } from './fuzzy-match';

interface EducationalInsights {
  observations: string;
  suggestions: string;
  ageAppropriateness: string;
  creativeElements: string;
}

interface ExtendedOCRResult extends OCRResult {
  modelConsensus?: number;
  modelCount?: number;
  educationalInsights?: EducationalInsights;
}

/**
 * Triage status enum
 */
export type TriageStatus =
  | 'pending' // Not processed yet
  | 'processing' // Being processed by worker
  | 'auto_matched' // Confidence > 0.8, automatically archived
  | 'pending_confirmation' // 0.6 <= confidence <= 0.8, needs teacher confirmation
  | 'pending_manual' // Confidence < 0.6, manual archiving required
  | 'confirmed' // Teacher has confirmed the archiving
  | 'failed'; // Processing failed

/**
 * Triage result
 */
export interface TriageResult {
  status: TriageStatus;
  studentId: number | null;
  suggestedStudentId: number | null;
  confidence: number;
  matchType: string;
}

/**
 * Triage thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  AUTO_MATCH: 0.8,
  PENDING_CONFIRMATION: 0.6,
};

/**
 * Triage Service
 */
export class TriageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Triage a single upload based on OCR result
   *
   * @param uploadId - Upload ID
   * @param ocrResult - OCR recognition result
   * @returns Triage result
   */
  async triageUpload(uploadId: number, ocrResult: OCRResult): Promise<TriageResult> {
    // 1. Get upload and related lesson/class info
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        lesson: {
          include: {
            class: {
              include: {
                students: true,
              },
            },
          },
        },
      },
    });

    if (!upload) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    // 2. Get students in the class
    const students: Student[] = upload.lesson.class.students.map(s => ({
      id: s.id,
      name: s.name,
      nickname: s.nickname,
    }));

    // 3. Fuzzy match the recognized name
    const matchResult = fuzzyMatchStudent(ocrResult.studentName, students);

    // 4. Calculate final confidence
    const confidence = calculateConfidence(ocrResult.studentName, matchResult);

    // 5. Determine triage status based on confidence
    let status: TriageStatus;
    let studentId: number | null = null;
    let suggestedStudentId: number | null = null;

    if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_MATCH && matchResult.student) {
      // High confidence: auto match
      status = 'auto_matched';
      studentId = matchResult.student.id;
    } else if (confidence >= CONFIDENCE_THRESHOLDS.PENDING_CONFIRMATION && matchResult.student) {
      // Medium confidence: pending confirmation
      status = 'pending_confirmation';
      suggestedStudentId = matchResult.student.id;
    } else {
      // Low confidence: manual archiving
      status = 'pending_manual';
    }

    return {
      status,
      studentId,
      suggestedStudentId,
      confidence,
      matchType: matchResult.matchType,
    };
  }

  /**
   * Update upload with triage result
   *
   * @param uploadId - Upload ID
   * @param ocrResult - OCR result
   * @param triageResult - Triage result
   */
  async updateUploadWithTriageResult(
    uploadId: number,
    ocrResult: ExtendedOCRResult,
    triageResult: TriageResult
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await this.prisma.upload.update({
      where: { id: uploadId },
      data: {
        // OCR result
        ocrText: ocrResult.textContent,
        recognizedName: ocrResult.studentName,
        ocrConfidence: triageResult.confidence,

        // Content analysis
        workType: ocrResult.workType,
        workDescription: ocrResult.description,
        workKeywords: JSON.stringify(ocrResult.keywords),
        workEmotions: JSON.stringify(ocrResult.emotions),
        visualElements: JSON.stringify(ocrResult.visualElements || []),
        contentExtractedAt: now,

        // Multi-model metadata
        modelConsensus: ocrResult.modelConsensus,
        modelCount: ocrResult.modelCount,
        educationalObservations: ocrResult.educationalInsights?.observations,
        teachingSuggestions: ocrResult.educationalInsights?.suggestions,
        ageAppropriateness: ocrResult.educationalInsights?.ageAppropriateness,
        creativeElements: ocrResult.educationalInsights?.creativeElements,

        // Triage result
        triageStatus: triageResult.status,
        studentId: triageResult.studentId,
        suggestedStudentId: triageResult.suggestedStudentId,

        // Clear error state
        lastError: null,
      },
    });
  }

  /**
   * Confirm a pending upload with teacher's choice
   *
   * @param uploadId - Upload ID
   * @param studentId - Student ID selected by teacher
   * @param teacherId - Teacher ID (for permission check)
   */
  async confirmUpload(uploadId: number, studentId: number, teacherId: number): Promise<void> {
    // 1. Verify permission
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        lesson: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!upload) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    if (upload.lesson.class.teacherId !== teacherId) {
      throw new Error('Permission denied: not the teacher of this class');
    }

    // 2. Verify student belongs to the class
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        classId: upload.lesson.class.id,
      },
    });

    if (!student) {
      throw new Error('Student not found in this class');
    }

    // 3. Update upload
    await this.prisma.upload.update({
      where: { id: uploadId },
      data: {
        studentId,
        triageStatus: 'confirmed',
        archivedAt: Math.floor(Date.now() / 1000),
      },
    });
  }

  /**
   * Batch confirm multiple uploads
   *
   * @param uploadIds - Array of upload IDs
   * @param teacherId - Teacher ID (for permission check)
   */
  async batchConfirmAutoMatched(
    uploadIds: number[],
    teacherId: number
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const uploadId of uploadIds) {
      try {
        // Verify and confirm
        const upload = await this.prisma.upload.findUnique({
          where: { id: uploadId },
          include: {
            lesson: {
              include: {
                class: true,
              },
            },
          },
        });

        if (!upload) {
          failed++;
          continue;
        }

        if (upload.lesson.class.teacherId !== teacherId) {
          failed++;
          continue;
        }

        // Only confirm auto_matched uploads
        if (upload.triageStatus !== 'auto_matched') {
          failed++;
          continue;
        }

        await this.prisma.upload.update({
          where: { id: uploadId },
          data: {
            triageStatus: 'confirmed',
            archivedAt: Math.floor(Date.now() / 1000),
          },
        });

        success++;
      } catch (error) {
        console.error(`Failed to confirm upload ${uploadId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Get triage statistics for a lesson
   *
   * @param lessonId - Lesson ID
   * @returns Triage statistics
   */
  async getTriageStats(lessonId: number): Promise<{
    total: number;
    pending: number;
    autoMatched: number;
    pendingConfirmation: number;
    pendingManual: number;
    confirmed: number;
    failed: number;
  }> {
    const uploads = await this.prisma.upload.findMany({
      where: { lessonId },
      select: { triageStatus: true },
    });

    return {
      total: uploads.length,
      pending: uploads.filter(u => u.triageStatus === 'pending').length,
      autoMatched: uploads.filter(u => u.triageStatus === 'auto_matched').length,
      pendingConfirmation: uploads.filter(u => u.triageStatus === 'pending_confirmation').length,
      pendingManual: uploads.filter(u => u.triageStatus === 'pending_manual').length,
      confirmed: uploads.filter(u => u.triageStatus === 'confirmed').length,
      failed: uploads.filter(u => u.triageStatus === 'failed').length,
    };
  }
}
