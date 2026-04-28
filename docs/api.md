# Shopify Browser Agent API Documentation

## Overview
RESTful API สำหรับจัดการร้านค้า Shopify ด้วย AI-powered features

## Base URL
```
Development: http://localhost:3000/api/v1
Production: https://your-domain.com/api/v1
```

## Authentication
### API Key Authentication
```http
Authorization: Bearer YOUR_API_KEY
```

### Shopify OAuth
```http
X-Shopify-Shop-Domain: your-shop.myshopify.com
X-Shopify-Access-Token: shopify_access_token
```

## API Endpoints

### 🏪 Shopify Store Management

#### Register Store
```http
POST /api/v1/shopify/register
```

**Request Body:**
```json
{
  "shop": "your-store.myshopify.com",
  "sessionToken": "session_token_from_shopify_app_bridge"
}
```

**Response:**
```json
{
  "success": true,
  "shop": "your-store.myshopify.com",
  "scopes": ["read_products", "write_products"],
  "expiresIn": 3600
}
```

#### Get Store Info
```http
GET /api/v1/shopify/shop
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tenant_id",
    "shop": "your-store.myshopify.com",
    "plan": "free",
    "isActive": true,
    "scope": "read_products,write_products",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### 📦 Product Management

#### List Products
```http
GET /api/v1/shopify/products?page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "product_id",
        "title": "Product Title",
        "handle": "product-handle",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100
    }
  }
}
```

#### Get Product by ID
```http
GET /api/v1/shopify/products/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "product_id",
    "title": "Product Title",
    "description": "Product description",
    "variants": [...],
    "images": [...]
  }
}
```

### 🤖 AI Features

#### Generate Product Description
```http
POST /api/v1/shopify-ai/generate
```

**Request Body:**
```json
{
  "type": "product_description",
  "productId": "product_id",
  "input": {
    "title": "Premium Wireless Headphones",
    "currentDescription": "Current description (optional)",
    "style": "professional",
    "extraPrompt": "Focus on sound quality"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "description": "Generated product description...",
    "usage": {
      "tokens": 150,
      "model": "gpt-4-turbo-preview"
    }
  }
}
```

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common Error Codes
- `400` - Bad Request (Invalid input)
- `401` - Unauthorized (Invalid API key/token)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (Rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting
- **100 requests per 15 minutes** per IP
- **1000 requests per hour** per API key

## SDK Examples

### JavaScript/Node.js
```javascript
const ShopifyAgent = require('@your-org/shopify-agent-sdk');

const client = new ShopifyAgent({
  apiKey: 'your_api_key',
  baseUrl: 'http://localhost:3000/api/v1'
});

// Get products
const products = await client.shopify.getProducts();

// Generate description
const description = await client.ai.generateDescription({
  productId: 'product_id',
  title: 'Product Title',
  style: 'professional'
});
```

### Python
```python
from shopify_agent_sdk import ShopifyAgent

client = ShopifyAgent(
    api_key='your_api_key',
    base_url='http://localhost:3000/api/v1'
)

# Get products
products = client.shopify.get_products()

# Generate description
description = client.ai.generate_description(
    product_id='product_id',
    title='Product Title',
    style='professional'
)
```

## Webhooks

### Supported Webhooks
- `app/uninstalled` - App uninstalled
- `orders/create` - New order created
- `products/update` - Product updated

**Webhook Configuration:**
```http
POST /api/v1/webhooks/shopify
Content-Type: application/json
X-Shopify-Hmac-Sha256: hmac_signature

{
  "topic": "orders/create",
  "shop": "your-store.myshopify.com",
  "data": { ... }
}
```

## Support
- 📧 Email: support@your-domain.com
- 💬 Discord: [Join our community](https://discord.gg/your-server)
- 📖 Documentation: [Full API docs](https://docs.your-domain.com)
