import { logger } from '../../utils/logger.js';
import OpenAI from 'openai';

export interface MarketingCampaign {
  id: string;
  name: string;
  type: 'email' | 'social' | 'sms' | 'push';
  target: 'all' | 'new' | 'returning' | 'segment';
  content: string;
  scheduledAt?: Date;
  status: 'draft' | 'scheduled' | 'running' | 'completed';
  metrics?: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
  };
}

export interface CustomerSegment {
  id: string;
  name: string;
  criteria: {
    minOrders?: number;
    maxOrders?: number;
    minSpend?: number;
    lastPurchaseDays?: number;
    tags?: string[];
  };
  customerCount: number;
}

export class MarketingAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate AI-powered marketing content
   */
  async generateContent(params: {
    productName: string;
    targetAudience: string;
    tone: 'professional' | 'casual' | 'funny' | 'urgent';
    channel: 'email' | 'social' | 'sms';
    goal: 'sales' | 'awareness' | 'retention';
  }): Promise<{
    headline: string;
    body: string;
    cta: string;
    hashtags?: string[];
  }> {
    const prompt = `
Generate marketing content for:
Product: ${params.productName}
Target: ${params.targetAudience}
Tone: ${params.tone}
Channel: ${params.channel}
Goal: ${params.goal}

Respond in JSON format:
{
  "headline": "catchy headline (max 60 chars)",
  "body": "main content (2-3 sentences)",
  "cta": "call to action text",
  "hashtags": ["tag1", "tag2"]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      logger.error('Marketing AI content generation failed:', error);
      return {
        headline: `🛍️ ${params.productName} - สินค้าขายดี!`,
        body: 'สินค้าคุณภาพดี ราคาพิเศษ สั่งเลยวันนี้!',
        cta: 'ซื้อเลย',
        hashtags: ['#สินค้าดี', '#ราคาพิเศษ']
      };
    }
  }

  /**
   * Create customer segments using AI
   */
  async createSmartSegments(customers: any[]): Promise<CustomerSegment[]> {
    const prompt = `
Analyze these customers and create 3-5 segments:
${JSON.stringify(customers.slice(0, 20))}

Return JSON array of segments with criteria.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.segments || this.getDefaultSegments();
    } catch (error) {
      logger.error('Segment creation failed:', error);
      return this.getDefaultSegments();
    }
  }

  /**
   * Personalized product recommendations
   */
  async generateRecommendations(customerId: string, purchaseHistory: any[]): Promise<any[]> {
    const prompt = `
Based on purchase history: ${JSON.stringify(purchaseHistory)}

Suggest 5 related products with reasons.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.recommendations || [];
    } catch (error) {
      logger.error('Recommendation generation failed:', error);
      return [];
    }
  }

  /**
   * Abandoned cart recovery campaign
   */
  async createAbandonedCartCampaign(cart: any): Promise<MarketingCampaign> {
    const content = await this.generateContent({
      productName: cart.items.map((i: any) => i.name).join(', '),
      targetAudience: 'abandoned cart users',
      tone: 'urgent',
      channel: 'email',
      goal: 'sales'
    });

    return {
      id: `cart_${Date.now()}`,
      name: 'Abandoned Cart Recovery',
      type: 'email',
      target: 'segment',
      content: `${content.headline}\n\n${content.body}\n\n${content.cta}`,
      status: 'draft'
    };
  }

  /**
   * Win-back campaign for inactive customers
   */
  async createWinBackCampaign(inactiveDays: number = 30): Promise<MarketingCampaign> {
    const content = await this.generateContent({
      productName: 'Special Offer',
      targetAudience: `inactive ${inactiveDays} days customers`,
      tone: 'funny',
      channel: 'email',
      goal: 'retention'
    });

    return {
      id: `winback_${Date.now()}`,
      name: `Win-Back (${inactiveDays} days)`,
      type: 'email',
      target: 'segment',
      content: `${content.headline}\n\n${content.body}\n\n${content.cta}`,
      status: 'draft'
    };
  }

  /**
   * AI-powered flash sale decision
   */
  async shouldRunFlashSale(metrics: any): Promise<{
    shouldRun: boolean;
    discount: number;
    duration: number;
    reason: string;
  }> {
    const prompt = `
Store metrics:
- Conversion rate: ${metrics.conversionRate}%
- Traffic today: ${metrics.traffic}
- Sales today: ฿${metrics.sales}
- Average order value: ฿${metrics.aov}

Should we run a flash sale? Return JSON with decision.
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
      logger.error('Flash sale decision failed:', error);
      return { shouldRun: false, discount: 0, duration: 0, reason: 'AI error' };
    }
  }

  private getDefaultSegments(): CustomerSegment[] {
    return [
      {
        id: 'vip',
        name: 'VIP Customers',
        criteria: { minOrders: 5, minSpend: 5000 },
        customerCount: 0
      },
      {
        id: 'new',
        name: 'New Customers',
        criteria: { maxOrders: 1 },
        customerCount: 0
      },
      {
        id: 'inactive',
        name: 'Inactive (30d)',
        criteria: { lastPurchaseDays: 30 },
        customerCount: 0
      }
    ];
  }
}

export const marketingAIService = new MarketingAIService();
