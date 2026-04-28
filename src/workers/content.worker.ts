import { contentGenerationQueue } from '../queue/queue.config';
import { contentService } from '../services/content.service';
import { PrismaClient } from '@prisma/client';

// Import our custom BullMQ type definitions
import '../types/bullmq';

const prisma = new PrismaClient();
import { logger } from '../utils/logger';

// Define job data interface
interface ContentGenerationJobData {
  productIds: string[];
  tone: 'professional' | 'casual' | 'luxury';
  language: 'en' | 'th';
  tenantId: string;
  [key: string]: any;
}

// Define job interface
interface Job<T = any> {
  id?: string;
  data: T;
  progress: (value: number) => Promise<void>;
  log: (row: string) => Promise<any>;
  update: (data: any) => Promise<void>;
}

// Process content generation jobs
contentGenerationQueue.process<ContentGenerationJobData, any, 'content-generation'>(async (job: Job<ContentGenerationJobData>) => {
  const { productIds, tone, language, tenantId } = job.data;
  
  logger.info(`Processing content generation job ${job.id} for ${productIds.length} products`, {
    jobId: job.id,
    productCount: productIds.length,
    tone,
    language,
    tenantId,
  });

  const results = {
    total: productIds.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ productId: string; error: string }>,
  };

  for (const productId of productIds) {
    try {
      // Update progress
      const progress = Math.round(((results.success + results.failed) / results.total) * 100);
      await job.progress(progress);

      logger.info(`Generating content for product ${productId}`, {
        jobId: job.id,
        productId,
        progress: `${progress}%`,
      });

      // Fetch product from Shopify
      const product = await fetchShopifyProduct(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Generate content
      const result = await contentService.generateProductDescription(
        {
          title: product.title,
          currentDescription: product.descriptionHtml,
          vendor: product.vendor,
          productType: product.productType,
          tags: product.tags,
        },
        { tone, language, length: 'medium' }
      );

      // Save to database
      await contentService.saveGeneratedContent({
        productId,
        productGid: product.id,
        contentType: 'description',
        originalContent: product.descriptionHtml,
        generatedContent: result.content,
        prompt: `Batch generate ${tone} ${language}`,
        model: result.model,
        tone,
        language,
        tokensUsed: result.tokensUsed,
        tenantId,
      });

      results.success++;
    } catch (error: any) {
      logger.error(`Error generating content for product ${productId}:`, {
        jobId: job.id,
        productId,
        error: error.message,
        stack: error.stack,
      });

      results.failed++;
      results.errors.push({
        productId,
        error: error.message,
      });
    }
  }

  logger.info(`Completed content generation job ${job.id}`, {
    jobId: job.id,
    ...results,
  });

  return results;
});

// Handle queue events
contentGenerationQueue.on('completed', (job: any, result: { success: number; failed: number; total: number }) => {
  logger.info(`Content generation job ${job.id} completed`, {
    jobId: job.id,
    result: {
      success: result.success,
      failed: result.failed,
      total: result.total,
    },
  });
});

contentGenerationQueue.on('failed', (job: any, error: Error) => {
  logger.error(`Content generation job ${job?.id} failed`, {
    jobId: job?.id,
    error: error.message,
    stack: error.stack,
  });
});

contentGenerationQueue.on('error', (error: Error) => {
  logger.error('Content generation queue error:', {
    error: error.message,
    stack: error.stack,
  });
});

// Helper function to fetch product from Shopify (placeholder)
async function fetchShopifyProduct(productId: string) {
  // In a real implementation, this would call the Shopify API
  // For now, return a mock product
  return {
    id: `gid://shopify/Product/${productId}`,
    title: `Product ${productId}`,
    descriptionHtml: `Description for product ${productId}`,
    vendor: 'Sample Vendor',
    productType: 'Sample Type',
    tags: ['sample', 'test'],
  };
}

// Start the worker
logger.info('🚀 Content generation worker started');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down content generation worker...');
  await contentGenerationQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down content generation worker...');
  await contentGenerationQueue.close();
  process.exit(0);
});

export default contentGenerationQueue;
