import Queue from 'bull';
import { errorMonitor } from '../utils/errorMonitor';
import { processWebhook } from '../services/webhookService';

// Queue configuration
const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  },
  defaultJobOptions: {
    attempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3'),
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds
    },
    removeOnComplete: 1000, // Keep last 1000 completed jobs
    removeOnFail: 5000, // Keep last 5000 failed jobs
    timeout: 30000, // 30 seconds timeout
  },
};

// Initialize queue
export const webhookQueue = new Queue('shopify-webhooks', queueConfig);

// Process jobs with concurrency
webhookQueue.process(5, async (job) => { // Process 5 jobs concurrently
  const { topic, shop, payload, webhookId } = job.data;
  
  errorMonitor.info(`Processing webhook ${webhookId}`, {
    topic,
    shop,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });
  
  try {
    // Process the webhook using centralized service
    const result = await processWebhook({
      topic,
      shop,
      payload,
      webhookId,
    });
    
    errorMonitor.info(`Webhook processed successfully`, {
      topic,
      shop,
      webhookId,
      jobId: job.id,
    });
    
    return result;
  } catch (error) {
    errorMonitor.error(`Webhook processing failed`, {
      error,
      topic,
      shop,
      webhookId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });
    
    // Rethrow to trigger retry logic
    throw error;
  }
});

// Event handlers
webhookQueue.on('error', (error) => {
  errorMonitor.error('Webhook queue error:', error);
});

webhookQueue.on('waiting', (jobId) => {
  errorMonitor.debug(`Webhook job ${jobId} is waiting`);
});

webhookQueue.on('active', (job) => {
  errorMonitor.debug(`Processing webhook job ${job.id}`, {
    webhookId: job.data.webhookId,
    topic: job.data.topic,
    shop: job.data.shop,
  });
});

webhookQueue.on('completed', (job, result) => {
  errorMonitor.info(`Webhook job ${job.id} completed`, {
    webhookId: job.data.webhookId,
    topic: job.data.topic,
    shop: job.data.shop,
    result,
  });
});

webhookQueue.on('failed', (job, error) => {
  if (job) {
    const { topic, shop, webhookId } = job.data;
    const attempts = job.attemptsMade;
    const maxAttempts = job.opts.attempts;
    
    if (attempts >= maxAttempts) {
      errorMonitor.error(`Webhook job ${job.id} failed after ${attempts} attempts`, {
        webhookId,
        topic,
        shop,
        error: error.message,
        stack: error.stack,
        lastAttempt: true,
      });
      
      // TODO: Move to dead letter queue or notify admin
    } else {
      errorMonitor.warn(`Webhook job ${job.id} failed, will retry (${attempts + 1}/${maxAttempts})`, {
        webhookId,
        topic,
        shop,
        error: error.message,
      });
    }
  } else {
    errorMonitor.error('Webhook job failed (job data missing):', error);
  }
});

// Clean up old jobs periodically
const cleanOldJobs = async () => {
  try {
    // Clean jobs older than 7 days
    const cleaned = await webhookQueue.clean(60 * 60 * 24 * 7 * 1000, 'completed');
    if (cleaned.length > 0) {
      errorMonitor.info(`Cleaned ${cleaned.length} old jobs`);
    }
  } catch (error) {
    errorMonitor.error('Error cleaning old jobs:', error);
  }
};

// Run cleanup every hour
setInterval(cleanOldJobs, 60 * 60 * 1000).unref();

// Handle process termination
process.on('SIGTERM', async () => {
  errorMonitor.info('Shutting down webhook queue...');
  try {
    await webhookQueue.close();
    errorMonitor.info('Webhook queue shutdown complete');
    process.exit(0);
  } catch (error) {
    errorMonitor.error('Error shutting down webhook queue:', error);
    process.exit(1);
  }
});

export default webhookQueue;
