import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../prisma';
import { ShopifyAdminService } from '../shopify-admin.service';

export interface PromptPayConfig {
  merchantId: string; // Phone number or Tax ID
  merchantName: string;
  merchantCity?: string;
  isDynamic: boolean;
  amount?: number;
  orderId?: string;
  description?: string;
}

export interface QRCodeResult {
  qrCode: string; // Base64 encoded QR code image
  qrData: string; // Raw QR code data
  transactionId: string;
  expiryDate: Date;
}

export class PromptPayService {
  private static readonly QR_EXPIRY_MINUTES = 15;
  private shopifyAdmin: ShopifyAdminService;

  constructor() {
    this.shopifyAdmin = new ShopifyAdminService();
  }

  /**
   * Generate a Promptpay QR code
   */
  async generateQRCode(shop: string, config: PromptPayConfig): Promise<QRCodeResult> {
    const transactionId = `PP${Date.now()}`;
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + PromptPayService.QR_EXPIRY_MINUTES);

    // Format amount to 2 decimal places
    const amount = config.amount ? Number(config.amount).toFixed(2) : '';

    // Generate QR code data based on Promptpay standard
    let qrData = '';
    
    // Static QR (Merchant Presented)
    if (!config.isDynamic) {
      qrData = this.generateStaticQRData({
        ...config,
        amount: amount ? parseFloat(amount) : undefined
      });
    } 
    // Dynamic QR (Customer Presented)
    else {
      qrData = this.generateDynamicQRData({
        ...config,
        amount: amount ? parseFloat(amount) : undefined,
        transactionId
      });
    }

    // Generate QR code as base64
    const qrCode = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 1,
      scale: 8
    });

    // Log the transaction
    await this.logTransaction({
      shop,
      transactionId,
      amount: amount ? parseFloat(amount) : null,
      qrData,
      expiryDate,
      status: 'PENDING',
      orderId: config.orderId,
      merchantId: config.merchantId,
      isDynamic: config.isDynamic
    });

    return {
      qrCode,
      qrData,
      transactionId,
      expiryDate
    };
  }

  /**
   * Generate static QR code data (merchant presented)
   */
  private generateStaticQRData(config: Omit<PromptPayConfig, 'isDynamic'>): string {
    const { merchantId, merchantName, amount, merchantCity = 'TH' } = config;
    
    // Format amount (if provided)
    const amountStr = amount ? `54${amount.toFixed(2).length.toString().padStart(2, '0')}${amount.toFixed(2)}` : '';
    
    // Build QR code data
    return [
      '000201', // Payload Format Indicator
      '010212', // Point of Initiation Method (12 = static)
      '30', // Merchant Account Information - PromptPay
      this.buildTLV([
        ['00', 'A000000677010112'], // AID for PromptPay
        ['01', merchantId.padStart(13, '0').substring(0, 13)] // Merchant ID (phone number or tax ID)
      ]),
      '58', // Country Code
      '02',
      'TH',
      '53', // Transaction Currency
      '03',
      '764', // THB
      amount ? '54' : '', // Transaction Amount (optional)
      amount ? amountStr.substring(2) : '', // Remove length and type
      '29', // Merchant City
      this.buildLengthValue(merchantCity),
      '59', // Merchant Name
      this.buildLengthValue(merchantName),
      '63' // CRC
    ].filter(Boolean).join('') + '6304';
  }

  /**
   * Generate dynamic QR code data (customer presented)
   */
  private generateDynamicQRData(config: Omit<PromptPayConfig, 'isDynamic'> & { transactionId: string }): string {
    const { merchantId, merchantName, amount, merchantCity = 'TH', transactionId, description = '' } = config;
    
    // Format amount (if provided)
    const amountStr = amount ? `54${amount.toFixed(2).length.toString().padStart(2, '0')}${amount.toFixed(2)}` : '';
    
    // Build QR code data
    return [
      '000201', // Payload Format Indicator
      '010211', // Point of Initiation Method (11 = dynamic)
      '30', // Merchant Account Information - PromptPay
      this.buildTLV([
        ['00', 'A000000677010112'], // AID for PromptPay
        ['01', merchantId.padStart(13, '0').substring(0, 13)], // Merchant ID
        ['02', '1'], // Transaction Type (1 = Transfer)
        ['03', '1'], // Transaction Subtype (1 = QR 30)
        ['04', transactionId] // Transaction Reference
      ]),
      '58', // Country Code
      '02',
      'TH',
      '53', // Transaction Currency
      '03',
      '764', // THB
      amount ? '54' : '', // Transaction Amount (optional)
      amount ? amountStr.substring(2) : '', // Remove length and type
      '29', // Merchant City
      this.buildLengthValue(merchantCity),
      '59', // Merchant Name
      this.buildLengthValue(merchantName),
      description ? '50' : '', // Additional Data Field - Bill Payment
      description ? this.buildLengthValue(description) : '',
      '63' // CRC
    ].filter(Boolean).join('') + '6304';
  }

  /**
   * Build TLV (Tag-Length-Value) string
   */
  private buildTLV(elements: [string, string][]): string {
    return elements.map(([tag, value]) => {
      return tag + this.buildLengthValue(value);
    }).join('');
  }

  /**
   * Build length-value pair
   */
  private buildLengthValue(value: string): string {
    return value.length.toString().padStart(2, '0') + value;
  }

  /**
   * Log transaction to database
   */
  private async logTransaction(data: {
    shop: string;
    transactionId: string;
    amount: number | null;
    qrData: string;
    expiryDate: Date;
    status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
    orderId?: string;
    merchantId: string;
    isDynamic: boolean;
  }) {
    return prisma.promptpayTransaction.create({
      data: {
        id: data.transactionId,
        shop: data.shop,
        amount: data.amount,
        qrData: data.qrData,
        expiryDate: data.expiryDate,
        status: data.status,
        orderId: data.orderId,
        merchantId: data.merchantId,
        isDynamic: data.isDynamic,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Verify payment status with bank API
   */
  async verifyPayment(transactionId: string, bank: 'scb' | 'kbank') {
    // Implementation depends on bank API integration
    // This is a placeholder for the actual implementation
    // You would typically make an API call to the bank's API here
    // and update the transaction status accordingly
  }

  /**
   * Process webhook from bank
   */
  async processBankWebhook(data: any, bank: 'scb' | 'kbank') {
    // Implementation depends on bank webhook format
    // This is a placeholder for the actual implementation
  }
}
