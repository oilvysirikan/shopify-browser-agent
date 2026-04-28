import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      // Store user information in the request object
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: 'user' // Default role
      };
      return next();
    } catch (error) {
      logger.error('Token verification failed:', error);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
