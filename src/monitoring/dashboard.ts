import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AIServiceFactory } from '../services/ai.service.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define types for our metrics
type AIMetric = {
  provider: string;
  timestamp: number;
  duration: number;
  tokens: number;
  success: boolean;
  model?: string;
};

type AIError = {
  provider: string;
  timestamp: number;
  error: string;
  model?: string;
};

// In-memory storage for metrics
const metrics = {
  requests: [] as AIMetric[],
  errors: [] as AIError[],
  tokensUsed: 0,
  totalRequests: 0,
  totalErrors: 0,
  avgResponseTime: 0,
  lastUpdated: Date.now()
};

// Rate limiting for the dashboard API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.json());
app.use(apiLimiter);

// Serve static files from the monitoring public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get current metrics
app.get('/api/metrics', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      totalRequests: metrics.totalRequests,
      totalErrors: metrics.totalErrors,
      tokensUsed: metrics.tokensUsed,
      avgResponseTime: metrics.avgResponseTime,
      lastUpdated: metrics.lastUpdated,
      requests: metrics.requests.slice(-100), // Return last 100 requests
      errors: metrics.errors.slice(-50) // Return last 50 errors
    }
  });
});

// API endpoint to test AI providers
app.post('/api/test', apiLimiter, async (req: Request, res: Response) => {
  const { provider, prompt, maxTokens = 100, temperature = 0.7 } = req.body;
  
  if (!provider || !prompt) {
    return res.status(400).json({ 
      success: false, 
      error: 'Provider and prompt are required' 
    });
  }

  try {
    const result = await trackAIMetrics(provider)(prompt, { maxTokens, temperature });
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error testing AI provider:', { error: error.message, provider });
    res.status(500).json({ 
      success: false, 
      error: error.message || 'An error occurred while testing the AI provider' 
    });
  }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Metrics are already defined at the top of the file

// WebSocket for real-time updates
io.on('connection', (socket) => {
  logger.info('Client connected to monitoring dashboard');
  
  // Send current metrics to the newly connected client
  socket.emit('metrics', {
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    tokensUsed: metrics.tokensUsed,
    avgResponseTime: metrics.avgResponseTime,
    lastUpdated: metrics.lastUpdated,
    requests: metrics.requests.slice(-100),
    errors: metrics.errors.slice(-50)
  });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected from monitoring dashboard');
  });
});

function getCurrentMetrics() {
  return {
    totalRequests: metrics.requests.length,
    totalErrors: metrics.errors.length,
    providers: Array.from(new Set(metrics.requests.map(r => r.provider)))
  };
}

// Track AI metrics function
export function trackAIMetrics(provider: string) {
  return async (prompt: string, options: any = {}) => {
    const startTime = Date.now();
    const service = AIServiceFactory.createService(provider as any);
    
    try {
      const result = await service.generateText({
        prompt,
        ...options,
        cacheKeySuffix: `monitored-${Date.now()}`
      });
      
      const duration = Date.now() - startTime;
      const tokens = result.split(/\s+/).length;
      
      const metric: AIMetric = {
        provider,
        timestamp: Date.now(),
        duration,
        tokens,
        success: true,
        model: options.model
      };
      
      // Update metrics
      metrics.requests.push(metric);
      metrics.totalRequests++;
      metrics.tokensUsed += tokens;
      metrics.avgResponseTime = 
        (metrics.avgResponseTime * (metrics.totalRequests - 1) + duration) / metrics.totalRequests;
      metrics.lastUpdated = Date.now();
      
      // Emit update to all connected clients
      io.emit('request', metric);
      io.emit('metrics', {
        totalRequests: metrics.totalRequests,
        totalErrors: metrics.totalErrors,
        tokensUsed: metrics.tokensUsed,
        avgResponseTime: metrics.avgResponseTime,
        lastUpdated: metrics.lastUpdated
      });
      
      return result;
    } catch (error: any) {
      const errorMetric: AIError = {
        provider,
        timestamp: Date.now(),
        error: error.message,
        model: options.model
      };
      
      // Update error metrics
      metrics.errors.push(errorMetric);
      metrics.totalErrors++;
      metrics.lastUpdated = Date.now();
      
      // Emit error to all connected clients
      io.emit('error', errorMetric);
      io.emit('metrics', {
        totalRequests: metrics.totalRequests,
        totalErrors: metrics.totalErrors,
        tokensUsed: metrics.tokensUsed,
        avgResponseTime: metrics.avgResponseTime,
        lastUpdated: metrics.lastUpdated
      });
      
      logger.error('AI service error:', { 
        provider, 
        error: error.message,
        stack: error.stack 
      });
      
      throw error;
    }
  };
}

// The server will be started by the main application

export { app, server };
