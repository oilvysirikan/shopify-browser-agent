const startedAt = Date.now();

type ShopifyTask =
  | 'list_products'
  | 'check_inventory'
  | 'get_orders'
  | 'import_taobao'
  | 'process_images';

type ExecuteRequestBody = {
  shop_domain?: string;
  access_token?: string;
  task?: ShopifyTask | { type?: ShopifyTask };
  params?: {
    threshold?: number;
    taobao_url?: string;
    languages?: string[];
    [key: string]: unknown;
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

type D1BoundStatement = {
  bind: (...values: unknown[]) => D1BoundStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

type D1DatabaseLike = {
  prepare(query: string): D1BoundStatement;
};

type Env = {
  DB?: D1DatabaseLike;
  ROUTER_SECRET?: string;
  NODE_ENV?: string;
};

type ShopifyStoreRecord = {
  id: string;
  shop_domain: string;
  access_token: string;
  store_name: string | null;
  is_active: number;
  created_at: string;
  last_synced_at: string | null;
};

type ShopifyStoreSummary = Omit<ShopifyStoreRecord, 'access_token'> & {
  access_token_masked?: string;
};

type ShopifyStoreStatus = {
  shop: {
    name?: string;
    plan_display_name?: string;
    plan_name?: string;
    myshopify_domain?: string;
  };
};

type RegisterStoreBody = {
  shop_domain?: string;
  access_token?: string;
  store_name?: string;
};

const SHOPIFY_API_VERSION = '2025-01';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type, X-Router-Signature, X-Router-Timestamp',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const PRODUCT_QUERY = `
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

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  Object.entries(corsHeaders).forEach(([key, value]) =>
    headers.set(key, value),
  );

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  Object.entries(corsHeaders).forEach(([key, value]) =>
    headers.set(key, value),
  );

  return new Response(body, {
    ...init,
    headers,
  });
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

async function toHex(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signHmacSha256(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return toHex(signature);
}

async function verifyRouterRequest(
  request: Request,
  env: Env,
  rawBody: string,
): Promise<Response | null> {
  const routerSecret = env.ROUTER_SECRET;

  if (!routerSecret) {
    console.warn('ROUTER_SECRET not configured, skipping verification');
    return null;
  }

  const signature = request.headers.get('x-router-signature');
  const timestamp = request.headers.get('x-router-timestamp');

  if (!signature || !timestamp) {
    return jsonResponse(
      {
        success: false,
        error: 'Missing router authentication headers',
        code: 'MISSING_AUTH_HEADERS',
      },
      { status: 401 },
    );
  }

  const now = Date.now();
  const requestTime = Number.parseInt(timestamp, 10);
  const timeDiff = Math.abs(now - requestTime);

  if (timeDiff > 5 * 60 * 1000) {
    return jsonResponse(
      {
        success: false,
        error: 'Request timestamp expired',
        code: 'TIMESTAMP_EXPIRED',
      },
      { status: 401 },
    );
  }

  const expectedSignature = await signHmacSha256(
    routerSecret,
    `${timestamp}.${rawBody}`,
  );

  if (signature !== expectedSignature) {
    return jsonResponse(
      {
        success: false,
        error: 'Invalid router signature',
        code: 'INVALID_SIGNATURE',
      },
      { status: 401 },
    );
  }

  return null;
}

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

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();

    throw new Error(
      `Shopify API returned non-JSON response (status ${response.status}): ${text.slice(0, 200)}`,
    );
  }

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

async function readProxyResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();

  return {
    success: response.ok,
    status: response.status,
    error: text,
  };
}

function productMatchesThreshold(
  product: { variants: { nodes: Array<{ inventoryQuantity: number | null }> } },
  threshold: number,
): boolean {
  return product.variants.nodes.some(
    (variant) => (variant.inventoryQuantity ?? 0) < threshold,
  );
}

function requireDb(env: Env): D1DatabaseLike {
  if (!env.DB) {
    throw new Error('D1 database binding DB is not configured');
  }

  return env.DB;
}

function maskAccessToken(token: string): string {
  return token.length <= 4 ? token : `****${token.slice(-4)}`;
}

async function fetchShopifyShopInfo(shopDomain: string, accessToken: string) {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    },
  );

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();

    throw new Error(
      `Shopify shop verification returned non-JSON response (status ${response.status}): ${text.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as ShopifyStoreStatus;

  if (!response.ok || !payload.shop) {
    throw new Error(
      `Shopify shop verification failed with status ${response.status}`,
    );
  }

  return payload.shop;
}

async function getStoreByDomain(env: Env, shopDomain: string) {
  return requireDb(env)
    .prepare(
      'SELECT id, shop_domain, access_token, store_name, is_active, created_at, last_synced_at FROM shopify_stores WHERE shop_domain = ? LIMIT 1',
    )
    .bind(shopDomain)
    .first<ShopifyStoreRecord>();
}

async function listActiveStores(env: Env) {
  const { results } = await getActiveStoreRecords(env);

  return results.map((store) => ({
    id: store.id,
    shop_domain: store.shop_domain,
    store_name: store.store_name,
    is_active: store.is_active,
    created_at: store.created_at,
    last_synced_at: store.last_synced_at,
    access_token_masked: maskAccessToken(store.access_token),
  })) as ShopifyStoreSummary[];
}

async function getActiveStoreRecords(env: Env) {
  return requireDb(env)
    .prepare(
      'SELECT id, shop_domain, store_name, is_active, created_at, last_synced_at, access_token FROM shopify_stores WHERE is_active = 1 ORDER BY created_at DESC',
    )
    .all<ShopifyStoreRecord>();
}

async function updateStoreSynced(env: Env, shopDomain: string) {
  await requireDb(env)
    .prepare(
      "UPDATE shopify_stores SET last_synced_at = datetime('now') WHERE shop_domain = ?",
    )
    .bind(shopDomain)
    .run();
}

async function softDeleteStore(env: Env, shopDomain: string) {
  const result = await requireDb(env)
    .prepare('UPDATE shopify_stores SET is_active = 0 WHERE shop_domain = ?')
    .bind(shopDomain)
    .run();

  return result;
}

async function saveStore(
  env: Env,
  input: {
    id: string;
    shopDomain: string;
    accessToken: string;
    storeName?: string;
  },
) {
  await requireDb(env)
    .prepare(
      `INSERT INTO shopify_stores (id, shop_domain, access_token, store_name, is_active, created_at, last_synced_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'), NULL)
       ON CONFLICT(shop_domain) DO UPDATE SET
         access_token = excluded.access_token,
         store_name = excluded.store_name,
         is_active = 1`,
    )
    .bind(
      input.id,
      input.shopDomain,
      input.accessToken,
      input.storeName || null,
    )
    .run();
}

async function resolveTokenForStore(
  env: Env,
  shopDomain: string,
  accessToken?: string,
) {
  if (accessToken) {
    return {
      accessToken,
      store: null,
      fromRegistry: false,
    };
  }

  const store = await getStoreByDomain(env, shopDomain);

  if (!store || !store.is_active) {
    return null;
  }

  return {
    accessToken: store.access_token,
    store,
    fromRegistry: true,
  };
}

async function executeShopifyTask(
  shopDomain: string,
  accessToken: string,
  task: ShopifyTask,
  params: ExecuteRequestBody['params'],
) {
  const executedAt = new Date().toISOString();
  let resultData: Record<string, unknown>;

  switch (task) {
    case 'list_products': {
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
        `query { products(first: 50) { ${PRODUCT_QUERY} } }`,
      );

      resultData = {
        shop_domain: shopDomain,
        task_type: task,
        executed_at: executedAt,
        products: data.products.nodes,
      };
      break;
    }
    case 'check_inventory': {
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
        `query { products(first: 50) { ${PRODUCT_QUERY} } }`,
      );

      resultData = {
        shop_domain: shopDomain,
        task_type: task,
        executed_at: executedAt,
        threshold,
        products: data.products.nodes.filter((product) =>
          productMatchesThreshold(product, threshold),
        ),
      };
      break;
    }
    case 'get_orders': {
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
        executed_at: executedAt,
        orders: data.orders.nodes,
      };
      break;
    }
    case 'import_taobao': {
      const taobaoRes = await fetch(
        'https://alinda-decor-api.silvercloud-6d5.workers.dev/api/import-taobao-multilang',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taobao_url: params?.taobao_url,
            languages: params?.languages || ['th'],
            shop_domain: shopDomain,
            access_token: accessToken,
          }),
        },
      );

      resultData = await readProxyResponse(taobaoRes);
      break;
    }
    case 'process_images': {
      const ocrRes = await fetch(
        'https://alinda-decor-api.silvercloud-6d5.workers.dev/api/process-product-images',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        },
      );

      resultData = await readProxyResponse(ocrRes);
      break;
    }
    default:
      throw new Error(`Unsupported task: ${task}`);
  }

  const result = {
    task_id: crypto.randomUUID(),
    status: 'completed',
    result: {
      message: `Task ${task} executed for ${shopDomain}`,
      data: resultData,
    },
    metadata: {
      execution_time: `${Date.now() - new Date(executedAt).getTime()}ms`,
      browser_used: 'none',
      success_rate: 100,
    },
  };

  return result;
}

async function handleExecute(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text();
  const authResponse = await verifyRouterRequest(request, env, rawBody);

  if (authResponse) {
    return authResponse;
  }

  let body: ExecuteRequestBody;

  try {
    body = rawBody ? (JSON.parse(rawBody) as ExecuteRequestBody) : {};
  } catch {
    return jsonResponse(
      {
        success: false,
        error: 'Invalid JSON body',
        code: 'INVALID_JSON',
      },
      { status: 400 },
    );
  }

  const { task, shopDomain, accessToken, params } = normalizeRequest(body);

  console.log('🤖 Browser Agent Task Received:', {
    task: task || 'unknown',
    merchant: shopDomain || 'unknown',
    timestamp: new Date().toISOString(),
  });

  if (!task) {
    return jsonResponse(
      {
        success: false,
        error: 'Invalid task: task is required',
        code: 'INVALID_TASK',
      },
      { status: 400 },
    );
  }

  if (!shopDomain) {
    return jsonResponse(
      {
        success: false,
        error: 'Invalid request: shop_domain is required',
        code: 'INVALID_MERCHANT_CONTEXT',
      },
      { status: 400 },
    );
  }

  const resolved = await resolveTokenForStore(env, shopDomain, accessToken);

  if (!resolved) {
    return jsonResponse(
      {
        success: false,
        error: 'Store not registered',
        code: 'STORE_NOT_REGISTERED',
      },
      { status: 404 },
    );
  }

  try {
    const result = await executeShopifyTask(
      shopDomain,
      resolved.accessToken,
      task,
      params,
    );

    const registryStore =
      resolved.store || (await getStoreByDomain(env, shopDomain));

    if (registryStore) {
      await updateStoreSynced(env, shopDomain);
    }

    console.log('✅ Browser Agent Task Completed:', {
      task_id: result.task_id,
      status: result.status,
      execution_time: result.metadata.execution_time,
    });

    return jsonResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return textResponse('', { status: 204 });
    }

    if (request.method === 'GET' && path === '/health') {
      return jsonResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        environment: env.NODE_ENV || 'production',
      });
    }

    if (request.method === 'GET' && path === '/') {
      return jsonResponse({
        status: 'ok',
        message: 'Shopify Browser Agent is running on Cloudflare Workers',
        healthCheck: 'Visit /health for service status',
        endpoints: {
          health: '/health',
          shopify: '/api/shopify/*',
          stores: '/api/stores',
        },
      });
    }

    if (request.method === 'GET' && path === '/api/stores') {
      const stores = await listActiveStores(env);

      return jsonResponse({ stores });
    }

    if (request.method === 'POST' && path === '/api/stores') {
      try {
        const body = (await request.json()) as RegisterStoreBody;
        const shopDomain = body.shop_domain?.trim();
        const accessToken = body.access_token?.trim();
        const storeName = body.store_name?.trim();

        if (!shopDomain || !accessToken) {
          return jsonResponse(
            {
              success: false,
              error: 'shop_domain and access_token are required',
              code: 'INVALID_STORE_PAYLOAD',
            },
            { status: 400 },
          );
        }

        const shop = await fetchShopifyShopInfo(shopDomain, accessToken);
        const id = `store_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

        await saveStore(env, {
          id,
          shopDomain,
          accessToken,
          storeName: storeName || shop.name || shopDomain,
        });

        const saved = await getStoreByDomain(env, shopDomain);

        return jsonResponse(
          {
            success: true,
            store: {
              id: saved?.id || id,
              shop_domain: shopDomain,
              store_name:
                saved?.store_name || storeName || shop.name || shopDomain,
            },
          },
          { status: 201 },
        );
      } catch (error) {
        return jsonResponse(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to register store',
            code: 'STORE_REGISTRATION_FAILED',
          },
          { status: 400 },
        );
      }
    }

    if (request.method === 'GET' && path === '/api/v1/shopify/health') {
      return jsonResponse({
        status: 'ok',
        service: 'shopify-browser-agent',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV || 'production',
      });
    }

    if (request.method === 'GET' && path === '/api/shopify/health') {
      return jsonResponse({
        status: 'ok',
        service: 'shopify-browser-agent',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV || 'production',
      });
    }

    if (
      request.method === 'GET' &&
      path.startsWith('/api/stores/') &&
      path.endsWith('/status')
    ) {
      const shopDomain = decodeURIComponent(
        path.slice('/api/stores/'.length, -'/status'.length),
      );

      const store = await getStoreByDomain(env, shopDomain);

      if (!store || !store.is_active) {
        return jsonResponse(
          {
            success: false,
            error: 'Store not registered',
            code: 'STORE_NOT_REGISTERED',
          },
          { status: 404 },
        );
      }

      try {
        const shop = await fetchShopifyShopInfo(shopDomain, store.access_token);

        return jsonResponse({
          valid: true,
          shop_name: shop.name || store.store_name || shopDomain,
          plan: shop.plan_display_name || shop.plan_name || null,
          shop_domain: shop.myshopify_domain || shopDomain,
        });
      } catch (error) {
        return jsonResponse({
          valid: false,
          shop_name: store.store_name || shopDomain,
          plan: null,
          error: error instanceof Error ? error.message : 'Invalid token',
        });
      }
    }

    if (request.method === 'DELETE' && path.startsWith('/api/stores/')) {
      const shopDomain = decodeURIComponent(path.slice('/api/stores/'.length));
      const store = await getStoreByDomain(env, shopDomain);

      if (!store) {
        return jsonResponse(
          {
            success: false,
            error: 'Store not registered',
            code: 'STORE_NOT_REGISTERED',
          },
          { status: 404 },
        );
      }

      await softDeleteStore(env, shopDomain);

      return jsonResponse({ success: true });
    }

    if (
      request.method === 'POST' &&
      (path === '/api/shopify/execute/all' ||
        path === '/api/v1/shopify/execute/all')
    ) {
      try {
        const body = (await request.json()) as ExecuteRequestBody;
        const task =
          typeof body.task === 'string' ? body.task : body.task?.type;
        const params = body.params || {};

        if (!task) {
          return jsonResponse(
            {
              success: false,
              error: 'Invalid task: task is required',
              code: 'INVALID_TASK',
            },
            { status: 400 },
          );
        }

        const stores = await getActiveStoreRecords(env);
        const settled = await Promise.allSettled(
          stores.results.map(async (store) => {
            const result = await executeShopifyTask(
              store.shop_domain,
              store.access_token,
              task,
              params,
            );

            await updateStoreSynced(env, store.shop_domain);

            return {
              shop_domain: store.shop_domain,
              success: true,
              data: result,
            };
          }),
        );

        const results = settled.map((entry, index) => {
          const shopDomain = stores.results[index]?.shop_domain || 'unknown';

          if (entry.status === 'fulfilled') {
            return entry.value;
          }

          return {
            shop_domain: shopDomain,
            success: false,
            error:
              entry.reason instanceof Error
                ? entry.reason.message
                : 'Task execution failed',
          };
        });

        const success = results.filter((item) => item.success).length;

        return jsonResponse({
          results,
          summary: {
            total: results.length,
            success,
            failed: results.length - success,
          },
        });
      } catch (error) {
        return jsonResponse(
          {
            success: false,
            error:
              error instanceof Error ? error.message : 'Batch execution failed',
            code: 'BATCH_EXECUTION_FAILED',
          },
          { status: 500 },
        );
      }
    }

    if (
      request.method === 'POST' &&
      (path === '/api/v1/shopify/execute' || path === '/api/shopify/execute')
    ) {
      try {
        return await handleExecute(request, env);
      } catch (error) {
        console.error('❌ Browser Agent Error:', error);

        const message =
          error instanceof Error ? error.message : 'Unknown upstream error';

        return jsonResponse(
          {
            success: false,
            error: 'Shopify API request failed',
            code: 'SHOPIFY_API_ERROR',
            details: message,
          },
          { status: 502 },
        );
      }
    }

    return jsonResponse(
      {
        status: 'error',
        message: 'Not Found',
        path,
        method: request.method,
        availableEndpoints: [
          '/health',
          '/api/stores',
          '/api/stores/:shop_domain/status',
          '/api/shopify/execute',
          '/api/shopify/execute/all',
        ],
      },
      { status: 404 },
    );
  },
};
