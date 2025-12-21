import { Request, Response } from 'express';
import { getShopifyClient } from '../../config/shopify';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { validationSchemas } from '../../middleware/validate-request';
import { z } from 'zod';

// Type for product query parameters
type ProductQueryParams = {
  limit?: number;
  page?: number;
  status?: 'active' | 'archived' | 'draft';
  collection_id?: string;
  vendor?: string;
  title?: string;
};

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get a list of products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of products to return (max 250)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, archived, draft]
 *         description: Filter products by status
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Filter products by vendor
 *     responses:
 *       200:
 *         description: A list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
export const getProducts = async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const query = validationSchemas.pagination.parse(req.query);
    
    // Build query parameters for Shopify API
    const shopifyParams: ProductQueryParams = {
      limit: Math.min(query.limit, 250), // Shopify max limit is 250
      page: query.page,
      ...(req.query.status && { status: req.query.status as any }),
      ...(req.query.vendor && { vendor: req.query.vendor as string }),
    };

    const client = getShopifyClient();
    const response = await client.getProducts(shopifyParams);
    
    // Calculate pagination metadata
    const totalItems = parseInt(response.headers['x-shopify-shop-api-call-limit']?.split('/')[1] || '0');
    const totalPages = Math.ceil(totalItems / query.limit);
    
    res.status(200).json({
      success: true,
      data: response.body,
      pagination: {
        total: totalItems,
        page: query.page,
        limit: query.limit,
        totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError('Invalid query parameters', 400, error);
    }
    throw error;
  }
};

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 */
export const getProductById = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new AppError('Product ID is required', 400);
  }
  
  try {
    const client = getShopifyClient();
    const response = await client.getProduct(id);
    
    res.status(200).json({
      success: true,
      data: response.body,
    });
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw new AppError(`Product ${id} not found`, 404);
    }
    throw error;
  }
};

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductInput'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 */
export const createProduct = async (req: Request, res: Response) => {
  try {
    // Validate request body against schema
    const productData = validationSchemas.shopifyProduct.parse(req.body);
    
    const client = getShopifyClient();
    const response = await client.createProduct({
      product: productData,
    });
    
    // Log the product creation
    logger.info('Product created', {
      productId: response.body.id,
      title: response.body.title,
    });
    
    res.status(201).json({
      success: true,
      data: response.body,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError('Invalid product data', 400, error);
    }
    throw error;
  }
};

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductInput'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 */
export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new AppError('Product ID is required', 400);
  }
  
  try {
    // Validate request body
    const productData = validationSchemas.shopifyProduct.partial().parse(req.body);
    
    const client = getShopifyClient();
    const response = await client.updateProduct(id, {
      product: productData,
    });
    
    logger.info('Product updated', {
      productId: id,
      updatedFields: Object.keys(productData),
    });
    
    res.status(200).json({
      success: true,
      data: response.body,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError('Invalid product data', 400, error);
    }
    if (error.statusCode === 404) {
      throw new AppError(`Product ${id} not found`, 404);
    }
    throw error;
  }
};

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       204:
 *         description: Product deleted successfully
 */
export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new AppError('Product ID is required', 400);
  }
  
  try {
    const client = getShopifyClient();
    await client.deleteProduct(id);
    
    logger.info('Product deleted', { productId: id });
    
    res.status(204).send();
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw new AppError(`Product ${id} not found`, 404);
    }
    throw error;
  }
};

/**
 * @swagger
 * /api/products/{id}/variants:
 *   get:
 *     summary: Get variants for a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: List of product variants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductVariant'
 */
export const getProductVariants = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new AppError('Product ID is required', 400);
  }
  
  try {
    const client = getShopifyClient();
    const response = await client.getProductVariants(id);
    
    res.status(200).json({
      success: true,
      data: response.body,
    });
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw new AppError(`Product ${id} not found`, 404);
    }
    throw error;
  }
};
