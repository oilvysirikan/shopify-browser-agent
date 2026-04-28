import { Request, Response } from 'express';
import { PromptPayService } from '../services/payment/promptpay.service';
import { LineNotificationService } from '../services/notification/line.service';
import { prisma } from '../prisma';

export class PaymentController {
  private promptpayService: PromptPayService;

  constructor() {
    this.promptpayService = new PromptPayService();
  }

  /**
   * Generate a new Promptpay QR code
   */
  async generateQRCode(req: Request, res: Response) {
    try {
      const { shop } = req.query;
      const { amount, orderId, description, isDynamic = true } = req.body;

      if (!shop) {
        return res.status(400).json({ error: 'Shop parameter is required' });
      }

      // Get merchant configuration (in a real app, this would come from your database)
      const merchantConfig = await this.getMerchantConfig(shop as string);
      if (!merchantConfig) {
        return res.status(400).json({ error: 'Merchant configuration not found' });
      }

      // Generate QR code
      const qrResult = await this.promptpayService.generateQRCode(shop as string, {
        merchantId: merchantConfig.merchantId,
        merchantName: merchantConfig.merchantName,
        merchantCity: merchantConfig.merchantCity,
        amount: parseFloat(amount),
        orderId,
        description,
        isDynamic: !!isDynamic,
      });

      // Send notification if LINE is configured
      if (merchantConfig.lineNotifyToken) {
        await LineNotificationService.sendPaymentNotification(
          shop as string,
          {
            orderId,
            amount: parseFloat(amount),
            status: 'PENDING',
          },
          {
            channelAccessToken: merchantConfig.lineNotifyToken,
            channelSecret: merchantConfig.lineChannelSecret || '',
            notifyUserId: merchantConfig.lineUserId || '',
          }
        );
      }

      return res.json({
        success: true,
        data: {
          qrCode: qrResult.qrCode,
          transactionId: qrResult.transactionId,
          expiryDate: qrResult.expiryDate,
        },
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate QR code',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;
      const { shop } = req.query;

      if (!shop || !transactionId) {
        return res.status(400).json({ error: 'Shop and transactionId are required' });
      }

      // Get transaction from database
      const transaction = await prisma.promptpayTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Verify payment with bank
      // In a real implementation, you would call the bank's API here
      // For now, we'll just return the current status
      return res.json({
        success: true,
        data: {
          status: transaction.status,
          amount: transaction.amount,
          orderId: transaction.orderId,
          paidAt: transaction.paidAt,
          paidAmount: transaction.paidAmount,
          paidBy: transaction.paidBy,
          referenceNo: transaction.referenceNo,
          bank: transaction.bank,
        },
      });
    } catch (error) {
      console.error('Error verifying payment:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Webhook for bank payment notifications
   */
  async paymentWebhook(req: Request, res: Response) {
    try {
      const { shop } = req.query;
      const { transactionId, status, amount, referenceNo, paidBy, bank, timestamp } = req.body;

      if (!shop || !transactionId || !status) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Update transaction status
      const updatedTransaction = await prisma.promptpayTransaction.update({
        where: { id: transactionId },
        data: {
          status,
          ...(status === 'PAID' && {
            paidAt: new Date(timestamp || new Date()),
            paidAmount: amount,
            paidBy,
            referenceNo,
            bank,
          }),
          updatedAt: new Date(),
        },
      });

      // Get merchant configuration for notifications
      const merchantConfig = await this.getMerchantConfig(shop as string);
      if (merchantConfig?.lineNotifyToken) {
        // Send notification
        await LineNotificationService.sendPaymentNotification(
          shop as string,
          {
            orderId: updatedTransaction.orderId || undefined,
            amount: updatedTransaction.amount || 0,
            status: status as any,
            referenceNo: updatedTransaction.referenceNo || undefined,
            paidBy: updatedTransaction.paidBy || undefined,
          },
          {
            channelAccessToken: merchantConfig.lineNotifyToken,
            channelSecret: merchantConfig.lineChannelSecret || '',
            notifyUserId: merchantConfig.lineUserId || '',
          }
        );
      }

      // If payment is successful and we have an order ID, update the order status
      if (status === 'PAID' && updatedTransaction.orderId) {
        await this.updateOrderStatus(
          shop as string,
          updatedTransaction.orderId,
          'PAID',
          `Paid via PromptPay, Reference: ${referenceNo || 'N/A'}`
        );
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Error processing payment webhook:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process payment webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get merchant configuration (simplified example)
   */
  private async getMerchantConfig(shop: string) {
    // In a real implementation, this would come from your database
    // This is a simplified example
    return {
      merchantId: process.env.PROMPTPAY_MERCHANT_ID || '',
      merchantName: process.env.MERCHANT_NAME || 'My Shop',
      merchantCity: process.env.MERCHANT_CITY || 'Bangkok',
      lineNotifyToken: process.env.LINE_NOTIFY_TOKEN,
      lineChannelSecret: process.env.LINE_CHANNEL_SECRET,
      lineUserId: process.env.LINE_USER_ID,
    };
  }

  /**
   * Update order status in Shopify
   */
  private async updateOrderStatus(shop: string, orderId: string, status: string, note?: string) {
    // In a real implementation, you would use the Shopify API to update the order status
    // This is a simplified example
    console.log(`Updating order ${orderId} status to ${status} for shop ${shop}`);
    if (note) {
      console.log(`Note: ${note}`);
    }
    
    // Example of what the Shopify API call might look like:
    /*
    const shopifyAdmin = new ShopifyAdminService();
    await shopifyAdmin.updateOrder(shop, orderId, {
      status: 'paid',
      note: note,
    });
    */
  }
}
