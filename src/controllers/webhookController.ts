import { Request, Response } from 'express';
import { webhookQueue } from '../queues/webhookQueue';
import { errorMonitor } from '../utils/errorMonitor';

// Re-export the verifyWebhook middleware from webhookVerification
export { verifyWebhook } from '../middleware/webhookVerification';

/**
 * Handles incoming webhooks from Shopify
 * Verifies the webhook and queues it for processing
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const topic = req.get('X-Shopify-Topic');
  const shop = req.get('X-Shopify-Shop-Domain');
  const webhookId = req.get('X-Shopify-Webhook-Id');
  
  if (!topic || !shop || !webhookId) {
    errorMonitor.warn('Missing required webhook headers', {
      topic,
      shop,
      webhookId,
      headers: req.headers,
    });
    return res.status(400).json({ error: 'Missing required headers' });
  }

  try {
    // Log the incoming webhook
    errorMonitor.info(`Received webhook ${webhookId}`, {
      topic,
      shop,
      webhookId,
      payloadSize: JSON.stringify(req.body).length,
    });

    // Add to queue for background processing
    await webhookQueue.add(
      {
        topic,
        shop,
        payload: req.body,
        webhookId,
        receivedAt: new Date().toISOString(),
      },
      {
        jobId: `wh_${webhookId}`,
        removeOnComplete: true,
        removeOnFail: 100, // Keep last 100 failed jobs for debugging
      }
    );

    // Respond immediately to Shopify
    res.status(200).json({ received: true });
  } catch (error) {
    errorMonitor.error('Error queueing webhook:', {
      topic,
      shop,
      webhookId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    res.status(500).json({
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
