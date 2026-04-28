import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from '@shopify/app-bridge-utils';

export const useApi = () => {
  const app = useAppBridge();

  const generateAIContent = async (prompt: string, options: {
    maxTokens?: number;
    temperature?: number;
  } = {}) => {
    try {
      const response = await authenticatedFetch(app)('/api/v1/shopify/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'chat_completion',
          input: {
            prompt,
            ...options,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate content');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  return {
    generateAIContent,
  };
};
