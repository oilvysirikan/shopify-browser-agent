import { z } from 'zod';

// Base response type for API calls
export interface BaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination type
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Shopify product type
export interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string | null;
  template_suffix: string | null;
  published_scope: string;
  tags: string;
  status: 'active' | 'archived' | 'draft';
  variants: ShopifyProductVariant[];
  options: ShopifyProductOption[];
  images: ShopifyImage[];
  image: ShopifyImage | null;
}

// Shopify product variant type
export interface ShopifyProductVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string | null;
  position: number;
  inventory_policy: 'deny' | 'continue';
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  image_id: number | null;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
}

// Shopify product option type
export interface ShopifyProductOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

// Shopify image type
export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
  admin_graphql_api_id: string;
}

// Validation schemas
export const validationSchemas = {
  pagination: z.object({
    page: z.preprocess(
      (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
      z.number().int().positive().default(1)
    ),
    limit: z.preprocess(
      (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
      z.number().int().positive().max(250).default(10)
    ),
  }),
  
  idParam: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
  
  shopifyProduct: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    body_html: z.string().optional(),
    vendor: z.string().optional(),
    product_type: z.string().optional(),
    tags: z.string().optional(),
    status: z.enum(['active', 'archived', 'draft']).default('draft'),
    variants: z.array(z.any()).optional(),
    images: z.array(z.any()).optional(),
  }),
};

// Extract TypeScript types from Zod schemas
export type PaginationQuery = z.infer<typeof validationSchemas.pagination>;
export type ShopifyProductInput = z.infer<typeof validationSchemas.shopifyProduct>;

// API response type for paginated results
export interface PaginatedResponse<T> extends BaseResponse<T[]> {
  pagination: Pagination;
}

// Error response type
export interface ErrorResponse extends Omit<BaseResponse, 'data'> {
  code?: string;
  details?: Record<string, string[]>;
}

// Request context type
export interface RequestContext {
  requestId: string;
  userId?: string;
  shop?: string;
  userAgent?: string;
  ip?: string;
}
