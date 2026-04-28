class AdScaleService {
  constructor() {
    this.platforms = ['google', 'facebook', 'tiktok', 'pinterest'];
  }

  async optimizeBudget(campaigns, totalBudget) {
    const performance = await this.analyzeCampaignPerformance(campaigns);

    return campaigns.map((campaign) => {
      const score = this.calculateROASScore(campaign);
      const allocatedBudget = performance.totalScore > 0 ? (score / performance.totalScore) * totalBudget : 0;

      return {
        campaignId: campaign.id,
        platform: campaign.platform,
        currentBudget: campaign.budget,
        recommendedBudget: Number(allocatedBudget.toFixed(2)),
        expectedROAS: Number(this.predictROAS(campaign, allocatedBudget).toFixed(2))
      };
    });
  }

  async createLookalikeAudience(sourceAudience, platform) {
    const customerData = await this.getTopCustomers(sourceAudience);

    return {
      platform,
      audienceSize: customerData.length,
      demographics: this.analyzeDemographics(customerData),
      interests: this.extractInterests(customerData),
      behaviors: this.analyzeBehaviors(customerData),
      lookalikeSimilarity: 0.95
    };
  }

  async createDynamicProductAds(products) {
    const topProducts = await this.getTopPerformingProducts(products);

    return topProducts.map((product) => ({
      productId: product.id,
      adCreative: {
        headline: this.generateAIHeadline(product),
        description: this.generateAIDescription(product),
        image: this.selectBestImage(product.images || []),
        cta: this.recommendCTA(product)
      },
      targeting: this.getProductAudience(product),
      bidStrategy: this.optimizeBidding(product)
    }));
  }

  async trackAttribution(orderId) {
    return {
      orderId,
      touchpoints: [
        { channel: 'facebook', timestamp: '2026-02-01', contribution: 0.3 },
        { channel: 'google', timestamp: '2026-02-03', contribution: 0.5 },
        { channel: 'email', timestamp: '2026-02-05', contribution: 0.2 }
      ],
      attributionModel: 'data-driven',
      totalValue: 1500
    };
  }

  async getUnifiedAnalytics(dateRange) {
    const platforms = await Promise.all(this.platforms.map((p) => this.getPlatformMetrics(p, dateRange)));

    return {
      overview: {
        totalSpend: this.sumMetric(platforms, 'spend'),
        totalRevenue: this.sumMetric(platforms, 'revenue'),
        totalROAS: this.calculateTotalROAS(platforms),
        totalConversions: this.sumMetric(platforms, 'conversions')
      },
      byPlatform: platforms,
      recommendations: this.generateRecommendations(platforms)
    };
  }

  async generateAdCreatives(product, platform) {
    const variations = [];

    for (let i = 0; i < 5; i += 1) {
      variations.push({
        id: `creative_${i}`,
        platform,
        format: this.selectFormat(platform),
        headline: this.generateHeadlineVariation(product, i),
        description: this.generateDescriptionVariation(product, i),
        image: this.selectImageVariation(product.images || [], i),
        cta: this.selectCTA(platform, i),
        predictedCTR: Number((Math.random() * 5 + 2).toFixed(2)),
        predictedCVR: Number((Math.random() * 3 + 1).toFixed(2))
      });
    }

    return variations.sort((a, b) => b.predictedCTR - a.predictedCTR);
  }

  async runABTest(adVariations, budget, duration) {
    return {
      testId: `test_${Date.now()}`,
      variations: adVariations,
      budget: adVariations.length ? budget / adVariations.length : 0,
      duration,
      status: 'running',
      results: {
        winner: null,
        confidence: 0,
        metrics: []
      }
    };
  }

  async createRetargetingCampaign(segment) {
    const audiences = {
      cartAbandoners: await this.getCartAbandoners(),
      productViewers: await this.getProductViewers(),
      pastCustomers: await this.getPastCustomers()
    };

    return {
      segment,
      audience: audiences[segment] || [],
      adSequence: this.createAdSequence(segment),
      frequency: this.optimizeFrequency(segment),
      duration: this.calculateOptimalDuration(segment)
    };
  }

  async analyzeCampaignPerformance(campaigns) {
    const totalScore = campaigns.reduce((sum, c) => sum + this.calculateROASScore(c), 0);
    return { totalScore };
  }

  calculateROASScore(campaign) {
    const spend = Number(campaign.spend || campaign.budget || 0);
    const revenue = Number(campaign.revenue || 0);
    if (spend <= 0) return 0;
    return (revenue / spend) * 100;
  }

  predictROAS(campaign, newBudget) {
    const spend = Number(campaign.spend || campaign.budget || 0);
    const revenue = Number(campaign.revenue || 0);
    if (spend <= 0 || newBudget <= 0) return 0;
    const currentROAS = revenue / spend;
    const scaleFactor = Math.log(newBudget / spend || 1) * 0.8;
    return currentROAS * (1 + scaleFactor);
  }

  generateAIHeadline(product) {
    const templates = [
      `🎉 ${product.title} - ลดราคาพิเศษ!`,
      `✨ ${product.title} - คุณภาพพรีเมียม`,
      `🔥 ${product.title} - ขายดีอันดับ 1`,
      `💝 ${product.title} - ของขวัญสุดพิเศษ`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateAIDescription(product) {
    const description = String(product.description || '').replace(/<[^>]*>/g, '');
    return `${description.substring(0, 100)}... สั่งซื้อวันนี้รับส่วนลดพิเศษ! 🎁`;
  }

  async getPlatformMetrics(platform, _dateRange) {
    const spend = Math.random() * 10000 + 5000;
    const revenue = Math.random() * 50000 + 20000;
    return {
      platform,
      spend: Number(spend.toFixed(2)),
      revenue: Number(revenue.toFixed(2)),
      impressions: Math.floor(Math.random() * 100000 + 50000),
      clicks: Math.floor(Math.random() * 5000 + 1000),
      conversions: Math.floor(Math.random() * 200 + 50),
      roas: Number((revenue / spend).toFixed(2))
    };
  }

  generateRecommendations(platforms) {
    return platforms.map((p) => {
      const roas = p.spend > 0 ? p.revenue / p.spend : 0;
      if (roas > 4) return `${p.platform}: เพิ่มงบประมาณ +30% - ROAS สูง`;
      if (roas < 2) return `${p.platform}: ลดงบประมาณ -20% - ROAS ต่ำ`;
      return `${p.platform}: รักษางบประมาณปัจจุบัน`;
    });
  }

  sumMetric(platforms, key) {
    return Number(platforms.reduce((sum, p) => sum + Number(p[key] || 0), 0).toFixed(2));
  }

  calculateTotalROAS(platforms) {
    const spend = this.sumMetric(platforms, 'spend');
    const revenue = this.sumMetric(platforms, 'revenue');
    return spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;
  }

  analyzeDemographics(customers) {
    return {
      topAgeRange: '25-44',
      topGender: 'female',
      regions: [...new Set(customers.map((c) => c.region))].filter(Boolean)
    };
  }

  extractInterests(_customers) {
    return ['home decor', 'lifestyle', 'shopping', 'premium products'];
  }

  analyzeBehaviors(_customers) {
    return ['high_intent_buyers', 'repeat_buyers', 'discount_responders'];
  }

  getTopPerformingProducts(products = []) {
    return [...products]
      .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
      .slice(0, 10);
  }

  getProductAudience(product) {
    return {
      gender: 'all',
      age: '25-44',
      interests: [product.category || 'shopping', 'online buying']
    };
  }

  optimizeBidding(product) {
    return {
      strategy: 'maximize_conversion_value',
      maxCpc: Number((Number(product.price || 100) * 0.05).toFixed(2))
    };
  }

  selectBestImage(images) {
    return images[0]?.src || images[0] || null;
  }

  recommendCTA(_product) {
    return 'Shop Now';
  }

  selectFormat(platform) {
    if (platform === 'tiktok') return 'video';
    if (platform === 'pinterest') return 'pin';
    return 'image';
  }

  generateHeadlineVariation(product, i) {
    return `${product.title || 'Product'} - เวอร์ชัน ${i + 1}`;
  }

  generateDescriptionVariation(product, i) {
    return `${String(product.description || 'สินค้าคุณภาพสูง').slice(0, 80)}... (#${i + 1})`;
  }

  selectImageVariation(images, i) {
    if (!images.length) return null;
    const image = images[i % images.length];
    return image.src || image;
  }

  selectCTA(platform, i) {
    const map = {
      facebook: ['Shop Now', 'Learn More'],
      google: ['Buy Now', 'Shop Now'],
      tiktok: ['Order Now', 'Shop Now'],
      pinterest: ['Discover', 'Shop Now']
    };
    const options = map[platform] || ['Shop Now'];
    return options[i % options.length];
  }

  async getTopCustomers(_sourceAudience) {
    return [
      { id: 1, region: 'Bangkok' },
      { id: 2, region: 'Chiang Mai' },
      { id: 3, region: 'Phuket' }
    ];
  }

  async getCartAbandoners() {
    return [{ customerId: 'c1' }, { customerId: 'c2' }];
  }

  async getProductViewers() {
    return [{ customerId: 'v1' }, { customerId: 'v2' }];
  }

  async getPastCustomers() {
    return [{ customerId: 'p1' }, { customerId: 'p2' }];
  }

  createAdSequence(segment) {
    return [`${segment}_awareness`, `${segment}_consideration`, `${segment}_conversion`];
  }

  optimizeFrequency(segment) {
    const freq = { cartAbandoners: 5, productViewers: 4, pastCustomers: 3 };
    return freq[segment] || 3;
  }

  calculateOptimalDuration(segment) {
    const duration = { cartAbandoners: 7, productViewers: 14, pastCustomers: 30 };
    return duration[segment] || 14;
  }
}

module.exports = new AdScaleService();
