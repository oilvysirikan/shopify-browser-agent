import { Prisma } from '@prisma/client';

declare module '@prisma/client' {
  // Add custom types or extensions here if needed
  export interface PrismaClient {
    // Custom methods can be added here
  }
}

export {};
