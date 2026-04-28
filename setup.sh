#!/bin/bash

# Create directories
mkdir -p src/{controllers,middleware,queues,utils,routes}

# Install dependencies
echo "Installing dependencies..."
npm install --save-dev typescript @types/node @types/express ts-node ts-node-dev
npm install express @shopify/shopify-api dotenv bull winston winston-daily-rotate-file express-rate-limit

# Create tsconfig.json
cat > tsconfig.json << 'TS_EOF'
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
TS_EOF

# Create .env file
cat > .env << 'ENV_EOF'
# Shopify
SHOPIFY_API_SECRET=your_shopify_api_secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3000
NODE_ENV=development
ENV_EOF

# Create error monitor
cat > src/utils/errorMonitor.ts << 'ERROR_MONITOR_EOF'
import { createLogger, format, transports } from 'winston';

const logFormat = format.combine(
  format.timestamp(),
  format.json()
);

export const errorMonitor = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export default errorMonitor;
ERROR_MONITOR_EOF

# Create rate limiter
cat > src/middleware/rateLimit.ts << 'RATE_LIMIT_EOF'
import rateLimit from 'express-rate-limit';

export const webhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});
RATE_LIMIT_EOF

# Create webhook queue
cat > src/queues/webhookQueue.ts << 'QUEUE_EOF'
import Queue from 'bull';
import { errorMonitor } from '../utils/errorMonitor';

const webhookQueue = new Queue('webhooks', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Process jobs
webhookQueue.process(async (job) => {
  const { topic, shop, payload } = job.data;
  console.log(`Processing ${topic} webhook for ${shop}`);
  // Add your webhook processing logic here
  return { success: true };
});

// Error handling
webhookQueue.on('error', (error) => {
  errorMonitor.error('Queue error:', error);
});

webhookQueue.on('failed', (job, error) => {
  errorMonitor.error(`Job ${job?.id} failed:`, error);
});

export default webhookQueue;
QUEUE_EOF

# Create webhook controller
cat > src/controllers/webhookController.ts << 'CONTROLLER_EOF'
import { Request, Response } from 'express';
import crypto from 'crypto';
import webhookQueue from '../queues/webhookQueue';
import { errorMonitor } from '../utils/errorMonitor';

export const verifyWebhook = (req: Request, res: Response, next: Function) => {
  try {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const shop = req.get('X-Shopify-Shop-Domain');

    if (!hmac || !topic || !shop) {
      return res.status(401).json({ error: 'Missing required webhook headers' });
    }

    const body = JSON.stringify(req.body);
    const calculatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
      .update(body, 'utf8')
      .digest('base64');

    if (hmac !== calculatedHmac) {
      errorMonitor.warn('Invalid webhook signature', { shop, topic });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    next();
  } catch (error) {
    errorMonitor.error('Webhook verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const topic = req.get('X-Shopify-Topic');
  const shop = req.get('X-Shopify-Shop-Domain');
  const payload = req.body;

  if (!topic || !shop) {
    return res.status(400).json({ error: 'Missing required headers' });
  }

  try {
    await webhookQueue.add(
      { topic, shop, payload },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    errorMonitor.error('Error queueing webhook:', { topic, shop, error });
    res.status(500).json({ error: 'Error processing webhook' });
  }
};
CONTROLLER_EOF

# Create webhook routes
mkdir -p src/routes
cat > src/routes/webhookRoutes.ts << 'ROUTES_EOF'
import { Router } from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/webhookController';
import { webhookRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply rate limiting to all webhook endpoints
router.use(webhookRateLimiter);

// Webhook verification middleware
router.use(verifyWebhook);

// Webhook endpoints
router.post('/app/uninstalled', handleWebhook);
router.post('/orders/create', handleWebhook);
router.post('/products/update', handleWebhook);

export default router;
ROUTES_EOF

# Create main app file
cat > src/app.ts << 'APP_EOF'
import express from 'express';
import bodyParser from 'body-parser';
import { errorMonitor } from './utils/errorMonitor';
import webhookRoutes from './routes/webhookRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Routes
app.use('/api/webhooks', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    endpoints: {
      webhooks: '/api/webhooks',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  errorMonitor.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  errorMonitor.info(`Server started on port ${PORT}`);
});

export default app;
APP_EOF

# Update package.json
npm pkg set scripts.dev="ts-node-dev --respawn --transpile-only src/app.ts"
npm pkg set scripts.build="tsc"
npm pkg set scripts.start="node dist/app.js"

echo "Setup complete! Run 'npm run dev' to start the development server."
