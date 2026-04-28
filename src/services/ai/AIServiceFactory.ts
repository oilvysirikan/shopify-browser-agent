import { AIServiceConfig, AIProvider, IAIService } from '../../types/ai';
import { logger } from '../../utils/logger';
import { OpenAI } from 'openai';
import { BaseAIService } from './BaseAIService';

/**
 * Factory for creating AI service instances
 */
export class AIServiceFactory {
  private static instance: AIServiceFactory;
  private services: Map<string, IAIService> = new Map();
  private config: AIServiceConfig;

  private constructor(config: AIServiceConfig) {
    this.config = config;
    this.initializeServices();
  }

  /**
   * Initialize the factory with configuration
   */
  public static initialize(config: AIServiceConfig): void {
    if (!AIServiceFactory.instance) {
      AIServiceFactory.instance = new AIServiceFactory(config);
    }
  }

  /**
   * Get the singleton instance of the factory
   */
  public static getInstance(): AIServiceFactory {
    if (!AIServiceFactory.instance) {
      throw new Error('AIServiceFactory has not been initialized. Call initialize() first.');
    }
    return AIServiceFactory.instance;
  }

  /**
   * Get an AI service instance by provider
   * @param provider The AI provider to get
   */
  public static getService(provider?: AIProvider): IAIService {
    const instance = AIServiceFactory.getInstance();
    const targetProvider = provider || instance.config.defaultProvider;
    
    const service = instance.services.get(targetProvider);
    if (!service) {
      throw new Error(`No AI service found for provider: ${targetProvider}`);
    }
    
    return service;
  }

  /**
   * Initialize all configured AI services
   */
  private initializeServices(): void {
    for (const [provider, config] of Object.entries(this.config.providers)) {
      if (!config?.enabled) continue;

      try {
        switch (provider as AIProvider) {
          case 'openai':
            this.services.set(provider, this.createOpenAIService(config));
            break;
          case 'anthropic':
            this.services.set(provider, this.createAnthropicService(config));
            break;
          case 'cohere':
            this.services.set(provider, this.createCohereService(config));
            break;
          case 'mistral':
            this.services.set(provider, this.createMistralService(config));
            break;
          default:
            logger.warn(`Unsupported AI provider: ${provider}`);
        }
      } catch (error) {
        logger.error(`Failed to initialize AI provider ${provider}:`, error);
      }
    }
  }

  /**
   * Create an OpenAI service instance
   */
  private createOpenAIService(config: any): IAIService {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });

    return {
      getProvider: () => 'openai',
      generateText: async (prompt: string, options: any = {}) => {
        try {
          const response = await openai.chat.completions.create({
            model: options.model || config.defaultModel || 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature,
            max_tokens: options.maxTokens,
            top_p: options.topP,
            stop: options.stop,
          });

          return {
            content: response.choices[0]?.message?.content || '',
            model: response.model,
            usage: {
              promptTokens: response.usage?.prompt_tokens || 0,
              completionTokens: response.usage?.completion_tokens || 0,
              totalTokens: response.usage?.total_tokens || 0,
            },
            metadata: {
              id: response.id,
              finishReason: response.choices[0]?.finish_reason,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`OpenAI API error: ${errorMessage}`);
        }
      },
    };
  }

  /**
   * Create an Anthropic service instance
   */
  private createAnthropicService(config: any): IAIService {
    // Implementation for Anthropic service
    return {
      getProvider: () => 'anthropic',
      generateText: async () => {
        throw new Error('Anthropic service not implemented');
      },
    };
  }

  /**
   * Create a Cohere service instance
   */
  private createCohereService(config: any): IAIService {
    // Implementation for Cohere service
    return {
      getProvider: () => 'cohere',
      generateText: async () => {
        throw new Error('Cohere service not implemented');
      },
    };
  }

  /**
   * Create a Mistral service instance
   */
  private createMistralService(config: any): IAIService {
    // Implementation for Mistral service
    return {
      getProvider: () => 'mistral',
      generateText: async () => {
        throw new Error('Mistral service not implemented');
      },
    };
  }
}
