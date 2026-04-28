// ES Module wrapper for Prisma client
import { PrismaClient } from '@prisma/client';

// Create a single PrismaClient instance to use throughout the app
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Export the PrismaClient instance
export { prisma };

export default prisma;
