import { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Security headers configuration
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://cdn.shopify.com',
        'https://js.stripe.com',
        (req: Request) => {
          // Allow inline scripts in development
          if (process.env.NODE_ENV === 'development') {
            return "'unsafe-inline' 'self'"
          }
          return "'self'"
        }
      ],
      styleSrc: [
        "'self'",
        'https://cdn.shopify.com',
        'https://fonts.googleapis.com',
        "'unsafe-inline'"
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https:',
        'https://cdn.shopify.com',
        'https://images.unsplash.com',
        'https://via.placeholder.com'
      ],
      connectSrc: [
        "'self'",
        'https://*.shopify.com',
        'https://*.stripe.com',
        process.env.API_BASE_URL || 'http://localhost:3000'
      ],
      fontSrc: [
        "'self'",
        'https:',
        'data:',
        'https://fonts.gstatic.com',
        'https://cdn.shopify.com'
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: [
        "'self'",
        'https://*.shopify.com',
        'https://*.stripe.com',
        'https://js.stripe.com'
      ],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      reportUri: process.env.CSP_REPORT_URI || null
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      /^https?:\/\/[a-zA-Z0-9-]+\.shopify\.com(\/.*)?$/,
      /^https?:\/\/localhost(:[0-9]+)?$/,
      /^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/,
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL
    ].filter(Boolean) as (string | RegExp)[];

    if (!origin || allowedOrigins.some(allowedOrigin => 
      typeof allowedOrigin === 'string' 
        ? origin === allowedOrigin 
        : allowedOrigin.test(origin)
    )) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Shopify-Shop-Domain',
    'X-Shopify-Access-Token',
    'X-Request-ID'
  ],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  credentials: true,
  maxAge: 600, // 10 minutes
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  keyGenerator: (req) => {
    // Use the shop's domain as part of the rate limit key
    return req.get('X-Shopify-Shop-Domain') || req.ip;
  }
});

// Request ID middleware
const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.id = req.get('X-Request-ID') || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Security headers middleware
const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Disable caching for sensitive routes
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

// Error handling for security middleware
const securityErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    logger.error('Security middleware error:', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.status(500).json({ 
        error: 'Security Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  } else {
    next();
  }
};

// Apply all security middleware to the Express app
export const applySecurityMiddleware = (app: Express) => {
  // Apply security middleware in the correct order
  app.use(requestId);
  app.use(helmetConfig);
  app.use(cors(corsOptions));
  app.use(securityHeaders);
  
  // Apply rate limiting to API routes
  app.use('/api', apiLimiter);
  
  // Error handling for security middleware
  app.use(securityErrorHandler);
  
  // Log security-relevant events
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      // Log security-relevant requests
      if (req.path.includes('admin') || 
          req.path.includes('auth') || 
          req.path.includes('api')) {
        logger.info('Security audit', {
          requestId: req.id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('user-agent'),
          ip: req.ip,
          shop: req.get('x-shopify-shop-domain')
        });
      }
    });
    
    next();
  });
};

// Export individual middleware for specific routes if needed
export const security = {
  cors: cors(corsOptions),
  rateLimit: apiLimiter,
  helmet: helmetConfig,
  securityHeaders,
  requestId
};

export default security;
