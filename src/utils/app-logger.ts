import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, align } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, requestId, ...meta }) => {
  const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${level}] ${requestId ? `[${requestId}] ` : ''}${message}${metaString}`;
});

// Create the logger instance
const logger = winston.createLogger({
  level: config.isDevelopment ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.isDevelopment ? colorize() : winston.format.json(),
    config.isDevelopment ? devFormat : winston.format.json(),
    align()
  ),
  defaultMeta: { service: 'shopify-browser-agent' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format((info) => {
          if (info.stack) {
            info.message = `${info.message}\n${info.stack}`;
            delete info.stack;
          }
          return info;
        })()
      ),
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 5,
    })
  ],
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true,
});

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', requestId);
  (req as any).id = requestId;
  next();
};

// Request logger middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl } = req;
  const requestId = (req as any).id || 'unknown';

  // Skip logging for health checks
  if (originalUrl === '/health') {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms`;
    
    if (statusCode >= 500) {
      logger.error(logMessage, { requestId });
    } else if (statusCode >= 400) {
      logger.warn(logMessage, { requestId });
    } else {
      logger.info(logMessage, { requestId });
    }
  });

  next();
};

// Create a stream for morgan logging
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Log unhandled exceptions
process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled Rejection:', {
    error: error.message,
    stack: error.stack,
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
  });
  // Don't exit in production, let the process manager handle it
  if (config.isDevelopment) {
    process.exit(1);
  }
});

export { logger };
