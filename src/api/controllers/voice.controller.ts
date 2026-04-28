import { Request, Response } from 'express';
import { voiceService } from '../../services/voice.service.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

// Validation schema for TTS request
const SpeakRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  model: z.string().optional(),
  voice: z.string().optional(),
  responseFormat: z.enum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']).optional(),
});

export class VoiceController {
  /**
   * POST /api/v1/voice/transcribe
   * Transcribe audio file to text using Mistral STT
   */
  async transcribe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No audio file provided',
        });
        return;
      }

      logger.info('Received transcription request', {
        fileSize: req.file.size,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });

      // Get language from query params, default to 'th' (Thai)
      const language = (req.query.lang as string) || 'th';

      // Transcribe the audio
      const result = await voiceService.transcribe(req.file.buffer, language);

      res.status(200).json({
        success: true,
        data: {
          text: result.text,
          language,
        },
      });
    } catch (error) {
      logger.error('Transcription error:', error);
      res.status(500).json({
        success: false,
        error: 'Transcription failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/voice/speak
   * Convert text to speech using Mistral TTS
   */
  async speak(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validation = SpeakRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
        return;
      }

      const { text, model, voice, responseFormat } = validation.data;

      logger.info('Received TTS request', {
        textLength: text.length,
        model,
        voice,
        responseFormat: responseFormat || 'mp3',
      });

      // Generate speech
      const audioBuffer = await voiceService.textToSpeech({
        text,
        model,
        voice,
        responseFormat: responseFormat || 'mp3',
      });

      // Set response headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');

      // Send audio buffer
      res.status(200).send(audioBuffer);
    } catch (error) {
      logger.error('TTS error:', error);
      res.status(500).json({
        success: false,
        error: 'Text-to-speech failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/voice/health
   * Health check for voice service
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check if MISTRAL_API_KEY is configured
      const hasApiKey = !!process.env.MISTRAL_API_KEY;
      
      res.status(200).json({
        success: true,
        data: {
          status: hasApiKey ? 'ok' : 'unconfigured',
          service: 'voice',
          timestamp: new Date().toISOString(),
          features: {
            stt: hasApiKey,
            tts: hasApiKey,
            websocket: hasApiKey,
          },
        },
      });
    } catch (error) {
      logger.error('Voice health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
      });
    }
  }
}

// Export singleton instance
export const voiceController = new VoiceController();
