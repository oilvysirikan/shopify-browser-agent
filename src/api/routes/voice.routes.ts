import { Router, Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { voiceController } from '../controllers/voice.controller.js';

const router = Router();

// Configure multer for audio file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Accept audio files
    const allowedMimes = [
      'audio/webm',
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/ogg',
      'audio/flac',
      'audio/aac',
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only audio files are allowed. Received: ${file.mimetype}`));
    }
  },
});

/**
 * @swagger
 * /api/v1/voice/transcribe:
 *   post:
 *     summary: Transcribe audio to text
 *     description: Convert audio file to Thai text using Mistral STT API
 *     tags: [Voice]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: audio
 *         type: file
 *         required: true
 *         description: Audio file to transcribe (webm, wav, mp3, etc.)
 *       - in: query
 *         name: lang
 *         type: string
 *         default: th
 *         description: Language code (default is 'th' for Thai)
 *     responses:
 *       200:
 *         description: Successfully transcribed audio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                       example: "ข้อความภาษาไทย"
 *                     language:
 *                       type: string
 *                       example: "th"
 *       400:
 *         description: No audio file provided
 *       500:
 *         description: Transcription failed
 */
router.post(
  '/transcribe',
  upload.single('audio'),
  voiceController.transcribe
);

/**
 * @swagger
 * /api/v1/voice/speak:
 *   post:
 *     summary: Convert text to speech
 *     description: Convert Thai text to audio using Mistral TTS API
 *     tags: [Voice]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to convert to speech
 *                 example: "ข้อความภาษาไทย"
 *               model:
 *                 type: string
 *                 description: TTS model to use
 *                 default: "mistral-tts"
 *               voice:
 *                 type: string
 *                 description: Voice to use
 *                 default: "alloy"
 *               responseFormat:
 *                 type: string
 *                 enum: [mp3, opus, aac, flac, wav, pcm]
 *                 default: "mp3"
 *     responses:
 *       200:
 *         description: Successfully generated audio
 *         content:
 *           audio/mpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: TTS generation failed
 */
router.post(
  '/speak',
  voiceController.speak
);

/**
 * @swagger
 * /api/v1/voice/health:
 *   get:
 *     summary: Voice service health check
 *     description: Check if voice service is configured and available
 *     tags: [Voice]
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     service:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     features:
 *                       type: object
 *                       properties:
 *                         stt:
 *                           type: boolean
 *                         tts:
 *                           type: boolean
 *                         websocket:
 *                           type: boolean
 */
router.get(
  '/health',
  voiceController.healthCheck
);

export { router as voiceRouter };
