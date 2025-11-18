import { PrismaClient } from '@prisma/client';
import { UserRepository } from './user.repository';
import { PostRepository } from './post.repository';
import { ClassRepository } from './class.repository';
import { StudentRepository } from './student.repository';

/**
 * Repository Factory
 * Create and manage all repository instances
 */
export class RepositoryFactory {
  private userRepo?: UserRepository;
  private postRepo?: PostRepository;
  private classRepo?: ClassRepository;
  private studentRepo?: StudentRepository;

  constructor(private prisma: PrismaClient) {}

  /**
   * Get User Repository
   */
  get users(): UserRepository {
    if (!this.userRepo) {
      this.userRepo = new UserRepository(this.prisma);
    }
    return this.userRepo;
  }

  /**
   * Get Post Repository
   */
  get posts(): PostRepository {
    if (!this.postRepo) {
      this.postRepo = new PostRepository(this.prisma);
    }
    return this.postRepo;
  }

  /**
   * Get Class Repository
   */
  get classes(): ClassRepository {
    if (!this.classRepo) {
      this.classRepo = new ClassRepository(this.prisma);
    }
    return this.classRepo;
  }

  /**
   * Get Student Repository
   */
  get students(): StudentRepository {
    if (!this.studentRepo) {
      this.studentRepo = new StudentRepository(this.prisma);
    }
    return this.studentRepo;
  }
}

/**
 * Create Repository Factory instance
 */
export function createRepositories(prisma: PrismaClient): RepositoryFactory {
  return new RepositoryFactory(prisma);
}

// Export all repositories
export { UserRepository } from './user.repository';
export { PostRepository } from './post.repository';
export { ClassRepository } from './class.repository';
export { StudentRepository } from './student.repository';
