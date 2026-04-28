const crypto = require('crypto');
const replayStore = require('../services/webhookReplayStore');

const DEFAULT_ALLOWED_TOPICS = [
  'products/update',
  'products/create',
  'products/delete'
];

function verifyShopifyWebhook(req, res, next) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Missing SHOPIFY_API_SECRET' });
  }

  const hmacHeader = req.get('x-shopify-hmac-sha256');
  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing Shopify signature' });
  }

  const body = req.rawBody || '';
  const digest = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');

  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader);
  const valid =
    digestBuffer.length === headerBuffer.length &&
    crypto.timingSafeEqual(digestBuffer, headerBuffer);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid Shopify signature' });
  }

  return next();
}

function enforceTopicAllowlist(req, res, next) {
  const configured = process.env.SHOPIFY_ALLOWED_TOPICS;
  const allowlist = configured
    ? configured.split(',').map((t) => t.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_TOPICS;

  const topic = req.get('x-shopify-topic');
  if (!topic) {
    return res.status(401).json({ error: 'Missing Shopify topic' });
  }

  if (!allowlist.includes(topic)) {
    return res.status(403).json({ error: `Topic not allowed: ${topic}` });
  }

  return next();
}

function requireExpectedTopic(expectedTopic) {
  return (req, res, next) => {
    const topic = req.get('x-shopify-topic');
    if (topic !== expectedTopic) {
      return res.status(403).json({ error: `Unexpected topic for this endpoint: ${topic}` });
    }
    return next();
  };
}

async function preventReplay(req, res, next) {
  const webhookId = req.get('x-shopify-webhook-id');
  if (!webhookId) {
    return res.status(401).json({ error: 'Missing Shopify webhook id' });
  }

  const isNew = await replayStore.markSeen(webhookId);
  if (!isNew) {
    return res.status(409).json({ error: 'Duplicate webhook detected' });
  }

  return next();
}

module.exports = {
  verifyShopifyWebhook,
  enforceTopicAllowlist,
  requireExpectedTopic,
  preventReplay
};
