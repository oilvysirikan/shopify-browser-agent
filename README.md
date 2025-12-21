# Shopify Browser Agent

A Node.js application for interacting with Shopify stores using the Shopify API.

## Features

- Connect to Shopify stores using OAuth
- Perform CRUD operations on Shopify resources
- Webhook handling
- Rate limiting and retry logic
- TypeScript support
- Environment-based configuration

## Prerequisites

- Node.js 18 or later
- npm or yarn
- Shopify Partner account
- Shopify store (development or production)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shopify-browser-agent.git
   cd shopify-browser-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your Shopify API credentials and other settings.

## Configuration

Edit the `.env` file with your configuration:

```env
# Shopify Configuration
SHOPIFY_SHOP=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
SHOPIFY_API_VERSION=2023-10

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

## Development

Start the development server:

```bash
npm run dev
# or
yarn dev
```

The server will be available at `http://localhost:3000`.

## Building for Production

To build the application for production:

```bash
npm run build
# or
yarn build

# Start the production server
npm start
# or
yarn start
```

## Testing

Run the test suite:

```bash
npm test
# or
yarn test
```

## Environment Variables

See `.env.example` for all available environment variables.

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
