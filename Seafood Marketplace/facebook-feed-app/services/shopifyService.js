const axios = require('axios');

class ShopifyService {
  constructor() {
    this.storeUrl = process.env.SHOPIFY_STORE_URL;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';
  }

  validateConfig() {
    if (!this.storeUrl) {
      throw new Error('Missing SHOPIFY_STORE_URL');
    }
    if (!this.accessToken) {
      throw new Error('Missing SHOPIFY_ACCESS_TOKEN');
    }
  }

  async getProducts(limit = 50) {
    this.validateConfig();
    const url = `https://${this.storeUrl}/admin/api/${this.apiVersion}/products.json`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      },
      params: { limit }
    });

    return response.data.products || [];
  }
}

module.exports = new ShopifyService();
