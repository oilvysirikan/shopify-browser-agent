import request from 'supertest';
import { setupTestServer, teardownTestServer } from './test-utils';
import './test-setup';

describe('Shopify Routes', () => {
  let app: any; // Using any to avoid Express type issues for now
  
  beforeAll(async () => {
    const server = await setupTestServer();
    app = server.app;
  });
  
  afterAll(async () => {
    await teardownTestServer();
  });

  it('should respond to the health check endpoint', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  describe('GET /api/shopify/products', () => {
    it('should return a list of products', async () => {
      const response = await request(app)
        .get('/api/shopify/products')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/shopify/products', () => {
    it('should create a new product', async () => {
      const productData = {
        title: 'Test Product',
        body_html: '<p>Test product description</p>',
        vendor: 'Test Vendor',
        product_type: 'Test Type',
        status: 'active',
      };

      const response = await request(app)
        .post('/api/shopify/products')
        .send(productData)
        .set('Accept', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(productData.title);
    });
  });

  describe('GET /api/shopify/products/:id', () => {
    it('should return a single product', async () => {
      // First create a product to test with
      const createResponse = await request(app)
        .post('/api/shopify/products')
        .send({
          title: 'Test Product',
          body_html: '<p>Test product description</p>',
          vendor: 'Test Vendor',
          product_type: 'Test Type',
        })
        .set('Accept', 'application/json');

      const productId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/shopify/products/${productId}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', productId);
    });
  });
});
