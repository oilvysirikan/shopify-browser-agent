import express from 'express';
import path from 'path';

const router = express.Router();

router.get('/', (req, res) => {
  const { shop, host } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>O2O AI Assistant</title>
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body>
        <div id="app"></div>
        <script>
          var AppBridge = window['app-bridge'];
          var createApp = AppBridge.default;
          window.shopifyApp = createApp({
            apiKey: '${process.env.SHOPIFY_API_KEY || ''}',
            host: '${host}',
          });
        </script>
        <script type="module" src="/dist/frontend/index.js"></script>
      </body>
    </html>
  `);
});

export default router;
