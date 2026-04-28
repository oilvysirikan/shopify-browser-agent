import { logger } from '../../utils/logger.js';
import OpenAI from 'openai';

export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    type: 'product' | 'order' | 'customer' | 'conversation';
    source: string;
    timestamp: Date;
    [key: string]: any;
  };
  embedding?: number[];
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
}

export class VectorSearchService {
  private openai: OpenAI;
  private documents: Map<string, VectorDocument> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Add document to vector store
   */
  async addDocument(doc: Omit<VectorDocument, 'embedding'>): Promise<VectorDocument> {
    const embedding = await this.generateEmbedding(doc.content);
    
    const fullDoc: VectorDocument = {
      ...doc,
      embedding
    };

    this.documents.set(doc.id, fullDoc);
    logger.info(`Document ${doc.id} added to vector store`);
    
    return fullDoc;
  }

  /**
   * Search similar documents using cosine similarity
   */
  async search(query: string, options: {
    limit?: number;
    type?: string;
    minScore?: number;
  } = {}): Promise<SearchResult[]> {
    const { limit = 5, type, minScore = 0.7 } = options;

    const queryEmbedding = await this.generateEmbedding(query);
    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      // Filter by type if specified
      if (type && doc.metadata.type !== type) continue;

      if (!doc.embedding) continue;

      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      
      if (score >= minScore) {
        results.push({ document: doc, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Semantic product search
   */
  async searchProducts(query: string, products: any[]): Promise<any[]> {
    // First, try exact match
    const exactMatches = products.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
    );

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    // Fall back to semantic search
    const results = await this.search(query, { type: 'product', limit: 5 });
    
    return results.map(r => ({
      ...r.document.metadata.productData,
      searchScore: r.score
    }));
  }

  /**
   * Smart FAQ answering using RAG
   */
  async answerFAQ(question: string, context: VectorDocument[]): Promise<{
    answer: string;
    sources: string[];
    confidence: number;
  }> {
    // Find relevant documents
    const relevantDocs = await this.search(question, { limit: 3 });
    
    const contextText = relevantDocs
      .map(r => r.document.content)
      .join('\n\n');

    const prompt = `
You are a helpful customer service AI for an e-commerce store.

CONTEXT:
${contextText}

QUESTION: ${question}

Answer based on the context provided. If you don't have enough information, say so.
Be concise and helpful. Answer in Thai if the question is in Thai.

Respond in JSON format:
{
  "answer": "your answer",
  "confidence": 0.8
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        answer: result.answer || 'ขออภัย ฉันไม่มีข้อมูลเกี่ยวกับคำถามนี้',
        sources: relevantDocs.map(r => r.document.metadata.source),
        confidence: result.confidence || 0.5
      };
    } catch (error) {
      logger.error('FAQ answering failed:', error);
      return {
        answer: 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่',
        sources: [],
        confidence: 0
      };
    }
  }

  /**
   * Index all products for semantic search
   */
  async indexProducts(products: any[]): Promise<void> {
    for (const product of products) {
      const content = `${product.name}. ${product.description || ''}. 
        ราคา: ${product.price} บาท. 
        หมวดหมู่: ${product.category || 'ไม่ระบุ'}.`;

      await this.addDocument({
        id: `product_${product.id}`,
        content,
        metadata: {
          type: 'product',
          source: 'shopify',
          timestamp: new Date(),
          productData: product
        }
      });
    }

    logger.info(`Indexed ${products.length} products`);
  }

  /**
   * Store conversation for future context
   */
  async storeConversation(userId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
    const content = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    await this.addDocument({
      id: `conv_${userId}_${Date.now()}`,
      content,
      metadata: {
        type: 'conversation',
        source: userId,
        timestamp: new Date(),
        messageCount: messages.length
      }
    });
  }

  /**
   * Get conversation history context
   */
  async getConversationContext(userId: string, query: string): Promise<string[]> {
    const results = await this.search(query, {
      type: 'conversation',
      limit: 5
    });

    return results
      .filter(r => r.document.metadata.source === userId)
      .map(r => r.document.content);
  }

  /**
   * Delete old documents
   */
  async cleanup(olderThanDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    let deleted = 0;
    for (const [id, doc] of this.documents) {
      if (doc.metadata.timestamp < cutoff) {
        this.documents.delete(id);
        deleted++;
      }
    }

    logger.info(`Cleaned up ${deleted} old documents`);
    return deleted;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalDocuments: number;
    byType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    
    for (const doc of this.documents.values()) {
      const type = doc.metadata.type;
      byType[type] = (byType[type] || 0) + 1;
    }

    return {
      totalDocuments: this.documents.size,
      byType
    };
  }
}

export const vectorSearchService = new VectorSearchService();
