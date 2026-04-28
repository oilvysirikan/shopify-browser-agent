require('dotenv').config();
const express = require('express');
const axios = require('axios');
const facebookRoutes = require('./routes/facebook');
const facebookService = require('./services/facebookService');
const adScaleRoutes = require('./routes/adscale');
const dashboardRoutes = require('./routes/dashboard');
const {
  verifyShopifyWebhook,
  enforceTopicAllowlist,
  requireExpectedTopic,
  preventReplay
} = require('./middleware/shopifyWebhook');
const { requireApiKey, requireWorkerToken } = require('./middleware/auth');

const app = express();
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'facebook-feed-app' });
});

app.post(
  '/webhooks/products/update',
  verifyShopifyWebhook,
  enforceTopicAllowlist,
  requireExpectedTopic('products/update'),
  preventReplay,
  async (req, res) => {
  try {
    await forwardToRails('/webhooks/shopify/product_update', req.body);
    return res.status(200).json({ forwarded: true });
  } catch (error) {
    const message = error.response?.data || error.message;
    return res.status(500).json({ success: false, error: message });
  }
  }
);

app.post(
  '/webhooks/products/create',
  verifyShopifyWebhook,
  enforceTopicAllowlist,
  requireExpectedTopic('products/create'),
  preventReplay,
  async (req, res) => {
  try {
    await forwardToRails('/webhooks/shopify/product_create', req.body);
    return res.status(200).json({ forwarded: true });
  } catch (error) {
    const message = error.response?.data || error.message;
    return res.status(500).json({ success: false, error: message });
  }
  }
);

app.post(
  '/webhooks/products/delete',
  verifyShopifyWebhook,
  enforceTopicAllowlist,
  requireExpectedTopic('products/delete'),
  preventReplay,
  async (req, res) => {
  try {
    await forwardToRails('/webhooks/shopify/product_delete', req.body);
    return res.status(200).json({ forwarded: true });
  } catch (error) {
    const message = error.response?.data || error.message;
    return res.status(500).json({ success: false, error: message });
  }
  }
);

app.post('/sync/facebook', requireWorkerToken, async (req, res) => {
  const railsApiUrl = process.env.RAILS_API_URL;
  const products = req.body?.products || [];

  try {
    const result = await facebookService.syncProducts(products);

    if (railsApiUrl) {
      await axios.post(
        `${railsApiUrl}/sync/facebook/callback`,
        { result: { status: 'success', products_synced: result.synced, skipped: result.skipped, total: products.length } },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Worker-Token': process.env.WORKER_SHARED_TOKEN || ''
          }
        }
      );
    }

    return res.json({ success: true, ...result, total: products.length });
  } catch (error) {
    const message = error.response?.data || error.message;
    if (railsApiUrl) {
      try {
        await axios.post(
          `${railsApiUrl}/sync/facebook/callback`,
          { result: { status: 'failed', products_synced: 0, errors: [{ error: String(message) }] } },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Worker-Token': process.env.WORKER_SHARED_TOKEN || ''
            }
          }
        );
      } catch (_) {}
    }
    return res.status(500).json({ success: false, error: message });
  }
});

app.use('/api/facebook', requireApiKey, facebookRoutes);
app.use('/api/adscale', requireApiKey, adScaleRoutes);
app.use('/api/dashboard', requireApiKey, dashboardRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function forwardToRails(path, payload) {
  const railsApiUrl = process.env.RAILS_API_URL;
  if (!railsApiUrl) {
    throw new Error('Missing RAILS_API_URL');
  }

  return axios.post(`${railsApiUrl}${path}`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Token': process.env.WORKER_SHARED_TOKEN || '',
      'X-Webhook-Verified': 'true'
    }
  });
}
