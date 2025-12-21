import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Extend Express Request type to include our custom properties
declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

// Input validation schema
const GenerateDescriptionSchema = z.object({
  type: z.literal('product_description'),
  productId: z.string().min(1, 'productId is required'),
  input: z.object({
    title: z.string().min(1, 'input.title is required'),
    currentDescription: z.string().nullable().optional(),
    style: z.enum(['professional', 'casual', 'persuasive', 'informative']).optional(),
    extraPrompt: z.string().optional(),
  })
});

type GenerateRequest = z.infer<typeof GenerateDescriptionSchema>;

interface GenerateResponse {
  success: boolean;
  data?: {
    description: string;
    usage?: {
      tokens: number;
    };
  };
  error?: string;
}

import { AIServiceFactory } from '../../services/ai.service';

// Initialize AI service with fallback
const aiService = AIServiceFactory.createService('openai');

// Helper function to generate product description
async function generateProductDescription(params: {
  title: string;
  currentDescription?: string | null;
  style?: string;
  extraPrompt?: string;
}): Promise<{ description: string; usage: { tokens: number } }> {
  const { title, currentDescription, style = 'professional', extraPrompt } = params;
  
  // Build the prompt with clear instructions
  const prompt = `You are an expert product description writer for an e-commerce store. 
Generate a ${style} product description for: "${title}"

${currentDescription ? `Current description (you can improve this):
${currentDescription}

` : ''}${extraPrompt ? `Additional instructions: ${extraPrompt}

` : ''}The description should be:
- Engaging and persuasive
- Highlight key features and benefits
- Include relevant keywords naturally
- Use ${style} tone
- Be between 100-200 words
- Include bullet points for key features
- End with a compelling call-to-action

Write the description in well-formatted HTML with proper paragraph and list tags.`;

  // Generate the description
  const description = await aiService.generateText({
    prompt,
    maxTokens: 1000,
    temperature: style === 'creative' ? 0.8 : 0.7,
    stopSequences: ['---', '###', '---END---']
  });

  // Estimate token usage (roughly 1 token = 4 characters)
  const tokensUsed = Math.ceil(description.length / 4);

  return {
    description: formatDescription(description),
    usage: { tokens: tokensUsed }
  };
}

// Helper to clean and format the AI output
function formatDescription(description: string): string {
  // Remove any markdown code blocks if present
  let formatted = description
    .replace(/```html/g, '')
    .replace(/```/g, '')
    .trim();

  // Ensure proper HTML structure
  if (!formatted.startsWith('<p>')) {
    formatted = formatted
      .split('\n\n')
      .map(para => para.trim() ? `<p>${para.trim()}</p>` : '')
      .join('\n');
  }

  // Convert markdown lists to HTML
  formatted = formatted
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>') // Unordered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>') // Ordered lists
    .replace(/<li>.*<\/li>/gs, match => {
      // Wrap consecutive list items in <ul> or <ol>
      const isOrdered = /^\s*\d+\./.test(match);
      const listTag = isOrdered ? 'ol' : 'ul';
      return match
        .replace(/<li>/g, `<${listTag}><li>`)
        .replace(/<\/li>/g, `</li></${listTag}>`)
        .replace(new RegExp(`</${listTag}><${listTag}>`, 'g'), '');
    });

  return formatted;
}

export const shopifyAIController = {
  /**
   * Generate product description
   * POST /api/v1/shopify/generate
   */
  generateDescription: async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    const shop = req.headers['x-shopify-shop-domain'] as string;
    const apiKey = req.headers['x-api-key'] as string;

    // Log request
    logger.info('Generate description request', {
      requestId,
      shop,
      endpoint: '/api/v1/shopify/generate',
      body: req.body
    });

    try {
      // 1. Validate API key
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        logger.warn('Invalid API key', { requestId, shop });
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid API key'
        });
      }

      // 2. Validate request body
      const { type, productId, input } = req.body as GenerateRequest;
      
      if (type !== 'product_description') {
        return res.status(400).json({
          success: false,
          error: 'Invalid type. Only "product_description" is supported.'
        });
      }

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: 'productId is required'
        });
      }

      if (!input?.title) {
        return res.status(400).json({
          success: false,
          error: 'input.title is required'
        });
      }

      // 3. Generate description using AI service with retry logic
      let retries = 3;
      let lastError: Error | null = null;
      let aiResponse;

      while (retries > 0) {
        try {
          aiResponse = await generateProductDescription({
            title: input.title,
            currentDescription: input.currentDescription,
            style: input.style,
            extraPrompt: input.extraPrompt
          });
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error as Error;
          retries--;
          if (retries > 0) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
          }
        }
      }

      if (!aiResponse) {
        throw lastError || new Error('Failed to generate description after multiple attempts');
      }

      // 4. Log successful generation
      logger.info('Description generated successfully', {
        requestId,
        shop,
        productId,
        tokensUsed: aiResponse.usage.tokens
      });

      // 5. Return success response
      const response: GenerateResponse = {
        success: true,
        data: {
          description: aiResponse.description,
          usage: {
            tokens: aiResponse.usage.tokens
          }
        }
      };

      res.status(200).json(response);
    } catch (error) {
      // Log the error
      logger.error('Error generating description', {
        requestId,
        shop,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Return error response
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate description';
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  },

  /**
   * Health check endpoint
   * GET /api/v1/shopify/health
   */
  healthCheck: (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  }
};

// Helper function to get plan limits
function getPlanLimits(plan: string) {
  const plans: Record<string, { monthlyLimit: number }> = {
    free: { monthlyLimit: 100 },
    basic: { monthlyLimit: 1000 },
    pro: { monthlyLimit: 10000 },
    enterprise: { monthlyLimit: 100000 }
  };
  return plans[plan] || plans.free;
}

// Helper function to get reset date (first day of next month)
function getResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth.toISOString();
}

// Helper function to check usage (stub implementation)
async function checkUsage(shop: string, plan: string) {
  // In a real implementation, this would query the database
  // For now, we'll return a stub response
  const limits = getPlanLimits(plan);
  const usage = 0; // This would come from database in a real implementation
  
  return {
    current: usage,
    limit: limits.monthlyLimit,
    exceeded: usage >= limits.monthlyLimit,
    resetDate: getResetDate()
  };
}

// Helper function to build AI prompt
function buildPrompt(type: string, input: any): string {
  const { title, currentDescription, extraPrompt, style } = input;
  
  switch (type) {
    case 'product_description':
      return `Write a compelling product description for "${title}". 
              Style: ${style || 'professional'}
              ${extraPrompt ? `Additional instructions: ${extraPrompt}` : ''}
              ${currentDescription ? `\nCurrent description: ${currentDescription}` : ''}
              `;
    
    case 'seo':
      return `Generate SEO-optimized meta description for product: "${title}".
              Focus on: ${style || 'SEO best practices'}
              ${extraPrompt ? `Additional instructions: ${extraPrompt}` : ''}
              `;
              
    case 'email':
      return `Write a marketing email about the product: "${title}".
              Tone: ${style || 'engaging'}
              ${extraPrompt ? `Additional instructions: ${extraPrompt}` : ''}
              `;
              
    default:
      throw new Error(`Unsupported content type: ${type}`);
  }
}

// Helper function to get temperature for AI generation
function getTemperature(qualityMode: string): number {
  switch (qualityMode) {
    case 'cost-saving': return 0.3;
    case 'balanced': return 0.7;
    case 'quality-first': return 0.9;
    default: return 0.7;
  }
}
