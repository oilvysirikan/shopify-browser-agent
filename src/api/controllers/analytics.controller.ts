import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { AnalyticsService } from '../../services/analyticsService';

export class AnalyticsController {
  /**
   * Get shop analytics dashboard data
   */
  public getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = this.getShopDomain(req);
      const { days = '30' } = req.query;
      
      const dashboardData = await AnalyticsService.getDashboardData(
        shop,
        parseInt(days as string, 10)
      );
      
      res.json({
        status: 'success',
        data: dashboardData,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get shop usage metrics
   */
  public getUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = this.getShopDomain(req);
      const usage = await AnalyticsService.getShopUsage(shop);
      
      res.json({
        status: 'success',
        data: usage,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get analytics events with filtering
   */
  public getEvents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = this.getShopDomain(req);
      const { 
        eventType, 
        status, 
        limit = '100', 
        offset = '0' 
      } = req.query;
      
      const { events, total } = await AnalyticsService.getEvents({
        shop,
        eventType: eventType as string | undefined,
        status: status as 'success' | 'failed' | 'pending' | undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });
      
      res.json({
        status: 'success',
        data: {
          events,
          total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get event types for filtering
   */
  public getEventTypes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = this.getShopDomain(req);
      
      // Get distinct event types
      const eventTypes = await AnalyticsService.getEventTypes(shop);
      
      res.json({
        status: 'success',
        data: eventTypes,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper to get shop domain from request
   */
  private getShopDomain(req: Request): string {
    const shop = req.headers['x-shopify-shop-domain'] || req.query.shop;
    if (!shop) {
      throw new AppError('Shop domain is required', 400);
    }
    return shop as string;
  }
}

export const analyticsController = new AnalyticsController();
