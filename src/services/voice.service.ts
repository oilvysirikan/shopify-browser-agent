import { env } from '../config/env.validation.js';
import { logger } from '../utils/logger.js';
import FormData from 'form-data';
import fs from 'fs';

interface TranscriptionResult {
  text: string;
}

interface TTSOptions {
  text: string;
  model?: string;
  voice?: string;
  responseFormat?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class VoiceService {
  private readonly baseUrl = 'https://api.mistral.ai/v1';
  private readonly apiKey: string;
  private readonly sttModel = 'voix-v1';
  private readonly chatModel = 'mistral-medium';
  private readonly ttsModel = 'mistral-tts';
  
  // Thai system prompt for natural conversation
  private readonly thaiSystemPrompt = `คุณเป็น AI assistant ที่ตอบเป็นภาษาไทยเสมอ 
ตอบสั้น กระชับ เป็นธรรมชาติ เหมือนคุยกับคน`;

  constructor() {
    this.apiKey = env.MISTRAL_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('MISTRAL_API_KEY not set. Voice features will not work.');
    }
  }

  /**
   * Transcribe audio to text using Mistral STT API
   * @param audioBuffer - Audio file buffer
   * @param language - Language code (default: 'th' for Thai)
   */
  async transcribe(audioBuffer: Buffer, language: string = 'th'): Promise<TranscriptionResult> {
    try {
      if (!this.apiKey) {
        throw new Error('MISTRAL_API_KEY not configured');
      }

      const formData = new FormData();
      formData.append('file', audioBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
      formData.append('model', this.sttModel);
      formData.append('language', language);

      logger.info('Calling Mistral STT API', { model: this.sttModel, language });

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders(),
        },
        body: formData as unknown as BodyInit,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral STT API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as { text: string };
      
      logger.info('STT transcription successful', { 
        textLength: data.text?.length || 0,
        language 
      });

      return { text: data.text || '' };
    } catch (error) {
      logger.error('Error in STT transcription:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech using Mistral TTS API
   * @param options - TTS options including text to synthesize
   */
  async textToSpeech(options: TTSOptions): Promise<Buffer> {
    try {
      if (!this.apiKey) {
        throw new Error('MISTRAL_API_KEY not configured');
      }

      const { text, model = this.ttsModel, voice = 'alloy', responseFormat = 'mp3' } = options;

      logger.info('Calling Mistral TTS API', { model, voice, textLength: text.length });

      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: responseFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral TTS API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      logger.info('TTS synthesis successful', { 
        audioSize: audioBuffer.length,
        format: responseFormat 
      });

      return audioBuffer;
    } catch (error) {
      logger.error('Error in TTS synthesis:', error);
      throw error;
    }
  }

  /**
   * Get chat completion from Mistral with Thai system prompt
   * @param userMessage - User's message in Thai
   */
  async chatCompletion(userMessage: string): Promise<ChatCompletionResult> {
    try {
      if (!this.apiKey) {
        throw new Error('MISTRAL_API_KEY not configured');
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: this.thaiSystemPrompt },
        { role: 'user', content: userMessage },
      ];

      logger.info('Calling Mistral Chat API', { model: this.chatModel, messageLength: userMessage.length });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral Chat API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const text = data.choices[0]?.message?.content || '';
      
      logger.info('Chat completion successful', { 
        responseLength: text.length,
        usage: data.usage 
      });

      return {
        text,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      logger.error('Error in chat completion:', error);
      throw error;
    }
  }

  /**
   * Full voice conversation pipeline: audio -> STT -> chat -> TTS
   * @param audioBuffer - Input audio buffer
   * @returns Audio response buffer
   */
  async voiceConversation(audioBuffer: Buffer): Promise<{
    inputText: string;
    responseText: string;
    audioResponse: Buffer;
  }> {
    try {
      // Step 1: Transcribe audio to text (Thai)
      const transcription = await this.transcribe(audioBuffer, 'th');
      logger.info('Voice conversation: STT completed', { inputText: transcription.text });

      // Step 2: Get chat response in Thai
      const chatResponse = await this.chatCompletion(transcription.text);
      logger.info('Voice conversation: Chat completed', { responseText: chatResponse.text });

      // Step 3: Convert response to speech
      const audioResponse = await this.textToSpeech({
        text: chatResponse.text,
        responseFormat: 'mp3',
      });
      logger.info('Voice conversation: TTS completed', { audioSize: audioResponse.length });

      return {
        inputText: transcription.text,
        responseText: chatResponse.text,
        audioResponse,
      };
    } catch (error) {
      logger.error('Error in voice conversation pipeline:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const voiceService = new VoiceService();
