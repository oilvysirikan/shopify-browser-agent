import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Rate limiting configurations
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: options.message || 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

// Different rate limiters for different endpoints
export const rateLimiters = {
  // General API rate limiting
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }),

  // Strict rate limiting for AI endpoints
  ai: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 AI requests per minute
    message: 'Too many AI requests, please try again after 1 minute.'
  }),

  // Authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 auth attempts per 15 minutes
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }),

  // Shopify webhook endpoints
  webhook: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 webhook requests per minute
    message: 'Webhook rate limit exceeded, please try again later.'
  })
};

// Security headers middleware
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false,

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Frameguard
  frameguard: { action: 'deny' },

  // Hide Powered-By
  hidePoweredBy: true,

  // HSTS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permission Policy
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"]
    }
  },

  // Referrer Policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },

  // X-Content-Type-Options
  xContentTypeOptions: true,

  // X-DNS-Prefetch-Control
  xDnsPrefetchControl: false,

  // X-Download-Options
  xDownloadOptions: false,

  // X-Frame-Options
  xFrameOptions: 'DENY',

  // X-Permitted-Cross-Domain-Policies
  xPermittedCrossDomainPolicies: false,

  // X-XSS-Protection
  xXssProtection: true
});

// IP whitelist middleware
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP as string)) {
      logger.warn('Unauthorized IP access attempt', {
        ip: clientIP,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        success: false,
        error: 'Access denied from this IP address',
        code: 'IP_NOT_ALLOWED'
      });
    }
    
    next();
  };
};

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const bearerToken = req.headers.authorization?.replace('Bearer ', '');
  
  const token = apiKey || bearerToken;
  
  if (!token) {
    logger.warn('Missing API key', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({
      success: false,
      error: 'API key is required',
      code: 'MISSING_API_KEY'
    });
  }

  // Validate API key format (basic validation)
  if (token.length < 32) {
    logger.warn('Invalid API key format', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({
      success: false,
      error: 'Invalid API key format',
      code: 'INVALID_API_KEY'
    });
  }

  // Store validated token for use in downstream middleware
  (req as any).apiKey = token;
  next();
};

// Request size limiter
export const requestSizeLimiter = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      logger.warn('Request size exceeded', {
        ip: req.ip,
        path: req.path,
        contentLength,
        maxSize
      });
      
      return res.status(413).json({
        success: false,
        error: `Request size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
        code: 'REQUEST_TOO_LARGE'
      });
    }
    
    next();
  };
};

// Suspicious activity detector
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress;
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /go-http/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  if (isSuspicious) {
    logger.warn('Suspicious user agent detected', {
      ip,
      userAgent,
      path: req.path,
      method: req.method
    });
    
    // Add suspicious flag to request for monitoring
    (req as any).isSuspicious = true;
  }
  
  next();
};

// CORS configuration with security
export const secureCors = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS violation', { origin, path: 'unknown' });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Shopify-Shop-Domain',
    'X-Shopify-Access-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  maxAge: 86400 // 24 hours
};

// Security audit middleware
export const securityAudit = (req: Request, res: Response, next: NextFunction) => {
  const auditData = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    headers: {
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
      'x-api-key': req.get('X-API-Key') ? '[REDACTED]' : undefined
    },
    suspicious: (req as any).isSuspicious || false
  };
  
  // Log security events
  if (auditData.suspicious || req.path.includes('/admin') || req.path.includes('/auth')) {
    logger.info('Security audit', auditData);
  }
  
  next();
};

// Comprehensive security middleware
export const applySecurity = (app: any) => {
  // Apply security headers
  app.use(securityHeaders);
  
  // Apply CORS
  app.use(require('cors')(secureCors));
  
  // Apply request size limiting
  app.use(requestSizeLimiter());
  
  // Apply suspicious activity detection
  app.use(suspiciousActivityDetector);
  
  // Apply security audit
  app.use(securityAudit);
  
  // Apply general rate limiting
  app.use(rateLimiters.general);
  
  logger.info('Security middleware applied');
};
