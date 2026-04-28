const { createClient } = require('redis');

const DEFAULT_TTL_SECONDS = 60 * 60;

class WebhookReplayStore {
  constructor() {
    this.ttlSeconds = Number(process.env.SHOPIFY_WEBHOOK_TTL_SECONDS || DEFAULT_TTL_SECONDS);
    this.redisUrl = process.env.REDIS_URL;
    this.client = null;
    this.clientReady = false;
    this.memoryStore = new Map();

    this.startCleanupTimer();
  }

  async markSeen(webhookId) {
    if (!webhookId) return false;

    const key = `shopify:webhook:${webhookId}`;

    const usedRedis = await this.tryRedisSetIfNotExists(key);
    if (usedRedis !== null) {
      return usedRedis;
    }

    return this.setInMemoryIfNotExists(key);
  }

  async tryRedisSetIfNotExists(key) {
    if (!this.redisUrl) return null;

    try {
      const client = await this.getRedisClient();
      const result = await client.set(key, '1', { NX: true, EX: this.ttlSeconds });
      return result === 'OK';
    } catch (_error) {
      return null;
    }
  }

  async getRedisClient() {
    if (!this.client) {
      this.client = createClient({ url: this.redisUrl });
      this.client.on('error', () => {
        this.clientReady = false;
      });
    }

    if (!this.clientReady) {
      await this.client.connect();
      this.clientReady = true;
    }

    return this.client;
  }

  setInMemoryIfNotExists(key) {
    const now = Date.now();
    const expiresAt = now + this.ttlSeconds * 1000;

    const existing = this.memoryStore.get(key);
    if (existing && existing > now) {
      return false;
    }

    this.memoryStore.set(key, expiresAt);
    return true;
  }

  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, expiry] of this.memoryStore.entries()) {
        if (expiry <= now) {
          this.memoryStore.delete(key);
        }
      }
    }, 60_000).unref();
  }
}

module.exports = new WebhookReplayStore();
