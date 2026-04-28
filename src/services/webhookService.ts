import { errorMonitor } from '../utils/errorMonitor';
import { WEBHOOK_TOPICS } from '../config/webhooks';

interface WebhookEvent {
  topic: string;
  shop: string;
  payload: any;
  webhookId: string;
}

export async function processWebhook(event: WebhookEvent) {
  const { topic, shop, payload, webhookId } = event;
  
  errorMonitor.info(`Processing webhook ${webhookId}`, {
    topic,
    shop,
    payloadType: typeof payload,
  });

  try {
    // Route to appropriate handler based on topic
    switch (topic) {
      case WEBHOOK_TOPICS.APP_UNINSTALLED:
        return await handleAppUninstalled(shop, payload);
        
      case WEBHOOK_TOPICS.ORDERS_CREATE:
        return await handleOrderCreated(shop, payload);
        
      case WEBHOOK_TOPICS.ORDERS_UPDATED:
        return await handleOrderUpdated(shop, payload);
        
      case WEBHOOK_TOPICS.PRODUCTS_UPDATE:
        return await handleProductUpdated(shop, payload);
        
      case WEBHOOK_TOPICS.PRODUCTS_CREATE:
        return await handleProductCreated(shop, payload);
        
      case WEBHOOK_TOPICS.CUSTOMERS_CREATE:
      case WEBHOOK_TOPICS.CUSTOMERS_UPDATE:
        return await handleCustomerEvent(topic, shop, payload);
        
      default:
        errorMonitor.warn(`Unhandled webhook topic: ${topic}`, {
          webhookId,
          shop,
        });
        return { status: 'unhandled', topic };
    }
  } catch (error) {
    errorMonitor.error(`Error processing webhook ${webhookId}`, {
      error,
      topic,
      shop,
    });
    throw error; // Will trigger retry logic
  }
}

// Webhook Handlers
async function handleAppUninstalled(shop: string, payload: any) {
  errorMonitor.info(`Handling app uninstall for ${shop}`);
  
  // TODO: Implement cleanup logic
  // - Remove shop data from database
  // - Revoke access tokens
  // - Clean up scheduled jobs
  
  return { status: 'processed', action: 'app_uninstalled' };
}

async function handleOrderCreated(shop: string, order: any) {
  errorMonitor.info(`New order created in ${shop}`, {
    orderId: order.id,
    orderNumber: order.order_number,
    customer: order.customer?.email,
    total: order.total_price,
  });
  
  // TODO: Implement order processing logic
  // - Send order confirmation
  // - Update inventory
  // - Trigger fulfillment
  
  return { status: 'processed', action: 'order_created' };
}

async function handleOrderUpdated(shop: string, order: any) {
  errorMonitor.info(`Order updated in ${shop}`, {
    orderId: order.id,
    status: order.fulfillment_status || order.financial_status,
  });
  
  // TODO: Implement order update logic
  // - Check for fulfillment status changes
  // - Update internal systems
  
  return { status: 'processed', action: 'order_updated' };
}

async function handleProductCreated(shop: string, product: any) {
  errorMonitor.info(`New product created in ${shop}`, {
    productId: product.id,
    title: product.title,
    vendor: product.vendor,
  });
  
  // TODO: Implement product creation logic
  // - Index in search
  // - Sync with external systems
  
  return { status: 'processed', action: 'product_created' };
}

async function handleProductUpdated(shop: string, product: any) {
  errorMonitor.info(`Product updated in ${shop}`, {
    productId: product.id,
    title: product.title,
    updatedFields: Object.keys(product),
  });
  
  // TODO: Implement product update logic
  // - Update cache
  // - Trigger AI content generation if needed
  
  return { status: 'processed', action: 'product_updated' };
}

async function handleCustomerEvent(topic: string, shop: string, customer: any) {
  const eventType = topic.split('/')[1]; // 'create' or 'update'
  
  errorMonitor.info(`Customer ${eventType}d in ${shop}`, {
    customerId: customer.id,
    email: customer.email,
  });
  
  // TODO: Implement customer sync logic
  // - Update CRM
  // - Sync with email marketing
  
  return { status: 'processed', action: `customer_${eventType}d` };
}

// Helper to validate webhook payloads
function validateWebhookPayload(payload: any, requiredFields: string[]): boolean {
  if (!payload) return false;
  return requiredFields.every(field => field in payload);
}

// Export for testing
export const __test__ = {
  validateWebhookPayload,
};
