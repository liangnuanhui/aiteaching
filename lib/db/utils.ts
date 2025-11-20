import { Prisma, PrismaClient } from '@prisma/client';

export async function tableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ name: string }[]>(
      Prisma.sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${tableName}`
    );
    return result.length > 0;
  } catch (error) {
    console.warn(`Failed to check table ${tableName}:`, error);
    return false;
  }
}
