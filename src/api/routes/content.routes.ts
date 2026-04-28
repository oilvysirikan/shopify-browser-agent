import express from 'express';
import { contentService } from '../../services/content.service';
import { prisma } from '../../../server';
import { contentGenerationQueue } from '../../queue/queue.config';

const router = express.Router();

// Generate product description
router.post('/generate-description', async (req, res) => {
  try {
    const { productId, tone, language, length } = req.body;
    const tenantId = req.tenant?.id; // Assuming tenant is set by auth middleware

    // In a real implementation, you would fetch the product from Shopify
    const product = await fetchShopifyProduct(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const result = await contentService.generateProductDescription(
      {
        title: product.title,
        currentDescription: product.descriptionHtml,
        vendor: product.vendor,
        productType: product.productType,
        tags: product.tags,
      },
      { tone, language, length }
    );

    // Save to database
    const contentGeneration = await contentService.saveGeneratedContent({
      productId,
      productGid: product.id,
      contentType: 'description',
      originalContent: product.descriptionHtml,
      generatedContent: result.content,
      prompt: `Generate ${tone} ${language} description`,
      model: result.model,
      tone,
      language,
      tokensUsed: result.tokensUsed,
      tenantId,
    });

    res.json({
      success: true,
      data: {
        id: contentGeneration.id,
        generatedContent: result.content,
        tokensUsed: result.tokensUsed,
      },
    });
  } catch (error: any) {
    console.error('Error generating description:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate description',
    });
  }
});

// Generate SEO metadata
router.post('/generate-seo', async (req, res) => {
  try {
    const { productId, keywords } = req.body;
    const tenantId = req.tenant?.id;

    const product = await fetchShopifyProduct(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const seoData = await contentService.generateSEOMetadata(
      {
        title: product.title,
        description: product.descriptionHtml || '',
        keywords,
      },
      'th'
    );

    // Save to database
    const contentGeneration = await contentService.saveGeneratedContent({
      productId,
      productGid: product.id,
      contentType: 'seo_metadata',
      originalContent: JSON.stringify({
        title: product.title,
        description: product.descriptionHtml,
      }),
      generatedContent: JSON.stringify(seoData),
      prompt: 'Generate SEO metadata',
      model: 'gpt-4',
      language: 'th',
      tenantId,
    });

    res.json({
      success: true,
      data: {
        ...seoData,
        id: contentGeneration.id,
      },
    });
  } catch (error: any) {
    console.error('Error generating SEO metadata:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate SEO metadata',
    });
  }
});

// Approve generated content
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { applyToShopify = false } = req.body;

    const content = await prisma.contentGeneration.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: req.user?.id || 'system',
      },
    });

    if (applyToShopify) {
      // In a real implementation, update the product in Shopify
      await updateShopifyProduct(content.productGid, {
        descriptionHtml: content.generatedContent,
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error: any) {
    console.error('Error approving content:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve content',
    });
  }
});

// Batch generate content
router.post('/batch-generate', async (req, res) => {
  try {
    const { productIds, tone, language } = req.body;
    const tenantId = req.tenant?.id;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'productIds must be a non-empty array',
      });
    }

    // Add to queue
    const jobId = await contentService.queueBatchGeneration(productIds, {
      tone,
      language,
      tenantId,
    });

    res.json({
      success: true,
      jobId,
      message: `Queued ${productIds.length} products for content generation`,
    });
  } catch (error: any) {
    console.error('Error queuing batch generation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue batch generation',
    });
  }
});

// Get content generation history
router.get('/history', async (req, res) => {
  try {
    const { productId, status, limit = 20, offset = 0 } = req.query;
    const tenantId = req.tenant?.id;

    const where: any = { tenantId };
    if (productId) where.productId = productId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.contentGeneration.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contentGeneration.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('Error fetching content history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch content history',
    });
  }
});

// Helper function to fetch product from Shopify (placeholder)
async function fetchShopifyProduct(productId: string) {
  // Implement Shopify API call to fetch product
  return {
    id: productId,
    title: 'Sample Product',
    descriptionHtml: 'Sample product description',
    vendor: 'Sample Vendor',
    productType: 'Sample Type',
    tags: ['sample', 'test'],
  };
}

// Helper function to update product in Shopify (placeholder)
async function updateShopifyProduct(productGid: string, data: any) {
  // Implement Shopify API call to update product
  console.log(`Updating product ${productGid} with data:`, data);
  return { success: true };
}

export default router;
