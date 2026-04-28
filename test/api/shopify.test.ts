import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/app';

describe('Shopify API', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.tenant.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/shopify/register', () => {
    it('should register a new shop successfully', async () => {
      const mockShopData = {
        shop: 'test-shop.myshopify.com',
        sessionToken: 'valid_session_token'
      };

      // Mock Shopify token exchange
      jest.mock('../../src/services/shopify-token.service', () => ({
        exchangeToken: jest.fn().mockResolvedValue({
          access_token: 'mock_access_token',
          scope: 'read_products,write_products',
          expires_in: 3600
        })
      }));

      const response = await request(app)
        .post('/api/v1/shopify/register')
        .send(mockShopData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.shop).toBe(mockShopData.shop);
      expect(response.body.scopes).toContain('read_products');
    });

    it('should return 400 for invalid shop domain', async () => {
      const invalidData = {
        shop: 'invalid-domain.com',
        sessionToken: 'valid_session_token'
      };

      const response = await request(app)
        .post('/api/v1/shopify/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/shopify/products', () => {
    it('should return products list for authenticated shop', async () => {
      // Create test tenant
      const tenant = await prisma.tenant.create({
        data: {
          shop: 'test-shop.myshopify.com',
          plan: 'free',
          isActive: true
        }
      });

      // Mock Shopify service
      jest.mock('../../src/services/shopify-admin.service', () => ({
        listProducts: jest.fn().mockResolvedValue({
          products: [
            {
              id: 'product_1',
              title: 'Test Product',
              handle: 'test-product',
              status: 'active'
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1
          }
        })
      }));

      const response = await request(app)
        .get('/api/v1/shopify/products')
        .set('X-Shopify-Shop-Domain', 'test-shop.myshopify.com')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].title).toBe('Test Product');
    });

    it('should return 401 for unauthorized request', async () => {
      const response = await request(app)
        .get('/api/v1/shopify/products')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Shopify AI API', () => {
  describe('POST /api/v1/shopify-ai/generate', () => {
    it('should generate product description successfully', async () => {
      const generateData = {
        type: 'product_description',
        productId: 'product_123',
        input: {
          title: 'Premium Wireless Headphones',
          style: 'professional'
        }
      };

      // Mock OpenAI service
      jest.mock('../../src/services/openai.service', () => ({
        generateDescription: jest.fn().mockResolvedValue({
          description: 'Experience premium sound quality with these wireless headphones...',
          usage: {
            tokens: 150,
            model: 'gpt-4-turbo-preview'
          }
        })
      }));

      const response = await request(app)
        .post('/api/v1/shopify-ai/generate')
        .send(generateData)
        .set('Authorization', 'Bearer valid_api_key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toContain('premium sound quality');
      expect(response.body.data.usage.tokens).toBe(150);
    });

    it('should return 400 for invalid request data', async () => {
      const invalidData = {
        type: 'product_description',
        productId: '', // Empty product ID
        input: {
          title: 'Test Product'
        }
      };

      const response = await request(app)
        .post('/api/v1/shopify-ai/generate')
        .send(invalidData)
        .set('Authorization', 'Bearer valid_api_key')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
