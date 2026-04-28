export const WEBHOOK_TOPICS = {
  APP_UNINSTALLED: 'app/uninstalled',
  ORDERS_CREATE: 'orders/create',
  ORDERS_UPDATED: 'orders/updated',
  PRODUCTS_CREATE: 'products/create',
  PRODUCTS_UPDATE: 'products/update',
  CUSTOMERS_CREATE: 'customers/create',
  CUSTOMERS_UPDATE: 'customers/update',
} as const;

export const webhookConfig = [
  { topic: WEBHOOK_TOPICS.APP_UNINSTALLED, path: '/api/webhooks/app/uninstalled' },
  { topic: WEBHOOK_TOPICS.ORDERS_CREATE, path: '/api/webhooks/orders/create' },
  { topic: WEBHOOK_TOPICS.ORDERS_UPDATED, path: '/api/webhooks/orders/updated' },
  { topic: WEBHOOK_TOPICS.PRODUCTS_UPDATE, path: '/api/webhooks/products/update' },
];
