import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

declare global {
  namespace NodeJS {
    interface Global {
      prisma: PrismaClient;
    }
  }

  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      tenant?: {
        id: string;
        name: string;
      };
    }
  }
}

declare const prisma: PrismaClient;

export { prisma };
