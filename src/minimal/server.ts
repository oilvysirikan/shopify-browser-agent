import express from 'express';
import dotenv from 'dotenv';
import shopifyRouter from './routes/shopify';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Shopify AI Assistant is running',
    healthCheck: 'Visit /health for service status',
    endpoints: {
      health: '/health',
      shopify: '/api/v1/shopify/*'
    }
  });
});

// Mount Shopify routes
app.use('/api/v1/shopify', shopifyRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Not Found',
    path: req.path,
    method: req.method,
    availableEndpoints: ['/health', '/api/v1/shopify/health', '/api/v1/shopify/execute']
  });
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🛍️  Shopify API: http://localhost:${port}/api/v1/shopify/*`);
  console.log(`🔑 ROUTER_SECRET configured: ${!!process.env.ROUTER_SECRET}`);
});
