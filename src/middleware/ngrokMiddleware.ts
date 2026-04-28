import { Request, Response, NextFunction } from 'express';

export const skipNgrokWarning = (req: Request, res: Response, next: NextFunction) => {
  // Skip ngrok warning page
  if (req.headers['x-forwarded-proto'] === 'http') {
    req.headers['x-forwarded-proto'] = 'https';
  }
  next();
};

// Middleware to ensure secure connections in production
export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  // Skip in development or if already secure
  if (process.env.NODE_ENV !== 'production' || req.secure) {
    return next();
  }

  // Redirect to HTTPS in production
  res.redirect(`https://${req.headers.host}${req.url}`);
};
