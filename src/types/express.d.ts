import { PrismaClient } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      prisma: PrismaClient;
      shop?: string;
    }
  }
}

export {}; // This file needs to be a module.
