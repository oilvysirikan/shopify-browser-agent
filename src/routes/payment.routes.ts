import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

export function createPaymentRouter() {
  const router = Router();
  const paymentController = new PaymentController();

  // Generate a new Promptpay QR code
  router.post('/qrcode', paymentController.generateQRCode.bind(paymentController));

  // Verify payment status
  router.get('/verify/:transactionId', paymentController.verifyPayment.bind(paymentController));

  // Webhook for bank payment notifications
  router.post('/webhook', paymentController.paymentWebhook.bind(paymentController));

  return router;
}

export const paymentRouter = createPaymentRouter();
