import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productCreateHandler } from '../../../../src/webhooks/productWebhooks';
import { contentGenerationQueue } from '../../../../src/queues/contentGenerationQueue';
import { analyticsQueue } from '../../../../src/queues/analyticsQueue';

// Mock the queue add method
vi.mock('../../../../src/queues/contentGenerationQueue', () => ({
  contentGenerationQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  },
}));

vi.mock('../../../../src/queues/analyticsQueue', () => ({
  analyticsQueue: {
    add: vi.fn().mockResolvedValue({ id: 'analytics-123' }),
  },
}));

describe('Product Webhooks', () => {
  const mockShop = 'test-shop.myshopify.com';
  
  beforeEach(() => {
    // Clear all mocks between tests
    vi.clearAllMocks();
    
    // Mock shop settings
    vi.mock('../../../../src/services/ShopService', () => ({
      getShopSettings: vi.fn().mockResolvedValue({
        autoGenerateContent: true,
        defaultGenerationOptions: {
          tone: 'professional',
          length: 'medium',
        },
      }),
    }));
  });

  describe('productCreateHandler', () => {
    it('should queue content generation when auto-generation is enabled', async () => {
      const payload = {
        id: 'gid://shopify/Product/123',
        title: 'New Product',
        vendor: 'Test Vendor',
        productType: 'Apparel',
        tags: ['new', 'featured'],
      };

      await productCreateHandler.process(payload, {
        shop: mockShop,
        topic: 'products/create',
      });

      // Verify content generation was queued
      expect(contentGenerationQueue.add).toHaveBeenCalledWith({
        productId: '123',
        shopDomain: mockShop,
        options: {
          tone: 'professional',
          length: 'medium',
        },
      });

      // Verify analytics event was logged
      expect(analyticsQueue.add).toHaveBeenCalledWith({
        event: 'product_created',
        shopDomain: mockShop,
        productId: '123',
      });
    });

    it('should not queue content generation when auto-generation is disabled', async () => {
      // Override shop settings mock for this test
      const mockGetShopSettings = await import('../../../../src/services/ShopService').then(m => m.getShopSettings);
      (mockGetShopSettings as any).mockResolvedValueOnce({
        autoGenerateContent: false,
      });

      const payload = {
        id: 'gid://shopify/Product/123',
        title: 'New Product',
      };

      await productCreateHandler.process(payload, {
        shop: mockShop,
        topic: 'products/create',
      });

      // Verify content generation was not queued
      expect(contentGenerationQueue.add).not.toHaveBeenCalled();
      
      // But analytics event should still be logged
      expect(analyticsQueue.add).toHaveBeenCalled();
    });

    it('should handle missing product ID gracefully', async () => {
      const payload = {
        title: 'Product without ID',
      };

      await expect(
        productCreateHandler.process(payload as any, {
          shop: mockShop,
          topic: 'products/create',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('productUpdateHandler', () => {
    it('should handle product updates and trigger re-generation if needed', async () => {
      // This would test the product update handler logic
      // Similar structure to the productCreateHandler tests
    });
  });

  // Add more test cases for error handling, edge cases, etc.
});
