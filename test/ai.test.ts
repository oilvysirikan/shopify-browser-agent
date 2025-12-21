import { expect } from 'chai';
import { AIServiceFactory } from '../src/services/ai.service';

describe('AI Service', () => {
  describe('OpenAI Service', () => {
    it('should generate text', async function() {
      this.timeout(10000); // Increase timeout for API calls
      
      const openAIService = AIServiceFactory.createService('openai');
      const result = await openAIService.generateText({
        prompt: 'Write a short product description for wireless headphones',
        maxTokens: 50
      });

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
    });
  });

  describe('Mistral Service', () => {
    it('should generate text', async function() {
      this.timeout(10000);
      
      const mistralService = AIServiceFactory.createService('mistral');
      const result = await mistralService.generateText({
        prompt: 'Write a short product description for wireless headphones',
        maxTokens: 50
      });

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
    });
  });
});
