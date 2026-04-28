const adScaleService = require('../services/adScaleService');

class DashboardController {
  async getOverview(req, res) {
    try {
      const analytics = await adScaleService.getUnifiedAnalytics({
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });

      res.json({
        metrics: analytics.overview,
        platforms: analytics.byPlatform,
        recommendations: analytics.recommendations,
        topProducts: this.getTopProducts(),
        recentOrders: this.getRecentOrders()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  getTopProducts() {
    return [
      { id: 'p1', name: 'Top Product 1', revenue: 12000 },
      { id: 'p2', name: 'Top Product 2', revenue: 9800 }
    ];
  }

  getRecentOrders() {
    return [
      { id: 'o1', amount: 1500, channel: 'facebook' },
      { id: 'o2', amount: 2300, channel: 'google' }
    ];
  }
}

module.exports = new DashboardController();
