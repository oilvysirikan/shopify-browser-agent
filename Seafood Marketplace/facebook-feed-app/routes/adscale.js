const express = require('express');
const adScaleService = require('../services/adScaleService');

const router = express.Router();

router.post('/optimize-budget', async (req, res) => {
  try {
    const { campaigns = [], totalBudget = 0 } = req.body;
    const optimization = await adScaleService.optimizeBudget(campaigns, Number(totalBudget));
    res.json(optimization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/audience/lookalike', async (req, res) => {
  try {
    const { sourceAudience = [], platform = 'facebook' } = req.body;
    const audience = await adScaleService.createLookalikeAudience(sourceAudience, platform);
    res.json(audience);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ads/dynamic-products', async (req, res) => {
  try {
    const { products = [] } = req.body;
    const ads = await adScaleService.createDynamicProductAds(products);
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await adScaleService.getUnifiedAnalytics({ startDate, endDate });
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/creatives/generate', async (req, res) => {
  try {
    const { product = {}, platform = 'facebook' } = req.body;
    const creatives = await adScaleService.generateAdCreatives(product, platform);
    res.json(creatives);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test/ab', async (req, res) => {
  try {
    const { variations = [], budget = 0, duration = 7 } = req.body;
    const test = await adScaleService.runABTest(variations, Number(budget), Number(duration));
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/retargeting', async (req, res) => {
  try {
    const { segment = 'cartAbandoners' } = req.body;
    const campaign = await adScaleService.createRetargetingCampaign(segment);
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/attribution/:orderId', async (req, res) => {
  try {
    const attribution = await adScaleService.trackAttribution(req.params.orderId);
    res.json(attribution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
