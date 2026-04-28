import { AIGenerationOptions, AIGenerationResult } from '../../types/ai';
import { logger } from '../../utils/logger';

export abstract class BaseAIService {
  protected readonly provider: string;

  constructor(provider: string) {
    this.provider = provider;
  }

  /**
   * Generate text using the AI service
   * @param prompt The prompt to generate text from
   * @param options Generation options
   */
  abstract generateText(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult>;

  /**
   * Handle errors consistently across all AI services
   * @param error The error that occurred
   * @param context Additional context about the error
   */
  protected handleError(error: unknown, context: Record<string, unknown> = {}): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`AI Service Error (${this.provider}):`, {
      error: errorMessage,
      ...context,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    throw new Error(`AI Service Error (${this.provider}): ${errorMessage}`);
  }
}
