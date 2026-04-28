import { CohereClient } from 'cohere-ai';
import { BaseAIService } from './BaseAIService';
import { AIGenerationOptions, AIGenerationResult } from '../../types/ai';

export class CohereAIService extends BaseAIService {
  private client: CohereClient;

  constructor(apiKey: string, private defaultModel: string = 'command') {
    super('cohere');
    this.client = new CohereClient({ token: apiKey });
  }

  async generateText(prompt: string, options: AIGenerationOptions = {}): Promise<AIGenerationResult> {
    try {
      const response = await this.client.generate({
        prompt,
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        p: options.topP,
        k: options.topK,
        stop_sequences: Array.isArray(options.stop) ? options.stop : options.stop ? [options.stop] : undefined,
      });

      return {
        content: response.generations[0]?.text || '',
        model: response.meta?.billedUnits?.model || this.defaultModel,
        usage: {
          promptTokens: response.meta?.billedUnits?.inputTokens || 0,
          completionTokens: response.meta?.billedUnits?.outputTokens || 0,
          totalTokens: (response.meta?.billedUnits?.inputTokens || 0) + (response.meta?.billedUnits?.outputTokens || 0),
        },
        metadata: {
          id: response.id,
          finishReason: response.generations[0]?.finishReason,
        },
      };
    } catch (error) {
      return this.handleError(error, { prompt, options });
    }
  }
}
