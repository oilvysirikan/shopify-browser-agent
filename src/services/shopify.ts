import { config } from '../config';
import { logger } from '../utils/logger';

interface ShopifyRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  data?: any;
  query?: Record<string, string | number | boolean | undefined>;
  accessToken?: string;
}

export async function makeShopifyRequest({
  method = 'GET',
  path,
  data,
  query = {},
  accessToken = config.shopify.accessToken,
}: ShopifyRequestOptions) {
  try {
    // Clean up the path
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Build query string
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    }
    const queryString = queryParams.toString();
    
    // Build URL
    const url = new URL(
      `https://${config.shopify.shop}/admin/api/${config.shopify.apiVersion}/${cleanPath}${queryString ? `?${queryString}` : ''}`
    );

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      'Accept': 'application/json',
    };

    // Log the request
    logger.debug('Making Shopify API request', {
      method,
      url: url.toString(),
      hasData: !!data,
    });

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    // Handle non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.errors || response.statusText;
      
      logger.error('Shopify API error', {
        status: response.status,
        statusText: response.statusText,
        url: url.toString(),
        error: errorMessage,
      });

      throw new Error(
        `Shopify API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorMessage)}`
      );
    }

    // For DELETE requests that return no content
    if (response.status === 204) {
      return null;
    }

    // Parse and return the response
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    logger.error('Error in makeShopifyRequest', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path,
      method,
    });
    throw error;
  }
}

// Helper function to get product by ID
export async function getProduct(productId: string, accessToken?: string) {
  return makeShopifyRequest({
    path: `products/${productId}.json`,
    accessToken,
  });
}

// Helper function to update product
export async function updateProduct(
  productId: string, 
  productData: any, 
  accessToken?: string
) {
  return makeShopifyRequest({
    method: 'PUT',
    path: `products/${productId}.json`,
    data: { product: productData },
    accessToken,
  });
}

// Helper function to get shop info
export async function getShopInfo(accessToken?: string) {
  return makeShopifyRequest({
    path: 'shop.json',
    accessToken,
  });
}

// Initialize the Shopify client
export const shopify = {
  products: {
    get: getProduct,
    update: updateProduct,
  },
  shop: {
    get: getShopInfo,
  },
  request: makeShopifyRequest,
};

export default shopify;
