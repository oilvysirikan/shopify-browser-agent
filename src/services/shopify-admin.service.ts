import { prisma } from '../prisma.js';
import { ShopifyTokenService } from './shopify-token.service.js';

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class ShopifyAdminService {
  private tokenService: ShopifyTokenService;

  constructor() {
    this.tokenService = new ShopifyTokenService();
  }

  async getToken(shop: string) {
    return await ShopifyTokenService.getActiveToken(shop);
  }

  /**
   * Make a GraphQL request to the Shopify Admin API
   */
  private async makeRequest<T>(
    shop: string,
    query: string,
    variables: Record<string, any> = {}
  ): Promise<T> {
    try {
      const token = await this.getToken(shop);
      if (!token) {
        throw new Error('No access token found for this shop');
      }

      const response = await fetch(`https://${shop}/admin/api/2023-04/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
      }

      const result: GraphQLResponse<T> = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL Error: ${result.errors[0].message}`);
      }

      return result.data as T;
    } catch (error) {
      console.error('Shopify API Request Error:', error);
      throw error;
    }
  }

  /**
   * Get a product by ID
   */
  async getProduct(shop: string, productId: string) {
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          description
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
              }
            }
          }
        }
      }
    `;

    const response = await this.makeRequest<{ product: any }>(shop, query, {
      id: `gid://shopify/Product/${productId}`
    });

    return response?.product;
  }

  /**
   * Update a product
   */
  async updateProduct(shop: string, productId: string, input: any) {
    const mutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            description
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.makeRequest<{
      productUpdate: {
        product: any;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(shop, mutation, {
      input: {
        id: `gid://shopify/Product/${productId}`,
        ...input
      }
    });

    if (response.productUpdate.userErrors && response.productUpdate.userErrors.length > 0) {
      throw new Error(
        `Failed to update product: ${response.productUpdate.userErrors[0].message}`
      );
    }

    return response.productUpdate.product;
  }

  /**
   * List products
   */
  async listProducts(shop: string, first: number = 10, after?: string) {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              handle
              status
              vendor
              productType
              totalInventory
              publishedAt
              createdAt
              updatedAt
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await this.makeRequest<{
      products: {
        edges: Array<{ node: any; cursor: string }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    }>(shop, query, { first, after });

    return {
      products: response.products.edges.map(edge => edge.node),
      pageInfo: response.products.pageInfo
    };
  }
}

export default ShopifyAdminService;
