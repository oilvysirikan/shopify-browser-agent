import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'shopify-browser-agent',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
      code: 'MISSING_AUTH_HEADERS'
    });
  }
  
  // Verify timestamp is within 5 minutes
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  const timeDiff = Math.abs(now - requestTime);
  
  if (timeDiff > 5 * 60 * 1000) { // 5 minutes
    return res.status(401).json({
      success: false,
      error: 'Request timestamp expired',
      code: 'TIMESTAMP_EXPIRED'
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
      code: 'INVALID_SIGNATURE'
    });
  }
  
  next();
};

// Main agent endpoint
router.post('/execute', verifyRouterRequest, async (req, res) => {
  try {
    const { task, merchant_context } = req.body;
    
    console.log('🤖 Browser Agent Task Received:', {
      task: task?.type || 'unknown',
      merchant: merchant_context?.shop_domain || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    // Basic task validation
    if (!task || !task.type) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task: task.type is required',
        code: 'INVALID_TASK'
      });
    }
    
    if (!merchant_context || !merchant_context.shop_domain) {
      return res.status(400).json({
        success: false,
        error: 'Invalid merchant_context: shop_domain is required',
        code: 'INVALID_MERCHANT_CONTEXT'
      });
    }
    
    // TODO: Implement actual browser agent logic
    // For now, return a mock response
    const result = {
      task_id: crypto.randomUUID(),
      status: 'completed',
      result: {
        message: `Task ${task.type} executed for ${merchant_context.shop_domain}`,
        data: {
          shop_domain: merchant_context.shop_domain,
          task_type: task.type,
          executed_at: new Date().toISOString(),
          // Mock data based on task type
          ...(task.type === 'product_analysis' && {
            products_found: 150,
            avg_price: 29.99,
            top_categories: ['electronics', 'clothing', 'accessories']
          }),
          ...(task.type === 'competitor_analysis' && {
            competitors: ['competitor1.com', 'competitor2.com'],
            market_position: 'top_10%',
            price_comparison: 'competitive'
          }),
          ...(task.type === 'content_optimization' && {
            optimized_products: 25,
            seo_score_improvement: '+15%',
            conversion_potential: 'high'
          })
        }
      },
      metadata: {
        execution_time: '2.3s',
        browser_used: 'puppeteer',
        success_rate: 100
      }
    };
    
    console.log('✅ Browser Agent Task Completed:', {
      task_id: result.task_id,
      status: result.status,
      execution_time: result.metadata.execution_time
    });
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error: any) {
    console.error('❌ Browser Agent Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error during task execution',
      code: 'EXECUTION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
