import { Anthropic } from '@anthropic-ai/sdk';
import { BaseAIService } from './BaseAIService';
import { AIGenerationOptions, AIGenerationResult } from '../../types/ai';

export class AnthropicAIService extends BaseAIService {
  private client: Anthropic;

  constructor(apiKey: string, private defaultModel: string = 'claude-3-opus-20240229') {
    super('anthropic');
    this.client = new Anthropic({ apiKey });
  }

  async generateText(prompt: string, options: AIGenerationOptions = {}): Promise<AIGenerationResult> {
    try {
      const response = await this.client.messages.create({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      return {
        content: response.content[0]?.text || '',
        model: response.model,
        usage: {
          promptTokens: response.usage?.input_tokens || 0,
          completionTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        },
        metadata: {
          id: response.id,
          stopReason: response.stop_reason,
        },
      };
    } catch (error) {
      return this.handleError(error, { prompt, options });
    }
  }
}
