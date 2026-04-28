import { prisma } from '../server';
import { contentGenerationQueue } from '../queue/queue.config';
import aiService from './ai.service';

export class ContentService {
  // Generate product description
  async generateProductDescription(
    productData: {
      title: string;
      currentDescription?: string;
      vendor?: string;
      productType?: string;
      tags?: string[];
    },
    options: {
      tone?: 'professional' | 'casual' | 'luxury';
      language?: 'th' | 'en';
      length?: 'short' | 'medium' | 'long';
    } = {}
  ) {
    const { tone = 'professional', language = 'th', length = 'medium' } = options;
    
    const prompt = this.buildDescriptionPrompt(productData, tone, language, length);
    
    const completion = await aiService.generateText({
      prompt,
      maxTokens: this.getMaxTokens(length),
      temperature: 0.7,
    });

    return {
      content: completion,
      model: aiService.getModelName(),
      tokensUsed: Math.ceil(completion.length / 4), // Rough estimate
    };
  }

  // Generate SEO metadata
  async generateSEOMetadata(
    productData: {
      title: string;
      description: string;
      keywords?: string[];
    },
    language: 'th' | 'en' = 'th'
  ) {
    const prompt = `
Create SEO metadata for the following product:

Product Name: ${productData.title}
Description: ${productData.description}
${productData.keywords ? `Target Keywords: ${productData.keywords.join(', ')}` : ''}

Please create:
1. SEO Title (max 60 characters)
2. Meta Description (max 160 characters)
3. Recommended Focus Keywords (3-5)

Respond in JSON format:
{
  "seoTitle": "...",
  "metaDescription": "...",
  "focusKeywords": ["...", "..."]
}
    `;

    const completion = await aiService.generateText({
      prompt,
      temperature: 0.5,
    });

    try {
      return JSON.parse(completion);
    } catch (error) {
      console.error('Failed to parse SEO metadata:', error);
      return {
        seoTitle: '',
        metaDescription: '',
        focusKeywords: [],
      };
    }
  }

  // Extract product features
  async extractFeatures(description: string, language: 'th' | 'en' = 'th') {
    const prompt = `
Analyze the following product description and extract the key features as bullet points:

${description}

Respond in JSON format:
{
  "features": ["Feature 1", "Feature 2", ...]
}
    `;

    const completion = await aiService.generateText({
      prompt,
      temperature: 0.3,
    });

    try {
      const result = JSON.parse(completion);
      return result.features || [];
    } catch (error) {
      console.error('Failed to parse features:', error);
      return [];
    }
  }

  // Save generated content to database
  async saveGeneratedContent(
    data: {
      productId: string;
      productGid: string;
      contentType: string;
      originalContent?: string;
      generatedContent: string;
      prompt: string;
      model: string;
      tone?: string;
      language: string;
      tokensUsed?: number;
      tenantId?: string;
    }
  ) {
    return prisma.contentGeneration.create({
      data: {
        ...data,
        status: 'pending',
      },
    });
  }

  // Queue batch content generation
  async queueBatchGeneration(
    productIds: string[],
    options: {
      tone?: string;
      language?: string;
      tenantId?: string;
    } = {}
  ) {
    const job = await contentGenerationQueue.add({
      productIds,
      tone: options.tone || 'professional',
      language: options.language || 'th',
      tenantId: options.tenantId,
    });

    return job.id;
  }

  // Helper methods
  private buildDescriptionPrompt(
    productData: any,
    tone: string,
    language: string,
    length: string
  ): string {
    const lengthGuide = {
      short: '100-150 words',
      medium: '200-300 words',
      long: '400-500 words',
    };

    return `
Create a product description for:

Product Name: ${productData.title}
${productData.vendor ? `Brand: ${productData.vendor}` : ''}
${productData.productType ? `Type: ${productData.productType}` : ''}
${productData.tags?.length ? `Tags: ${productData.tags.join(', ')}` : ''}
${productData.currentDescription ? `\nCurrent Description:\n${productData.currentDescription}` : ''}

Please create a description that is:
- Tone: ${tone === 'professional' ? 'Professional' : tone === 'casual' ? 'Casual and friendly' : 'Luxury and premium'}
- Language: ${language === 'th' ? 'Thai' : 'English'}
- Length: ${lengthGuide[length as keyof typeof lengthGuide] || '200-300 words'}
- Focus on benefits and value to the customer
- Use HTML formatting (<h3>, <ul>, <li>, <p>, <strong>)
- SEO-optimized
    `;
  }

  private getMaxTokens(length: string): number {
    const tokenMap = {
      short: 300,
      medium: 600,
      long: 1000,
    };
    return tokenMap[length as keyof typeof tokenMap] || 600;
  }
}

export const contentService = new ContentService();
