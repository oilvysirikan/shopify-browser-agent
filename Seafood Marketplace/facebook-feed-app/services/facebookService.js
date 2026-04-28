const bizSdk = require('facebook-nodejs-business-sdk');

const FacebookAdsApi = bizSdk.FacebookAdsApi;
const ProductCatalog = bizSdk.ProductCatalog;
const ProductItem = bizSdk.ProductItem;

class FacebookService {
  constructor() {
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.catalogId = process.env.FACEBOOK_CATALOG_ID;
    this.catalog = null;
    this.initialized = false;
    this.brand = process.env.FACEBOOK_BRAND || 'ALINDA DECOR';
    this.baseProductUrl =
      process.env.FACEBOOK_BASE_PRODUCT_URL || 'https://alindadecor.com/products';
  }

  init() {
    if (this.initialized) return;
    if (!this.accessToken) {
      throw new Error('Missing FACEBOOK_ACCESS_TOKEN');
    }
    if (!this.catalogId) {
      throw new Error('Missing FACEBOOK_CATALOG_ID');
    }
    FacebookAdsApi.init(this.accessToken);
    this.catalog = new ProductCatalog(this.catalogId);
    this.initialized = true;
  }

  buildProductData(product) {
    const normalized = this.normalizeProduct(product);
    if (!normalized) {
      return null;
    }

    return {
      retailer_id: String(product.id || normalized.handle),
      [ProductItem.Fields.name]: normalized.title,
      [ProductItem.Fields.description]: normalized.description || normalized.title,
      [ProductItem.Fields.availability]:
        normalized.available ? 'in stock' : 'out of stock',
      [ProductItem.Fields.condition]: 'new',
      [ProductItem.Fields.price]: `${normalized.price} THB`,
      [ProductItem.Fields.link]: `${this.baseProductUrl}/${normalized.handle}`,
      [ProductItem.Fields.image_link]: normalized.image,
      [ProductItem.Fields.brand]: this.brand
    };
  }

  normalizeProduct(product) {
    if (!product) return null;

    if (product.variants?.[0]) {
      const variant = product.variants[0];
      return {
        title: product.title,
        description: product.body_html,
        price: variant.price,
        available: Number(variant.inventory_quantity) > 0,
        handle: product.handle,
        image: product.images?.[0]?.src
      };
    }

    return {
      title: product.title || product.name,
      description: product.description || product.body_html || product.name,
      price: product.price,
      available:
        typeof product.available === 'boolean'
          ? product.available
          : Number(product.inventory_quantity || product.stock || 0) > 0,
      handle: product.handle || String(product.id),
      image: product.image || product.image_link
    };
  }

  async upsertProduct(product) {
    this.init();
    const productData = this.buildProductData(product);
    if (!productData) {
      return { synced: false, skipped: true };
    }

    await this.catalog.createProduct([], productData);
    return { synced: true, skipped: false };
  }

  async syncProducts(shopifyProducts) {
    let synced = 0;
    let skipped = 0;

    for (const product of shopifyProducts) {
      const result = await this.upsertProduct(product);
      if (result.synced) synced += 1;
      if (result.skipped) skipped += 1;
    }

    return { synced, skipped };
  }
}

module.exports = new FacebookService();
