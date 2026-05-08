import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

type ShopifyTask = 'list_products' | 'check_inventory' | 'get_orders';

type ExecuteRequestBody = {
  shop_domain?: string;
  access_token?: string;
  task?: ShopifyTask | { type?: ShopifyTask };
  params?: {
    threshold?: number;
  };
  merchant_context?: {
    shop_domain?: string;
    access_token?: string;
  };
};

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

const SHOPIFY_API_VERSION = '2025-01';

const PRODUCT_SELECTION = `
  nodes {
    id
    title
    status
    variants(first: 50) {
      nodes {
        price
        sku
        inventoryQuantity
      }
    }
  }
`;

async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
): Promise<T> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query }),
    },
  );

  const payload = (await response.json()) as ShopifyGraphQLResponse<T>;

  if (!response.ok || payload.errors?.length) {
    const message =
      payload.errors?.map((error) => error.message).join('; ') ||
      `Shopify API request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!payload.data) {
    throw new Error('Shopify API returned no data');
  }

  return payload.data;
}

function normalizeRequest(body: ExecuteRequestBody) {
  const task = typeof body.task === 'string' ? body.task : body.task?.type;
  const shopDomain = body.shop_domain || body.merchant_context?.shop_domain;
  const accessToken = body.access_token || body.merchant_context?.access_token;

  return { task, shopDomain, accessToken, params: body.params || {} };
}

function getThreshold(params: ExecuteRequestBody['params']): number {
  const threshold = params?.threshold;

  if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
    throw new Error(
      'Invalid params.threshold: number is required for check_inventory',
    );
  }

  return threshold;
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'shopify-browser-agent',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Middleware to verify router requests
const verifyRouterRequest = (req: any, res: any, next: any) => {
  const routerSecret = process.env.ROUTER_SECRET;

  if (!routerSecret) {
    console.warn('ROUTER_SECRET not configured, skipping verification');
    return next();
  }

  const signature = req.headers['x-router-signature'] as string;
  const timestamp = req.headers['x-router-timestamp'] as string;

  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      error: 'Missing router authentication headers',
      code: 'MISSING_AUTH_HEADERS',
    });
  }

  // Verify timestamp is within 5 minutes
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  const timeDiff = Math.abs(now - requestTime);

  if (timeDiff > 5 * 60 * 1000) {
    // 5 minutes
    return res.status(401).json({
      success: false,
      error: 'Request timestamp expired',
      code: 'TIMESTAMP_EXPIRED',
    });
  }

  // Verify signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', routerSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({
      success: false,
      error: 'Invalid router signature',
      code: 'INVALID_SIGNATURE',
    });
  }

  next();
};

// Main agent endpoint
router.post('/execute', verifyRouterRequest, async (req, res) => {
  try {
    const { task, shopDomain, accessToken, params } = normalizeRequest(
      req.body as ExecuteRequestBody,
    );

    console.log('🤖 Browser Agent Task Received:', {
      task: task || 'unknown',
      merchant: shopDomain || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // Basic task validation
    if (!task) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task: task is required',
        code: 'INVALID_TASK',
      });
    }

    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: shop_domain is required',
        code: 'INVALID_MERCHANT_CONTEXT',
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: access_token is required',
        code: 'INVALID_ACCESS_TOKEN',
      });
    }

    let resultData: Record<string, unknown>;

    if (task === 'list_products') {
      const data = await shopifyGraphQL<{
        products: {
          nodes: Array<{
            id: string;
            title: string;
            status: string;
            variants: {
              nodes: Array<{
                price: string;
                sku: string | null;
                inventoryQuantity: number | null;
              }>;
            };
          }>;
        };
      }>(
        shopDomain,
        accessToken,
        `query { products(first: 50) { ${PRODUCT_SELECTION} } }`,
      );

      resultData = {
        shop_domain: shopDomain,
        task_type: task,
        executed_at: new Date().toISOString(),
        products: data.products.nodes,
      };
    } else if (task === 'check_inventory') {
      const threshold = getThreshold(params);
      const data = await shopifyGraphQL<{
        products: {
          nodes: Array<{
            id: string;
            title: string;
            status: string;
            variants: {
              nodes: Array<{
                price: string;
                sku: string | null;
                inventoryQuantity: number | null;
              }>;
            };
          }>;
        };
      }>(
        shopDomain,
        accessToken,
        `query { products(first: 50) { ${PRODUCT_SELECTION} } }`,
      );

      resultData = {
        shop_domain: shopDomain,
        task_type: task,
        executed_at: new Date().toISOString(),
        threshold,
        products: data.products.nodes.filter((product) =>
          product.variants.nodes.some(
            (variant) => (variant.inventoryQuantity ?? 0) < threshold,
          ),
        ),
      };
    } else if (task === 'get_orders') {
      const data = await shopifyGraphQL<{
        orders: {
          nodes: Array<{
            id: string;
            name: string;
            totalPrice: string;
            createdAt: string;
          }>;
        };
      }>(
        shopDomain,
        accessToken,
        `query { orders(first: 50, query: "fulfillment_status:unfulfilled") { nodes { id name totalPrice createdAt } } }`,
      );

      resultData = {
        shop_domain: shopDomain,
        task_type: task,
        executed_at: new Date().toISOString(),
        orders: data.orders.nodes,
      };
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported task: ${task}`,
        code: 'UNSUPPORTED_TASK',
      });
    }

    const result = {
      task_id: crypto.randomUUID(),
      status: 'completed',
      result: {
        message: `Task ${task} executed for ${shopDomain}`,
        data: resultData,
      },
      metadata: {
        execution_time: 'real Shopify Admin GraphQL',
        browser_used: 'none',
        success_rate: 100,
      },
    };

    console.log('✅ Browser Agent Task Completed:', {
      task_id: result.task_id,
      status: result.status,
      execution_time: result.metadata.execution_time,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('❌ Browser Agent Error:', error);

    res.status(500).json({
      success: false,
      error: 'Internal server error during task execution',
      code: 'EXECUTION_ERROR',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
