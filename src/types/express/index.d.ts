import { Request, Response, NextFunction } from 'express';

declare module 'express' {
  interface Request {
    user?: any; // You can replace 'any' with your user type
  }
}

export {};
