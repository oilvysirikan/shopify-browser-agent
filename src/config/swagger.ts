import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../utils/logger';
import { version } from '../../package.json';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Shopify Browser Agent API',
      version,
      description: 'API documentation for the Shopify Browser Agent application',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server',
      },
      {
        url: 'https://your-production-url.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        ShopifyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Shopify-Access-Token',
          description: 'Shopify access token for authentication',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for external services',
        },
      },
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Product ID',
              example: 'gid://shopify/Product/123456789',
            },
            title: {
              type: 'string',
              description: 'Product title',
              example: 'Awesome T-Shirt',
            },
            vendor: {
              type: 'string',
              description: 'Product vendor',
              example: 'Fashion Store',
            },
            product_type: {
              type: 'string',
              description: 'Product type',
              example: 'Clothing',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
              description: 'Product status',
              example: 'ACTIVE',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2023-01-01T00:00:00Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2023-01-01T00:00:00Z',
            },
            published_at: {
              type: 'string',
              format: 'date-time',
              description: 'Publication timestamp',
              example: '2023-01-01T00:00:00Z',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
              example: 'Not Found',
            },
            message: {
              type: 'string',
              description: 'Error description',
              example: 'The requested resource was not found',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Unauthorized',
                message: 'No valid session found',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Forbidden',
                message: 'Insufficient permissions',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Not Found',
                message: 'The requested resource was not found',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Validation Error',
                message: 'Invalid input data',
                details: {
                  field: 'The field is required',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        ShopifyAuth: [],
      },
    ],
  },
  // Path to the API docs
  apis: [
    path.join(__dirname, '../api/**/*.ts'),
    path.join(__dirname, '../api/**/*.js'),
    path.join(__dirname, '../models/**/*.ts'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

const setupSwagger = (app: Express): void => {
  // Swagger page
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Shopify Browser Agent API',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #5c6ac4 }
      .swagger-ui .opblock-tag { font-size: 16px; margin: 0 0 5px; }
    `,
    customfavIcon: '/favicon.ico',
    customSiteTitle: 'Shopify Browser Agent API',
  }));

  // Docs in JSON format
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info(`📚 API Documentation available at /api-docs`);
};

export default setupSwagger;
