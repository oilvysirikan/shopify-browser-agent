import { Router } from 'express';
import { lineService } from '../../services/chat/line.service.js';
import { whatsAppService } from '../../services/chat/whatsapp.service.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * LINE Webhook
 * POST /api/chat/line/webhook
 */
router.post('/line/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-line-signature'] as string;
    const body = JSON.stringify(req.body);

    const events = await lineService.handleWebhook(body, signature);

    // Process events asynchronously
    for (const event of events) {
      await handleLineEvent(event);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('LINE webhook error:', error);
    res.status(401).json({ ok: false, error: 'Invalid signature' });
  }
});

/**
 * LINE Health Check
 * GET /api/chat/line/health
 */
router.get('/line/health', (req, res) => {
  res.json({ ok: true, service: 'line-chatbot' });
});

/**
 * WhatsApp Webhook (Verification)
 * GET /api/chat/whatsapp/webhook
 */
router.get('/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const result = whatsAppService.verifyWebhook(mode, token, challenge);
  
  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).json({ ok: false });
  }
});

/**
 * WhatsApp Webhook (Messages)
 * POST /api/chat/whatsapp/webhook
 */
router.post('/whatsapp/webhook', async (req, res) => {
  try {
    const messages = whatsAppService.parseWebhook(req.body);

    // Process messages asynchronously
    for (const message of messages) {
      await handleWhatsAppMessage(message);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('WhatsApp webhook error:', error);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

/**
 * WhatsApp Health Check
 * GET /api/chat/whatsapp/health
 */
router.get('/whatsapp/health', (req, res) => {
  res.json({ ok: true, service: 'whatsapp-chatbot' });
});

/**
 * Unified Chat Status
 * GET /api/chat/status
 */
router.get('/status', (req, res) => {
  res.json({
    platforms: {
      line: { active: true, connected: !!process.env.LINE_CHANNEL_ACCESS_TOKEN },
      whatsapp: { active: true, connected: !!process.env.WHATSAPP_TOKEN }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Handle LINE events
 */
async function handleLineEvent(event: any): Promise<void> {
  const replyToken = event.replyToken;
  
  // Handle postback (button clicks)
  if (event.type === 'postback') {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');
    
    if (action === 'add_to_cart' && replyToken) {
      const productId = data.get('product_id');
      await lineService.reply(replyToken, [{
        type: 'text',
        text: `✅ เพิ่มสินค้า ${productId} ลงตะกร้าแล้ว`
      }]);
    }
    return;
  }

  // Handle follow (new friend)
  if (event.type === 'follow') {
    const userId = event.source?.userId;
    if (userId) {
      await lineService.push(userId, [{
        type: 'text',
        text: '👋 สวัสดีครับ! ยินดีต้อนรับสู่ร้านค้าของเรา\n\n🛍️ พิมพ์ชื่อสินค้าเพื่อค้นหา\n🛒 พิมพ์ "ตะกร้า" เพื่อดูตะกร้า\n❓ พิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมด'
      }]);
    }
    return;
  }

  // Handle text messages
  if (event.type === 'message' && event.message?.type === 'text' && replyToken) {
    const text = event.message.text;

    // Product search
    if (lineService.looksLikeProductSearch(text)) {
      // Mock products - integrate with real catalog
      const products = [
        { id: '1', name: 'ไมค์ Razer Seiren Mini', price: 1990, image: 'https://via.placeholder.com/300' },
        { id: '2', name: 'ไมค์ Blue Yeti', price: 4990, image: 'https://via.placeholder.com/300' },
        { id: '3', name: 'ไมค์ HyperX QuadCast', price: 3490, image: 'https://via.placeholder.com/300' }
      ];

      const carousel = lineService.buildProductCarousel(products, 'สินค้าไมค์แนะนำ');
      await lineService.reply(replyToken, [carousel]);
      return;
    }

    // Cart command
    if (text.toLowerCase().includes('ตะกร้า') || text.toLowerCase().includes('cart')) {
      await lineService.reply(replyToken, [{
        type: 'text',
        text: '🛒 ตะกร้าของคุณว่างเปล่า\n\nพิมพ์ชื่อสินค้าเพื่อเริ่มช้อปปิ้ง!'
      }]);
      return;
    }

    // Help command
    if (text.toLowerCase().includes('ช่วยเหลือ') || text.toLowerCase().includes('help')) {
      await lineService.reply(replyToken, [{
        type: 'text',
        text: '📋 คำสั่งที่ใช้ได้:\n\n🔍 ค้นหาสินค้า - พิมพ์ชื่อสินค้า\n🛒 ดูตะกร้า - พิมพ์ "ตะกร้า"\n💬 ติดต่อพนักงาน - พิมพ์ "ติดต่อ"\n\nหรือกดปุ่มที่แสดงในข้อความได้เลยครับ'
      }]);
      return;
    }

    // Default response
    await lineService.reply(replyToken, [{
      type: 'text',
      text: 'บอกได้เลยครับว่าอยากได้สินค้า/จองบริการแบบไหน 🙂'
    }]);
  }
}

/**
 * Handle WhatsApp messages
 */
async function handleWhatsAppMessage(message: { from: string; text: string; name?: string }): Promise<void> {
  const { from, text, name } = message;

  // Product search
  if (text.toLowerCase().includes('สินค้า') || text.toLowerCase().includes('product')) {
    const products = [
      { name: 'ไมค์ Razer Seiren Mini', price: 1990, sku: 'RAZER-001' },
      { name: 'ไมค์ Blue Yeti', price: 4990, sku: 'BLUE-001' },
      { name: 'ไมค์ HyperX QuadCast', price: 3490, sku: 'HYPERX-001' }
    ];

    const productList = whatsAppService.formatProductList(products);
    await whatsAppService.sendText(from, productList);
    return;
  }

  // Add to cart
  const sku = whatsAppService.parseAddCommand(text);
  if (sku) {
    // Mock cart - integrate with Redis/database
    const cart: any = { items: [] };
    const product = { sku, name: `Product ${sku}`, price: 1990 };
    
    whatsAppService.addToCart(cart, { ...product, qty: 1 });
    
    await whatsAppService.sendText(
      from,
      `✅ เพิ่มสินค้าลงตะกร้าแล้ว!\n\n${whatsAppService.formatCartMessage(cart)}`
    );
    return;
  }

  // Cart command
  if (text.toLowerCase().includes('ตะกร้า') || text.toLowerCase().includes('cart')) {
    const cart: any = { items: [] }; // Get from Redis/database
    await whatsAppService.sendText(from, whatsAppService.formatCartMessage(cart));
    return;
  }

  // Default response
  await whatsAppService.sendText(
    from,
    `👋 สวัสดี${name ? ' ' + name : ''}!\n\nพิมพ์ "สินค้า" เพื่อดูรายการ\nหรือพิมพ์ "add <รหัส>" เพื่อใส่ตะกร้า`
  );
}

export default router;
