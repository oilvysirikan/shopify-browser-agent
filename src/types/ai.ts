/**
 * AI Generation Options
 */
export interface AIGenerationOptions {
  /**
   * Maximum number of tokens to generate
   * @default 1000
   */
  maxTokens?: number;
  
  /**
   * Temperature for sampling (0-2)
   * @default 0.7
   */
  temperature?: number;
  
  /**
   * Top-p sampling (0-1)
   */
  topP?: number;
  
  /**
   * Stop sequences to end generation
   */
  stop?: string | string[];
  
  /**
   * Model to use for generation
   */
  model?: string;
  
  /**
   * Additional provider-specific options
   */
  [key: string]: any;
}

/**
 * AI Generation Result
 */
export interface AIGenerationResult {
  /**
   * Generated text content
   */
  content: string;
  
  /**
   * Model used for generation
   */
  model: string;
  
  /**
   * Token usage information
   */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * AI Provider Type
 */
export type AIProvider = 'openai' | 'anthropic' | 'cohere' | 'mistral' | 'custom';

/**
 * AI Service Configuration
 */
export interface AIServiceConfig {
  /**
   * Default provider to use
   */
  defaultProvider: AIProvider;
  
  /**
   * Provider-specific configurations
   */
  providers: {
    [key in AIProvider]?: {
      /**
       * Whether this provider is enabled
       */
      enabled: boolean;
      
      /**
       * API key for the provider
       */
      apiKey: string;
      
      /**
       * Base URL for the API (if different from default)
       */
      baseUrl?: string;
      
      /**
       * Default model to use for this provider
       */
      defaultModel?: string;
      
      /**
       * Additional provider-specific options
       */
      [key: string]: any;
    };
  };
  
  /**
   * Global generation options
   */
  defaultOptions?: Partial<AIGenerationOptions>;
}

/**
 * AI Service Interface
 */
export interface IAIService {
  /**
   * Generate text using the AI service
   * @param prompt The prompt to generate text from
   * @param options Generation options
   */
  generateText(prompt: string, options?: AIGenerationOptions): Promise<AIGenerationResult>;
  
  /**
   * Get the name of the provider
   */
  getProvider(): string;
}
