import { Express, Request, Response, NextFunction, RequestHandler } from 'express';

export function applySecurityMiddleware(app: Express): void;

export const security: {
  cors: RequestHandler;
  rateLimit: RequestHandler;
  requestId: RequestHandler;
  securityHeaders: RequestHandler;
  securityErrorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
  requestLogger: RequestHandler;
};
