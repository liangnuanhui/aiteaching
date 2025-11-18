import { PrismaClient } from '@prisma/client';
import { DatabaseError, DatabaseQueryError } from '@/lib/errors';
import { analytics } from '@/lib/analytics';

/**
 * LessonCard Repository
 * Handles database operations for lesson cards (课程卡片)
 */
export class LessonCardRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all lesson cards in a class
   */
  async findByClassId(classId: number) {
    try {
      const start = Date.now();
      const lessons = await this.prisma.lessonCard.findMany({
        where: { classId },
        orderBy: { createdAt: 'desc' },
      });
      await analytics.trackDatabaseQuery(
        'lessonCard.findByClassId',
        'lesson_cards',
        Date.now() - start,
        { classId }
      );
      return lessons;
    } catch (error) {
      throw new DatabaseQueryError('Failed to fetch lessons for class', error);
    }
  }

  /**
   * Create a new lesson card
   */
  async create(data: { title: string; classId: number; h5Json?: string; mdPlan?: string }) {
    try {
      const start = Date.now();
      const lesson = await this.prisma.lessonCard.create({
        data: {
          title: data.title,
          classId: data.classId,
          ...(data.h5Json !== undefined && { h5Json: data.h5Json }),
          ...(data.mdPlan !== undefined && { mdPlan: data.mdPlan }),
        },
      });
      await analytics.trackDatabaseQuery('lessonCard.create', 'lesson_cards', Date.now() - start, {
        classId: data.classId,
      });
      return lesson;
    } catch (error) {
      throw new DatabaseError('Failed to create lesson card', error);
    }
  }
}
