import { config } from '../config';
import { logger } from '../utils/logger';

interface AIGenerationOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface AIService {
  generateText(options: AIGenerationOptions): Promise<string>;
  getModelName(): string;
  getCostPerToken(): number;
}

export class MistralAIService implements AIService {
  private readonly baseUrl = 'https://api.mistral.ai/v1';
  private readonly model: string;
  
  constructor() {
    this.model = config.ai.mistral.model;
  }

  async generateText({ prompt, maxTokens = 500, temperature = 0.7, stopSequences = [] }: AIGenerationOptions): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.mistral.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          max_tokens: maxTokens,
          temperature,
          stop: stopSequences,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.choices[0]?.text?.trim() || '';
    } catch (error) {
      logger.error('Error generating text with Mistral:', error);
      throw error;
    }
  }

  getModelName(): string {
    return this.model;
  }

  getCostPerToken(): number {
    // Return cost per token in USD
    return 0.00002; // Example value, adjust based on actual pricing
  }
}

export class OpenAIService implements AIService {
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly model: string;
  
  constructor() {
    this.model = config.ai.openai.model;
  }

  async generateText({ prompt, maxTokens = 500, temperature = 0.7, stopSequences = [] }: AIGenerationOptions): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.openai.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates product descriptions.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: maxTokens,
          temperature,
          stop: stopSequences,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      logger.error('Error generating text with OpenAI:', error);
      throw error;
    }
  }

  getModelName(): string {
    return this.model;
  }

  getCostPerToken(): number {
    // Return cost per token in USD
    return 0.00003; // Example value, adjust based on actual pricing
  }
}

export class AIServiceFactory {
  static createService(provider: 'mistral' | 'openai'): AIService {
    switch (provider) {
      case 'mistral':
        return new MistralAIService();
      case 'openai':
        return new OpenAIService();
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}

// Fallback strategy: try primary, if fails, try fallback
export class FallbackAIService implements AIService {
  private primary: AIService;
  private fallback: AIService;
  
  constructor(primary: AIService, fallback: AIService) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async generateText(options: AIGenerationOptions): Promise<string> {
    try {
      return await this.primary.generateText(options);
    } catch (error) {
      logger.warn('Primary AI service failed, falling back to secondary', { error });
      return this.fallback.generateText(options);
    }
  }

  getModelName(): string {
    return `${this.primary.getModelName()} (fallback: ${this.fallback.getModelName()})`;
  }

  getCostPerToken(): number {
    // Return the primary cost, as we only charge for successful generations
    return this.primary.getCostPerToken();
  }
}

// Create a singleton instance with fallback
const mistralService = new MistralAIService();
const openAIService = new OpenAIService();
const aiService = new FallbackAIService(mistralService, openAIService);

export default aiService;
