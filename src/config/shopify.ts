import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION, Session } from '@shopify/shopify-api';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredVars = ['SHOPIFY_SHOP', 'SHOPIFY_ACCESS_TOKEN'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Get shop URL without protocol
const shop = process.env.SHOPIFY_SHOP?.replace(/^https?:\/\//, '').replace(/\/$/, '');

// Initialize the Shopify API client
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || 'dummy-key', // Required but not used for custom apps
  apiSecretKey: process.env.SHOPIFY_ACCESS_TOKEN || 'dummy-secret', // Required but not used for custom apps
  adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  scopes: ['read_products', 'write_products', 'read_orders', 'write_orders'],
  hostName: shop || '',
  apiVersion: (process.env.SHOPIFY_API_VERSION as any) || LATEST_API_VERSION,
  isEmbeddedApp: false,
  isCustomStoreApp: true,
});

// Create a session for the Shopify API
export const getShopifySession = (): Session => {
  const session = new Session({
    id: `offline_${process.env.SHOPIFY_SHOP}`,
    shop: process.env.SHOPIFY_SHOP || '',
    state: 'offline',
    isOnline: false,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    scope: 'read_products,write_products,read_orders,write_orders',
  });
  
  return session;
};

// Helper function to make REST API requests
export const makeShopifyRequest = async ({
  path,
  method = 'GET',
  data,
  query,
}: {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  query?: Record<string, any>;
}) => {
  const session = getShopifySession();
  const client = new shopify.clients.Rest({
    session,
    apiVersion: (process.env.SHOPIFY_API_VERSION as any) || LATEST_API_VERSION,
  });

  const request: any = { path };
  if (method) request.method = method;
  if (data) request.data = data;
  if (query) request.query = query;

  return client.get(request);
};

// Helper function to get a Shopify REST client
export const getShopifyClient = () => {
  return {
    // Products
    getProducts: async (params = {}) => {
      return makeShopifyRequest({
        path: 'products',
        query: params,
      });
    },
    
    // Get a single product
    getProduct: async (id: string) => {
      return makeShopifyRequest({
        path: `products/${id}`,
      });
    },
    
    // Create a product
    createProduct: async (productData: any) => {
      return makeShopifyRequest({
        path: 'products',
        method: 'POST',
        data: {
          product: productData,
        },
      });
    },
    
    // Orders
    getOrders: async (params = {}) => {
      return makeShopifyRequest({
        path: 'orders',
        query: params,
      });
    },
    
    // Generic request method
    request: makeShopifyRequest,
  };
};

export default {
  shopify,
  getShopifySession,
  getShopifyClient,
  makeShopifyRequest,
};
