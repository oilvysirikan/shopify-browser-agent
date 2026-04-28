declare module '../services/shopify-admin.service' {
  import { Product } from '@prisma/client';

  export class ShopifyAdminService {
    static makeGraphQLRequest<T>(query: string, variables?: Record<string, any>): Promise<T>;
    static listProducts(tenantId: string, options?: any): Promise<Product[]>;
    static getProduct(tenantId: string, productId: string): Promise<Product | null>;
    static updateProduct(tenantId: string, productId: string, data: Partial<Product>): Promise<Product>;
  }

  export default ShopifyAdminService;
}
