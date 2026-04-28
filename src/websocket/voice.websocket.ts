import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { voiceService } from '../services/voice.service.js';
import { logger } from '../utils/logger.js';

// Message types for WebSocket communication
enum VoiceMessageType {
  AUDIO_INPUT = 'audio_input',
  AUDIO_OUTPUT = 'audio_output',
  TEXT_INPUT = 'text_input',
  TEXT_OUTPUT = 'text_output',
  ERROR = 'error',
  READY = 'ready',
  PING = 'ping',
  PONG = 'pong',
}

interface VoiceMessage {
  type: VoiceMessageType;
  data?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface VoiceSession {
  id: string;
  ws: WebSocket;
  isProcessing: boolean;
  lastActivity: Date;
}

export class VoiceWebSocketHandler {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, VoiceSession> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server on the existing HTTP server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/voice',
    });

    this.wss.on('connection', this.handleConnection.bind(this));

    // Start heartbeat to keep connections alive and clean up stale sessions
    this.heartbeatInterval = setInterval(() => {
      this.checkConnections();
    }, 30000); // Every 30 seconds

    logger.info('Voice WebSocket server initialized on path: /ws/voice');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const sessionId = this.generateSessionId();
    const session: VoiceSession = {
      id: sessionId,
      ws,
      isProcessing: false,
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);

    logger.info(`Voice WebSocket client connected: ${sessionId}`, {
      totalSessions: this.sessions.size,
    });

    // Send ready message
    this.sendMessage(ws, {
      type: VoiceMessageType.READY,
      data: 'Voice WebSocket connected. Send audio_input with base64-encoded audio.',
      metadata: { sessionId },
    });

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        await this.handleMessage(session, data);
      } catch (error) {
        logger.error(`Error handling message from ${sessionId}:`, error);
        this.sendMessage(ws, {
          type: VoiceMessageType.ERROR,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Handle close
    ws.on('close', () => {
      logger.info(`Voice WebSocket client disconnected: ${sessionId}`);
      this.sessions.delete(sessionId);
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error(`Voice WebSocket error for ${sessionId}:`, error);
      this.sessions.delete(sessionId);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(session: VoiceSession, data: Buffer): Promise<void> {
    session.lastActivity = new Date();

    // Check if already processing
    if (session.isProcessing) {
      this.sendMessage(session.ws, {
        type: VoiceMessageType.ERROR,
        error: 'Previous request still processing. Please wait.',
      });
      return;
    }

    let message: VoiceMessage;
    try {
      message = JSON.parse(data.toString()) as VoiceMessage;
    } catch {
      // If not JSON, treat as binary audio data
      message = { type: VoiceMessageType.AUDIO_INPUT, data: data.toString('base64') };
    }

    switch (message.type) {
      case VoiceMessageType.AUDIO_INPUT:
        await this.handleAudioInput(session, message);
        break;

      case VoiceMessageType.TEXT_INPUT:
        await this.handleTextInput(session, message);
        break;

      case VoiceMessageType.PING:
        this.sendMessage(session.ws, { type: VoiceMessageType.PONG });
        break;

      default:
        this.sendMessage(session.ws, {
          type: VoiceMessageType.ERROR,
          error: `Unknown message type: ${message.type}`,
        });
    }
  }

  /**
   * Handle audio input (STT -> Chat -> TTS)
   */
  private async handleAudioInput(session: VoiceSession, message: VoiceMessage): Promise<void> {
    if (!message.data) {
      this.sendMessage(session.ws, {
        type: VoiceMessageType.ERROR,
        error: 'No audio data provided',
      });
      return;
    }

    session.isProcessing = true;

    try {
      logger.info(`Processing audio input for session: ${session.id}`);

      // Decode base64 audio
      const audioBuffer = Buffer.from(message.data, 'base64');

      // Run full voice conversation pipeline
      const result = await voiceService.voiceConversation(audioBuffer);

      logger.info(`Voice conversation completed for session: ${session.id}`, {
        inputLength: result.inputText.length,
        responseLength: result.responseText.length,
        audioSize: result.audioResponse.length,
      });

      // Send text response first
      this.sendMessage(session.ws, {
        type: VoiceMessageType.TEXT_OUTPUT,
        data: result.responseText,
        metadata: {
          inputText: result.inputText,
        },
      });

      // Send audio response
      this.sendMessage(session.ws, {
        type: VoiceMessageType.AUDIO_OUTPUT,
        data: result.audioResponse.toString('base64'),
        metadata: {
          format: 'mp3',
          size: result.audioResponse.length,
        },
      });
    } catch (error) {
      logger.error(`Error processing audio for session ${session.id}:`, error);
      this.sendMessage(session.ws, {
        type: VoiceMessageType.ERROR,
        error: error instanceof Error ? error.message : 'Audio processing failed',
      });
    } finally {
      session.isProcessing = false;
    }
  }

  /**
   * Handle text input (for testing or chat-only mode)
   */
  private async handleTextInput(session: VoiceSession, message: VoiceMessage): Promise<void> {
    if (!message.data) {
      this.sendMessage(session.ws, {
        type: VoiceMessageType.ERROR,
        error: 'No text data provided',
      });
      return;
    }

    session.isProcessing = true;

    try {
      logger.info(`Processing text input for session: ${session.id}`);

      // Get chat response
      const chatResult = await voiceService.chatCompletion(message.data);

      // Convert to speech
      const audioBuffer = await voiceService.textToSpeech({
        text: chatResult.text,
        responseFormat: 'mp3',
      });

      // Send text response
      this.sendMessage(session.ws, {
        type: VoiceMessageType.TEXT_OUTPUT,
        data: chatResult.text,
      });

      // Send audio response
      this.sendMessage(session.ws, {
        type: VoiceMessageType.AUDIO_OUTPUT,
        data: audioBuffer.toString('base64'),
        metadata: {
          format: 'mp3',
          size: audioBuffer.length,
        },
      });
    } catch (error) {
      logger.error(`Error processing text for session ${session.id}:`, error);
      this.sendMessage(session.ws, {
        type: VoiceMessageType.ERROR,
        error: error instanceof Error ? error.message : 'Text processing failed',
      });
    } finally {
      session.isProcessing = false;
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: VoiceMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Check and clean up stale connections
   */
  private checkConnections(): void {
    const now = new Date();
    const staleTimeout = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > staleTimeout) {
        logger.info(`Closing stale connection: ${sessionId}`);
        session.ws.close();
        this.sessions.delete(sessionId);
      } else {
        // Send ping to check if connection is alive
        this.sendMessage(session.ws, { type: VoiceMessageType.PING });
      }
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    logger.info('Shutting down Voice WebSocket server...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      logger.info(`Closing session: ${sessionId}`);
      session.ws.close();
    }
    this.sessions.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    logger.info('Voice WebSocket server shut down');
  }

  /**
   * Get active session count
   */
  getActiveSessions(): number {
    return this.sessions.size;
  }
}

// Export singleton instance
export const voiceWebSocketHandler = new VoiceWebSocketHandler();
