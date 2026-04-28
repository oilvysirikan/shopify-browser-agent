import { logger } from '../../utils/logger.js';
import axios from 'axios';
import crypto from 'crypto';

export interface LineConfig {
  channelSecret: string;
  channelAccessToken: string;
}

export interface LineMessage {
  type: 'text' | 'image' | 'flex';
  text?: string;
  altText?: string;
  contents?: any;
}

export interface LineEvent {
  type: string;
  replyToken?: string;
  message?: {
    type: string;
    text?: string;
    id?: string;
  };
  postback?: {
    data: string;
  };
  source: {
    userId: string;
    type: string;
  };
}

export class LineService {
  private config: LineConfig;

  constructor(config: LineConfig) {
    this.config = config;
  }

  /**
   * Verify LINE webhook signature
   */
  verifySignature(body: string, signature: string | undefined): boolean {
    if (!signature) return false;
    
    const hash = crypto
      .createHmac('SHA256', this.config.channelSecret)
      .update(body)
      .digest('base64');
    
    return signature === hash;
  }

  /**
   * Send reply message to LINE
   */
  async reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/reply',
        {
          replyToken,
          messages: messages.map(msg => {
            if (msg.type === 'text') {
              return { type: 'text', text: msg.text };
            }
            if (msg.type === 'flex') {
              return {
                type: 'flex',
                altText: msg.altText || 'Message',
                contents: msg.contents
              };
            }
            return msg;
          })
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.channelAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      logger.info('LINE reply sent successfully');
    } catch (error) {
      logger.error('Failed to send LINE reply:', error);
      throw error;
    }
  }

  /**
   * Send push message to user
   */
  async push(userId: string, messages: LineMessage[]): Promise<void> {
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        {
          to: userId,
          messages: messages.map(msg => {
            if (msg.type === 'text') {
              return { type: 'text', text: msg.text };
            }
            return msg;
          })
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.channelAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      logger.info('LINE push message sent successfully');
    } catch (error) {
      logger.error('Failed to send LINE push:', error);
      throw error;
    }
  }

  /**
   * Build product carousel message
   */
  buildProductCarousel(products: any[], altText: string = 'สินค้าแนะนำ'): LineMessage {
    const bubbles = products.map(product => ({
      type: 'bubble',
      hero: {
        type: 'image',
        url: product.image || 'https://via.placeholder.com/300',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: product.name,
            weight: 'bold',
            size: 'md',
            wrap: true
          },
          {
            type: 'text',
            text: `฿${product.price}`,
            color: '#888888',
            size: 'sm',
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: 'เพิ่มลงตะกร้า',
              data: `action=add_to_cart&product_id=${product.id}`
            }
          }
        ]
      }
    }));

    return {
      type: 'flex',
      altText,
      contents: {
        type: 'carousel',
        contents: bubbles
      }
    };
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(body: string, signature: string | undefined): Promise<LineEvent[]> {
    if (!this.verifySignature(body, signature)) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(body);
    return payload.events || [];
  }

  /**
   * Detect if text is product search query
   */
  looksLikeProductSearch(text: string): boolean {
    const keywords = ['ไมค์', 'สินค้า', 'แนะนำ', 'ราคา', 'มี', 'ซื้อ', 'หา', 'ดู', 'product', 'price', 'buy'];
    const t = text.toLowerCase();
    return keywords.some(k => t.includes(k));
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string }> {
    try {
      const response = await axios.get(
        `https://api.line.me/v2/bot/profile/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.channelAccessToken}`
          }
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get LINE profile:', error);
      return { displayName: 'Unknown User' };
    }
  }
}

export const lineService = new LineService({
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
});
