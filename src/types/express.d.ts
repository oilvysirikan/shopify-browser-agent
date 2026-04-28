import { PrismaClient } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      prisma: PrismaClient;
      shop?: string;
      file?: Multer.File;
    }

    // Multer file type for file uploads
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination?: string;
        filename?: string;
        path?: string;
        buffer?: Buffer;
        stream?: NodeJS.ReadableStream;
      }
    }
  }
}

export {}; // This file needs to be a module.
