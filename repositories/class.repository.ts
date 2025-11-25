import { PrismaClient } from '@prisma/client';
import { DatabaseError, DatabaseQueryError } from '@/lib/errors';
import { getAnalytics } from '@/lib/analytics';

/**
 * Class Repository
 * Handles database operations for teaching classes
 */
export class ClassRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all classes, optionally filtered by teacher
   */
  async findAll(options?: { teacherId?: number }) {
    try {
      const where: { teacherId?: number } = {};

      if (options?.teacherId !== undefined) {
        where.teacherId = options.teacherId;
      }

      const start = Date.now();
      const classes = await this.prisma.class.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      await getAnalytics().trackDatabaseQuery(
        'class.findAll',
        'classes',
        Date.now() - start,
        where
      );
      return classes;
    } catch (error) {
      throw new DatabaseQueryError('Failed to fetch classes', error);
    }
  }

  /**
   * Find class by ID
   */
  async findById(id: number) {
    try {
      const start = Date.now();
      const cls = await this.prisma.class.findUnique({
        where: { id },
      });
      await getAnalytics().trackDatabaseQuery('class.findById', 'classes', Date.now() - start, {
        id,
      });
      return cls;
    } catch (error) {
      throw new DatabaseQueryError(`Failed to fetch class with id ${id}`, error);
    }
  }

  /**
   * Create a new class
   */
  async create(data: { name: string; gradeLevel: string; teacherId: number }) {
    try {
      const start = Date.now();
      const cls = await this.prisma.class.create({
        data: {
          name: data.name,
          gradeLevel: data.gradeLevel,
          teacherId: data.teacherId,
        },
      });
      await getAnalytics().trackDatabaseQuery('class.create', 'classes', Date.now() - start, {
        teacherId: data.teacherId,
      });
      return cls;
    } catch (error) {
      throw new DatabaseError('Failed to create class', error);
    }
  }
}
