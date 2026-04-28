const facebookService = require('../services/facebookService');
const shopifyService = require('../services/shopifyService');

class FeedController {
  health(_req, res) {
    res.json({ status: 'ok', route: 'facebook' });
  }

  async syncProducts(req, res) {
    try {
      const limit = Number(req.body?.limit || req.query?.limit || 50);
      const products = await shopifyService.getProducts(limit);

      const result = await facebookService.syncProducts(products);

      return res.json({
        success: true,
        fetched: products.length,
        synced: result.synced,
        skipped: result.skipped
      });
    } catch (error) {
      const message = error.response?.data || error.message;
      return res.status(500).json({ success: false, error: message });
    }
  }
}

module.exports = new FeedController();
