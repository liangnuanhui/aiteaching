import { PrismaClient } from '@prisma/client';
import { DatabaseError, DatabaseQueryError } from '@/lib/errors';
import { analytics } from '@/lib/analytics';

/**
 * Student Repository
 * Handles database operations for students
 */
export class StudentRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all students in a class
   */
  async findByClassId(classId: number) {
    try {
      const start = Date.now();
      const students = await this.prisma.student.findMany({
        where: { classId },
        orderBy: { createdAt: 'asc' },
      });
      await analytics.trackDatabaseQuery('student.findByClassId', 'students', Date.now() - start, {
        classId,
      });
      return students;
    } catch (error) {
      throw new DatabaseQueryError('Failed to fetch students for class', error);
    }
  }

  /**
   * Create a new student
   */
  async create(data: { name: string; nickname?: string | null; classId: number }) {
    try {
      const start = Date.now();
      const student = await this.prisma.student.create({
        data: {
          name: data.name,
          nickname: data.nickname ?? null,
          classId: data.classId,
        },
      });
      await analytics.trackDatabaseQuery('student.create', 'students', Date.now() - start, {
        classId: data.classId,
      });
      return student;
    } catch (error) {
      throw new DatabaseError('Failed to create student', error);
    }
  }

  /**
   * Delete a student by id and class
   */
  async delete(id: number, classId: number) {
    try {
      const start = Date.now();
      const result = await this.prisma.student.deleteMany({
        where: { id, classId },
      });
      await analytics.trackDatabaseQuery('student.delete', 'students', Date.now() - start, {
        id,
        classId,
      });
      return result.count;
    } catch (error) {
      throw new DatabaseError('Failed to delete student', error);
    }
  }

  /**
   * Update student nickname
   */
  async updateNickname(id: number, classId: number, nickname: string | null) {
    try {
      const start = Date.now();
      const student = await this.prisma.student.updateMany({
        where: { id, classId },
        data: { nickname },
      });
      await analytics.trackDatabaseQuery('student.updateNickname', 'students', Date.now() - start, {
        id,
        classId,
      });
      return student.count;
    } catch (error) {
      throw new DatabaseError('Failed to update student nickname', error);
    }
  }
}
