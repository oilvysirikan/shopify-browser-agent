import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductDescriptionGenerator } from '../../../../src/services/ai/ProductDescriptionGenerator';
import { AIService } from '../../../../src/types/ai';

describe('ProductDescriptionGenerator', () => {
  let mockAIService: Partial<AIService>;
  let generator: ProductDescriptionGenerator;

  beforeEach(() => {
    mockAIService = {
      generateText: vi.fn().mockResolvedValue({
        content: 'This is a test product description.',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      }),
    };

    generator = new ProductDescriptionGenerator(mockAIService as AIService);
  });

  it('should generate product description with default options', async () => {
    const product = {
      title: 'Test Product',
      vendor: 'Test Vendor',
      productType: 'Apparel',
      tags: ['premium', 'new'],
      variants: [
        { title: 'Small', price: '29.99' },
        { title: 'Large', price: '39.99' },
      ],
    };

    const result = await generator.generate(product);

    expect(mockAIService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Test Product'),
      expect.objectContaining({
        model: 'gpt-4',
        temperature: 0.7,
      })
    );

    expect(result).toEqual({
      description: 'This is a test product description.',
      metadata: {
        generatedAt: expect.any(Date),
        model: 'gpt-4',
        tokensUsed: 30,
      },
    });
  });

  it('should include product details in the prompt', async () => {
    const product = {
      title: 'Test Product',
      vendor: 'Test Vendor',
      productType: 'Electronics',
      tags: ['new', 'featured'],
      variants: [{ title: 'Standard', price: '199.99' }],
    };

    await generator.generate(product, {
      tone: 'professional',
      length: 'detailed',
      targetAudience: 'tech enthusiasts',
    });

    const prompt = (mockAIService.generateText as jest.Mock).mock.calls[0][0];
    
    expect(prompt).toContain('Test Product');
    expect(prompt).toContain('Test Vendor');
    expect(prompt).toContain('Electronics');
    expect(prompt).toContain('professional');
    expect(prompt).toContain('detailed');
    expect(prompt).toContain('tech enthusiasts');
  });

  it('should handle empty product data', async () => {
    const product = {
      title: 'Test Product',
      vendor: '',
      productType: '',
      tags: [],
      variants: [],
    };

    await generator.generate(product);
    
    const prompt = (mockAIService.generateText as jest.Mock).mock.calls[0][0];
    expect(prompt).toContain('Test Product');
  });

  it('should include language in the prompt when specified', async () => {
    const product = {
      title: 'Test Product',
      vendor: 'Test Vendor',
      productType: 'Apparel',
      tags: [],
      variants: [],
    };

    await generator.generate(product, { language: 'es' });
    
    const prompt = (mockAIService.generateText as jest.Mock).mock.calls[0][0];
    expect(prompt.toLowerCase()).toContain('spanish');
  });
});
