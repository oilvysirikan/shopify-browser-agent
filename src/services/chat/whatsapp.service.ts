import { logger } from '../../utils/logger.js';
import axios from 'axios';

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  verifyToken: string;
}

export interface WhatsAppMessage {
  type: 'text' | 'image' | 'template';
  text?: string;
  imageUrl?: string;
  templateName?: string;
  templateParams?: any[];
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface CartItem {
  sku: string;
  name: string;
  price: number;
  qty: number;
}

export interface Cart {
  items: CartItem[];
}

export class WhatsAppService {
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  /**
   * Verify webhook from Meta
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Send text message
   */
  async sendText(to: string, text: string): Promise<void> {
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      logger.info('WhatsApp message sent successfully');
    } catch (error) {
      logger.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send template message
   */
  async sendTemplate(to: string, templateName: string, params: any[] = []): Promise<void> {
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'th' },
            components: params
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      logger.info('WhatsApp template sent successfully');
    } catch (error) {
      logger.error('Failed to send WhatsApp template:', error);
      throw error;
    }
  }

  /**
   * Parse webhook payload
   */
  parseWebhook(payload: WhatsAppWebhookPayload): Array<{
    from: string;
    text: string;
    name?: string;
    timestamp: string;
  }> {
    const messages: any[] = [];
    
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const contacts = value.contacts || [];
        const msgs = value.messages || [];

        for (const msg of msgs) {
          if (msg.type === 'text' && msg.text?.body) {
            const contact = contacts.find(c => c.wa_id === msg.from);
            messages.push({
              from: msg.from,
              text: msg.text.body,
              name: contact?.profile?.name,
              timestamp: msg.timestamp
            });
          }
        }
      }
    }

    return messages;
  }

  /**
   * Cart operations
   */
  addToCart(cart: Cart, item: CartItem): void {
    const existing = cart.items.find(i => i.sku === item.sku);
    if (existing) {
      existing.qty += item.qty;
    } else {
      cart.items.push(item);
    }
  }

  cartTotal(cart: Cart): number {
    return cart.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }

  formatCartMessage(cart: Cart): string {
    if (cart.items.length === 0) {
      return 'ตะกร้าว่างเปล่า 🛒';
    }

    const items = cart.items.map(item => 
      `- ${item.name} x${item.qty} = ฿${item.price * item.qty}`
    ).join('\n');

    return `🛒 ตะกร้าของคุณ:\n${items}\n\n💰 รวมทั้งหมด: ฿${this.cartTotal(cart)}`;
  }

  /**
   * Check if text is add to cart command
   */
  parseAddCommand(text: string): string | null {
    const lower = text.toLowerCase().trim();
    const prefixes = ['add ', 'เพิ่ม ', '+'];
    
    for (const prefix of prefixes) {
      if (lower.startsWith(prefix)) {
        return lower.slice(prefix.length).trim().toUpperCase();
      }
    }
    return null;
  }

  /**
   * Format product list
   */
  formatProductList(products: any[]): string {
    if (products.length === 0) {
      return 'ไม่พบสินค้าที่ค้นหา 😔';
    }

    const list = products.map((p, i) => 
      `${i + 1}. ${p.name}\n   ราคา: ฿${p.price}\n   พิมพ์: add ${p.sku}`
    ).join('\n\n');

    return `📦 สินค้าที่แนะนำ:\n\n${list}`;
  }
}

export const whatsAppService = new WhatsAppService({
  token: process.env.WHATSAPP_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || ''
});
