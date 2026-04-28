import { MistralClient } from '@mistralai/mistralai';
import { BaseAIService } from './BaseAIService';
import { AIGenerationOptions, AIGenerationResult } from '../../types/ai';

export class MistralAIService extends BaseAIService {
  private client: MistralClient;

  constructor(apiKey: string, private defaultModel: string = 'mistral-medium') {
    super('mistral');
    this.client = new MistralClient(apiKey);
  }

  async generateText(prompt: string, options: AIGenerationOptions = {}): Promise<AIGenerationResult> {
    try {
      const response = await this.client.chat({
        model: options.model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
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
      return this.handleError(error, { prompt, options });
    }
  }
}
