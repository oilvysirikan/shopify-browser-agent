import { logger } from '../../utils/logger.js';
import OpenAI from 'openai';

export interface PricingRule {
  id: string;
  productId: string;
  type: 'dynamic' | 'competitor' | 'demand' | 'time';
  conditions: {
    minStock?: number;
    maxStock?: number;
    competitorPrice?: number;
    demandLevel?: 'low' | 'medium' | 'high';
    timeOfDay?: { start: string; end: string };
  };
  adjustments: {
    type: 'percentage' | 'fixed';
    value: number;
    direction: 'increase' | 'decrease';
  };
  active: boolean;
}

export interface CompetitorPrice {
  competitor: string;
  productId: string;
  price: number;
  lastUpdated: Date;
}

export class PricingAIService {
  private openai: OpenAI;
  private pricingRules: Map<string, PricingRule> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * AI-powered dynamic pricing recommendation
   */
  async recommendPrice(params: {
    productId: string;
    currentPrice: number;
    cost: number;
    stockLevel: number;
    salesVelocity: number;
    competitorPrices: CompetitorPrice[];
    seasonality?: string;
  }): Promise<{
    recommendedPrice: number;
    confidence: number;
    reasoning: string;
    maxDiscount: number;
  }> {
    const prompt = `
Recommend optimal price for:
- Current: ฿${params.currentPrice}
- Cost: ฿${params.cost}
- Stock: ${params.stockLevel}
- Sales velocity: ${params.salesVelocity}/day
- Competitors: ${JSON.stringify(params.competitorPrices)}
- Season: ${params.seasonality || 'normal'}

Return JSON with recommendation and reasoning.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      logger.error('Price recommendation failed:', error);
      return {
        recommendedPrice: params.currentPrice,
        confidence: 0.5,
        reasoning: 'Default price maintained due to AI error',
        maxDiscount: 0.1
      };
    }
  }

  /**
   * Demand-based pricing adjustment
   */
  calculateDemandBasedPrice(
    basePrice: number,
    stockLevel: number,
    salesLast7Days: number,
    salesLast30Days: number
  ): { newPrice: number; reason: string } {
    const velocity7 = salesLast7Days / 7;
    const velocity30 = salesLast30Days / 30;
    const stockVelocity = stockLevel / (velocity7 || 1);

    // High demand, low stock = increase price
    if (velocity7 > velocity30 * 1.5 && stockLevel < 10) {
      return {
        newPrice: Math.round(basePrice * 1.15),
        reason: 'High demand, limited stock'
      };
    }

    // Low demand, high stock = decrease price
    if (velocity7 < velocity30 * 0.5 && stockLevel > 50) {
      return {
        newPrice: Math.round(basePrice * 0.85),
        reason: 'Low demand, excess stock'
      };
    }

    return { newPrice: basePrice, reason: 'Stable demand' };
  }

  /**
   * Competitor-based pricing
   */
  async competitorBasedPrice(
    productId: string,
    ourCost: number,
    competitors: CompetitorPrice[]
  ): Promise<{ price: number; strategy: string }> {
    if (competitors.length === 0) {
      return { price: ourCost * 2, strategy: 'cost_plus' };
    }

    const avgCompetitor = competitors.reduce((sum, c) => sum + c.price, 0) / competitors.length;
    const minCompetitor = Math.min(...competitors.map(c => c.price));

    // AI decision on pricing strategy
    const prompt = `
Competitor prices: ${JSON.stringify(competitors)}
Our cost: ฿${ourCost}
Average competitor: ฿${avgCompetitor}
Minimum competitor: ฿${minCompetitor}

Choose pricing strategy: match, undercut, premium, or cost-plus.
Return JSON with price and strategy.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      // Default to match lowest competitor with margin
      const safePrice = Math.max(minCompetitor - 10, ourCost * 1.3);
      return { price: Math.round(safePrice), strategy: 'match_minus' };
    }
  }

  /**
   * Time-based pricing (flash sales, happy hours)
   */
  getTimeBasedPrice(
    basePrice: number,
    rules: Array<{ hour: number; discount: number }>
  ): { currentPrice: number; activeRule?: string } {
    const hour = new Date().getHours();
    const activeRule = rules.find(r => r.hour === hour);

    if (activeRule) {
      return {
        currentPrice: Math.round(basePrice * (1 - activeRule.discount)),
        activeRule: `Hour ${hour}: ${activeRule.discount * 100}% off`
      };
    }

    return { currentPrice: basePrice };
  }

  /**
   * Bundle pricing optimization
   */
  async optimizeBundle(
    products: Array<{ id: string; price: number; margin: number }>
  ): Promise<{
    bundlePrice: number;
    savings: number;
    margin: number;
    recommended: boolean;
  }> {
    const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
    const totalMargin = products.reduce((sum, p) => sum + p.margin, 0);

    // AI decides optimal bundle discount
    const prompt = `
Products in bundle:
${JSON.stringify(products)}
Total price: ฿${totalPrice}
Total margin: ฿${totalMargin}

Recommend bundle price (must maintain positive margin).
Return JSON with price and savings amount.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      // Default: 10% bundle discount
      const discount = totalPrice * 0.1;
      return {
        bundlePrice: Math.round(totalPrice - discount),
        savings: Math.round(discount),
        margin: totalMargin - discount,
        recommended: true
      };
    }
  }

  /**
   * Create pricing rule
   */
  createRule(rule: Omit<PricingRule, 'id'>): PricingRule {
    const newRule: PricingRule = {
      ...rule,
      id: `rule_${Date.now()}`
    };
    this.pricingRules.set(newRule.id, newRule);
    return newRule;
  }

  /**
   * Apply pricing rules to product
   */
  applyRules(productId: string, basePrice: number, context: any): number {
    let finalPrice = basePrice;

    for (const rule of this.pricingRules.values()) {
      if (!rule.active || rule.productId !== productId) continue;

      const shouldApply = this.checkRuleConditions(rule, context);
      if (shouldApply) {
        finalPrice = this.calculateAdjustment(finalPrice, rule.adjustments);
      }
    }

    return Math.round(finalPrice);
  }

  private checkRuleConditions(rule: PricingRule, context: any): boolean {
    const { conditions } = rule;

    if (conditions.minStock !== undefined && context.stock < conditions.minStock) {
      return false;
    }

    if (conditions.maxStock !== undefined && context.stock > conditions.maxStock) {
      return false;
    }

    if (conditions.demandLevel && context.demand !== conditions.demandLevel) {
      return false;
    }

    return true;
  }

  private calculateAdjustment(price: number, adjustment: PricingRule['adjustments']): number {
    if (adjustment.type === 'percentage') {
      const multiplier = adjustment.direction === 'increase' 
        ? 1 + adjustment.value 
        : 1 - adjustment.value;
      return price * multiplier;
    } else {
      return adjustment.direction === 'increase' 
        ? price + adjustment.value 
        : price - adjustment.value;
    }
  }

  /**
   * Price elasticity analysis
   */
  async analyzePriceElasticity(
    priceHistory: Array<{ price: number; quantity: number; date: string }>
  ): Promise<{
    elasticity: number;
    optimalPrice: number;
    recommendation: string;
  }> {
    const prompt = `
Price history:
${JSON.stringify(priceHistory)}

Calculate price elasticity and recommend optimal price.
Return JSON with elasticity coefficient and recommendation.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      return {
        elasticity: 1,
        optimalPrice: priceHistory[priceHistory.length - 1]?.price || 0,
        recommendation: 'Maintain current price'
      };
    }
  }
}

export const pricingAIService = new PricingAIService();
