import { Router } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';

const router = Router();

// Configure multer for audio file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Thai system prompt for natural conversation
const thaiSystemPrompt = `คุณเป็น AI assistant ที่ตอบเป็นภาษาไทยเสมอ 
ตอบสั้น กระชับ เป็นธรรมชาติ เหมือนคุยกับคน`;

// Health check
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.MISTRAL_API_KEY;
  res.json({
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
});

// STT Endpoint - Transcribe audio to text
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'MISTRAL_API_KEY not configured',
      });
    }

    const language = (req.query.lang as string) || 'th';

    const formData = new FormData();
    formData.append('file', req.file.buffer, { filename: 'audio.webm', contentType: req.file.mimetype });
    formData.append('model', 'voix-v1');
    formData.append('language', language);

    const response = await axios.post('https://api.mistral.ai/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
    });

    const data = response.data as { text: string };

    res.json({
      success: true,
      data: {
        text: data.text || '',
        language,
      },
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      success: false,
      error: 'Transcription failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// TTS Endpoint - Convert text to speech
router.post('/speak', async (req, res) => {
  try {
    const { text, model = 'mistral-tts', voice = 'alloy', responseFormat = 'mp3' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'MISTRAL_API_KEY not configured',
      });
    }

    const response = await axios.post('https://api.mistral.ai/v1/audio/speech', {
      model,
      input: text,
      voice,
      response_format: responseFormat,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      responseType: 'arraybuffer',
    });

    const audioBuffer = Buffer.from(response.data);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');
    res.status(200).send(audioBuffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({
      success: false,
      error: 'Text-to-speech failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Chat endpoint with Thai prompt
router.post('/chat', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'MISTRAL_API_KEY not configured',
      });
    }

    const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
      model: 'mistral-medium',
      messages: [
        { role: 'system', content: thaiSystemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = response.data as {
      choices: Array<{ message: { content: string } }>;
    };

    const responseText = data.choices[0]?.message?.content || '';

    res.json({
      success: true,
      data: {
        text: responseText,
        input: text,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Chat completion failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
