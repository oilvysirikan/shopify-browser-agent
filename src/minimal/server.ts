import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import shopifyRouter from './routes/shopify';
import voiceRouter from './routes/voice';
import FormData from 'form-data';
import axios from 'axios';

dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Shopify AI Assistant is running',
    healthCheck: 'Visit /health for service status',
    endpoints: {
      health: '/health',
      shopify: '/api/v1/shopify/*'
    }
  });
});

// Mount routes
app.use('/api/v1/shopify', shopifyRouter);
app.use('/api/v1/voice', voiceRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Not Found',
    path: req.path,
    method: req.method,
    availableEndpoints: ['/health', '/api/v1/shopify/*', '/api/v1/voice/*', '/ws/voice']
  });
});

// WebSocket Voice Server
const wss = new WebSocketServer({ server, path: '/ws/voice' });

// Thai system prompt
const thaiSystemPrompt = `คุณเป็น AI assistant ที่ตอบเป็นภาษาไทยเสมอ 
ตอบสั้น กระชับ เป็นธรรมชาติ เหมือนคุยกับคน`;

interface VoiceSession {
  id: string;
  ws: WebSocket;
  isProcessing: boolean;
}

const sessions = new Map<string, VoiceSession>();

function generateSessionId(): string {
  return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function voiceConversation(audioBuffer: Buffer): Promise<{ inputText: string; responseText: string; audioResponse: Buffer }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

  // Step 1: STT
  const formData = new FormData();
  formData.append('file', audioBuffer, { filename: 'audio.webm' });
  formData.append('model', 'voix-v1');
  formData.append('language', 'th');

  const sttResponse = await axios.post('https://api.mistral.ai/v1/audio/transcriptions', formData, {
    headers: { 'Authorization': `Bearer ${apiKey}`, ...formData.getHeaders() },
  });

  const inputText = (sttResponse.data as { text: string }).text || '';

  // Step 2: Chat
  const chatResponse = await axios.post('https://api.mistral.ai/v1/chat/completions', {
    model: 'mistral-medium',
    messages: [
      { role: 'system', content: thaiSystemPrompt },
      { role: 'user', content: inputText },
    ],
    max_tokens: 500,
    temperature: 0.7,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  const responseText = (chatResponse.data as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content || '';

  // Step 3: TTS
  const ttsResponse = await axios.post('https://api.mistral.ai/v1/audio/speech', {
    model: 'mistral-tts',
    input: responseText,
    voice: 'alloy',
    response_format: 'mp3',
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    responseType: 'arraybuffer',
  });

  const audioResponse = Buffer.from(ttsResponse.data);

  return { inputText, responseText, audioResponse };
}

wss.on('connection', (ws: WebSocket) => {
  const sessionId = generateSessionId();
  const session: VoiceSession = { id: sessionId, ws, isProcessing: false };
  sessions.set(sessionId, session);

  console.log(`🎙️ Voice WebSocket connected: ${sessionId}`);

  ws.send(JSON.stringify({
    type: 'ready',
    data: 'Voice WebSocket connected. Send audio_input with base64-encoded audio.',
    metadata: { sessionId },
  }));

  ws.on('message', async (data: Buffer) => {
    if (session.isProcessing) {
      ws.send(JSON.stringify({ type: 'error', error: 'Previous request still processing' }));
      return;
    }

    try {
      let message: any;
      try {
        message = JSON.parse(data.toString());
      } catch {
        message = { type: 'audio_input', data: data.toString('base64') };
      }

      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (message.type === 'audio_input' && message.data) {
        session.isProcessing = true;
        const audioBuffer = Buffer.from(message.data, 'base64');

        const result = await voiceConversation(audioBuffer);

        ws.send(JSON.stringify({
          type: 'text_output',
          data: result.responseText,
          metadata: { inputText: result.inputText },
        }));

        ws.send(JSON.stringify({
          type: 'audio_output',
          data: result.audioResponse.toString('base64'),
          metadata: { format: 'mp3', size: result.audioResponse.length },
        }));

        session.isProcessing = false;
      }
    } catch (error) {
      console.error(`❌ Voice error for ${sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Processing failed',
      }));
      session.isProcessing = false;
    }
  });

  ws.on('close', () => {
    console.log(`🎙️ Voice WebSocket disconnected: ${sessionId}`);
    sessions.delete(sessionId);
  });

  ws.on('error', (error: Error) => {
    console.error(`🎙️ Voice WebSocket error for ${sessionId}:`, error);
    sessions.delete(sessionId);
  });
});

server.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🛍️  Shopify API: http://localhost:${port}/api/v1/shopify/*`);
  console.log(`🎙️  Voice API: http://localhost:${port}/api/v1/voice/*`);
  console.log(`🎙️  Voice WebSocket: ws://localhost:${port}/ws/voice`);
  console.log(`🔑 ROUTER_SECRET configured: ${!!process.env.ROUTER_SECRET}`);
  console.log(`🤖 MISTRAL_API_KEY configured: ${!!process.env.MISTRAL_API_KEY}`);
});
