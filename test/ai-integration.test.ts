import { expect } from 'chai';
import { AIServiceFactory } from '../src/services/ai.service';
import { config } from '../src/config';

describe('AI Integration', () => {
  describe('OpenAI Service', () => {
    const openAIService = AIServiceFactory.createService('openai');

    it('should generate text', async () => {
      const prompt = 'Write a short product description for a wireless headphone';
      const result = await openAIService.generateText({
        prompt,
        maxTokens: 50,
        temperature: 0.7
      });

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
    });
  });

  describe('Mistral Service', () => {
    const mistralService = AIServiceFactory.createService('mistral');

    it('should generate text', async function() {
      this.timeout(10000); // Increase timeout for API calls
      
      const prompt = 'Write a short product description for a wireless headphone';
      const result = await mistralService.generateText({
        prompt,
        maxTokens: 50,
        temperature: 0.7
      });

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
    });
  });
});
