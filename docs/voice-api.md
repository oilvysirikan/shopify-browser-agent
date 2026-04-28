# Voice Full Duplex API

Real-time voice conversation using Mistral AI (STT + Chat + TTS) with Thai language support.

## Overview

The Voice API provides three interfaces:
1. **STT Endpoint** - Transcribe audio to Thai text
2. **TTS Endpoint** - Convert Thai text to speech
3. **WebSocket** - Full duplex voice conversation (audio in → STT → Chat → TTS → audio out)

## Configuration

Ensure `MISTRAL_API_KEY` is set in your `.env` file:

```env
MISTRAL_API_KEY=your_mistral_api_key
```

## HTTP Endpoints

### 1. Speech-to-Text (STT)

**Endpoint:** `POST /api/v1/voice/transcribe`

Transcribe audio file to Thai text using Mistral STT API (voix-v1 model).

**Request:**
- Content-Type: `multipart/form-data`
- Body: `audio` - Audio file (webm, wav, mp3, etc.)
- Query: `lang` (optional) - Language code, defaults to "th"

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/voice/transcribe \
  -F "audio=@recording.webm" \
  -F "lang=th"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "ข้อความภาษาไทย",
    "language": "th"
  }
}
```

### 2. Text-to-Speech (TTS)

**Endpoint:** `POST /api/v1/voice/speak`

Convert Thai text to audio using Mistral TTS API.

**Request:**
- Content-Type: `application/json`
- Body:
  - `text` (required) - Text to convert to speech
  - `model` (optional) - TTS model, defaults to "mistral-tts"
  - `voice` (optional) - Voice to use, defaults to "alloy"
  - `responseFormat` (optional) - Format: mp3, opus, aac, flac, wav, pcm. Defaults to "mp3"

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/voice/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "สวัสดีครับ ยินดีต้อนรับ"}' \
  --output response.mp3
```

**Response:**
- Content-Type: `audio/mpeg`
- Body: Audio file buffer (MP3)

### 3. Health Check

**Endpoint:** `GET /api/v1/voice/health`

Check voice service status and configuration.

**Example:**
```bash
curl http://localhost:3000/api/v1/voice/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "voice",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "features": {
      "stt": true,
      "tts": true,
      "websocket": true
    }
  }
}
```

## WebSocket: Full Duplex Voice

**Path:** `/ws/voice`

Real-time full duplex voice conversation. Flow:
```
audio in → STT (Thai) → Mistral Chat → TTS → audio out
```

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/voice');
```

### Message Types

#### Client → Server

**Audio Input:**
```json
{
  "type": "audio_input",
  "data": "base64_encoded_audio_data"
}
```

**Text Input (for testing):**
```json
{
  "type": "text_input",
  "data": "ข้อความที่ต้องการให้ AI ตอบ"
}
```

**Ping (keep alive):**
```json
{
  "type": "ping"
}
```

#### Server → Client

**Ready:**
```json
{
  "type": "ready",
  "data": "Voice WebSocket connected. Send audio_input with base64-encoded audio.",
  "metadata": { "sessionId": "voice_1234567890_abc123" }
}
```

**Text Output (transcribed user input):**
```json
{
  "type": "text_output",
  "data": "AI response in Thai",
  "metadata": { "inputText": "user transcribed input" }
}
```

**Audio Output:**
```json
{
  "type": "audio_output",
  "data": "base64_encoded_mp3_audio",
  "metadata": { "format": "mp3", "size": 12345 }
}
```

**Pong:**
```json
{
  "type": "pong"
}
```

**Error:**
```json
{
  "type": "error",
  "error": "Error message"
}
```

### WebSocket Example (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/voice');

ws.onopen = () => {
  console.log('Connected to voice WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'ready':
      console.log('Ready:', message.data);
      break;
      
    case 'text_output':
      console.log('AI response:', message.data);
      // message.metadata.inputText contains user's transcribed input
      break;
      
    case 'audio_output':
      // Play audio
      const audioData = message.data; // base64 encoded
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      audio.play();
      break;
      
    case 'error':
      console.error('Error:', message.error);
      break;
  }
};

// Send audio (e.g., from MediaRecorder)
function sendAudio(audioBlob) {
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = reader.result.split(',')[1];
    ws.send(JSON.stringify({
      type: 'audio_input',
      data: base64
    }));
  };
  reader.readAsDataURL(audioBlob);
}
```

### System Prompt (Thai)

The AI uses this Thai system prompt for natural conversations:

```
คุณเป็น AI assistant ที่ตอบเป็นภาษาไทยเสมอ 
ตอบสั้น กระชับ เป็นธรรมชาติ เหมือนคุยกับคน
```

Translation: "You are an AI assistant that always responds in Thai. Answer short, concise, naturally, like talking to a person."

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation error or missing data)
- `500` - Internal Server Error (API failure or processing error)

## Models Used

- **STT:** `voix-v1` (Mistral's speech-to-text model)
- **Chat:** `mistral-medium` (Mistral's chat model)
- **TTS:** `mistral-tts` (Mistral's text-to-speech model)

## File Size Limits

- Maximum audio upload: **10MB**
- Supported formats: webm, wav, mp3, mp4, ogg, flac, aac

## Testing

Use the provided test file:

```bash
npm install  # Install ws package
npm run build
npm start
```

Then test the endpoints:

```bash
# Health check
curl http://localhost:3000/api/v1/voice/health

# TTS
curl -X POST http://localhost:3000/api/v1/voice/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "สวัสดีครับ"}' \
  --output test.mp3
```
