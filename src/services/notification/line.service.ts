import axios from 'axios';
import { prisma } from '../../prisma';

export interface LineNotificationConfig {
  channelAccessToken: string;
  channelSecret: string;
  notifyUserId: string;
}

export class LineNotificationService {
  private static readonly LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

  /**
   * Send a notification to LINE
   */
  static async sendNotification(shop: string, message: string, config: LineNotificationConfig) {
    try {
      const response = await axios.post(
        LineNotificationService.LINE_API_URL,
        {
          to: config.notifyUserId,
          messages: [
            {
              type: 'text',
              text: message,
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.channelAccessToken}`,
          },
        }
      );

      // Log the notification
      await this.logNotification(shop, {
        type: 'LINE',
        recipient: config.notifyUserId,
        message,
        status: 'SENT',
        response: response.data,
      });

      return true;
    } catch (error) {
      console.error('Failed to send LINE notification:', error);
      
      // Log the failed notification
      await this.logNotification(shop, {
        type: 'LINE',
        recipient: config.notifyUserId,
        message,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return false;
    }
  }

  /**
   * Send payment notification
   */
  static async sendPaymentNotification(
    shop: string,
    paymentData: {
      orderId?: string;
      amount: number;
      status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
      referenceNo?: string;
      paidBy?: string;
    },
    config: LineNotificationConfig
  ) {
    const { orderId, amount, status, referenceNo, paidBy } = paymentData;
    
    let message = '';
    
    switch (status) {
      case 'PENDING':
        message = `🔄 หมายเลขคำสั่งซื้อ: ${orderId || 'N/A'}\n` +
                 `💰 จำนวนเงิน: ฿${amount.toFixed(2)}\n` +
                 `🕒 กรุณาชำระเงินภายใน 15 นาที`;
        break;
        
      case 'PAID':
        message = `✅ ชำระเงินสำเร็จ\n` +
                 `📦 หมายเลขคำสั่งซื้อ: ${orderId || 'N/A'}\n` +
                 `💰 จำนวนเงิน: ฿${amount.toFixed(2)}\n` +
                 `📝 เลขอ้างอิง: ${referenceNo || 'N/A'}\n` +
                 `👤 ชำระโดย: ${paidBy || 'N/A'}`;
        break;
        
      case 'FAILED':
        message = `❌ การชำระเงินล้มเหลว\n` +
                 `📦 หมายเลขคำสั่งซื้อ: ${orderId || 'N/A'}\n` +
                 `💰 จำนวนเงิน: ฿${amount.toFixed(2)}\n` +
                 `📝 รายละเอียด: เกิดข้อผิดพลาดในการชำระเงิน`;
        break;
        
      case 'EXPIRED':
        message = `⏰ QR Code หมดอายุแล้ว\n` +
                 `📦 หมายเลขคำสั่งซื้อ: ${orderId || 'N/A'}\n` +
                 `💰 จำนวนเงิน: ฿${amount.toFixed(2)}\n` +
                 `ℹ️ กรุณาสร้าง QR Code ใหม่หากต้องการชำระเงิน`;
        break;
    }
    
    return this.sendNotification(shop, message, config);
  }

  /**
   * Log notification to database
   */
  private static async logNotification(
    shop: string,
    data: {
      type: string;
      recipient: string;
      message: string;
      status: 'SENT' | 'FAILED';
      response?: any;
      error?: string;
    }
  ) {
    try {
      await prisma.notification.create({
        data: {
          shop,
          type: data.type,
          recipient: data.recipient,
          message: data.message,
          status: data.status,
          response: data.response || null,
          error: data.error || null,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }
}
