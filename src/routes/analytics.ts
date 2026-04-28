import { Router } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { errorMonitor } from '../utils/errorMonitor';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * GET /api/analytics/dashboard
 * Get dashboard data for the authenticated shop
 */
router.get('/dashboard', async (req, res) => {
  try {
    const shop = req.shop;
    const days = parseInt(req.query.days as string) || 30;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const data = await AnalyticsService.getDashboardData(shop, days);
    res.json(data);
  } catch (error) {
    errorMonitor.error('Error fetching dashboard data:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/analytics/events
 * Get filtered events with pagination
 */
router.get('/events', async (req, res) => {
  try {
    const shop = req.shop;
    const { eventType, status, limit = '50', offset = '0' } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const result = await AnalyticsService.getEvents({
      shop,
      eventType: eventType as string | undefined,
      status: status as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json({
      data: result.events,
      meta: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (error) {
    errorMonitor.error('Error fetching events:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/analytics/usage
 * Get current usage and quota for the shop
 */
router.get('/usage', async (req, res) => {
  try {
    const shop = req.shop;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const usage = await AnalyticsService.getShopUsage(shop);
    
    if (!usage) {
      // Initialize usage if not exists
      const newUsage = await AnalyticsService.trackEvent({
        shop,
        eventType: 'app_installed',
        status: 'success',
      });
      
      return res.json(newUsage);
    }

    res.json(usage);
  } catch (error) {
    errorMonitor.error('Error fetching usage data:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

export default router;
