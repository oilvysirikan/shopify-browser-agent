import React, { useState } from 'react';
import { Card, TextField, Button, Stack, Text, Banner } from '@shopify/polaris';
import { useApi } from '../services/api';

export const AIChat: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([]);
  
  const { generateAIContent } = useApi();

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message;
    setMessage('');
    setConversation(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await generateAIContent(userMessage, {
        maxTokens: 500,
        temperature: 0.7,
      });

      setConversation(prev => [
        ...prev,
        { role: 'ai', content: response.data.description }
      ]);
    } catch (err) {
      console.error('Error generating AI response:', err);
      setError('Failed to get response from AI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card sectioned>
      <Stack vertical spacing="loose">
        <Text variant="headingMd" as="h2">AI Assistant</Text>
        
        <div style={{ minHeight: '300px', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginBottom: '16px', overflowY: 'auto' }}>
          {conversation.length === 0 ? (
            <Text as="p" color="subdued">How can I help you today?</Text>
          ) : (
            conversation.map((msg, index) => (
              <div 
                key={index} 
                style={{
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                  marginBottom: '8px',
                  padding: '8px',
                  backgroundColor: msg.role === 'user' ? '#f4f6f8' : '#fff',
                  borderRadius: '8px',
                  maxWidth: '80%',
                  marginLeft: msg.role === 'ai' ? '0' : 'auto',
                  marginRight: msg.role === 'ai' ? 'auto' : '0',
                }}
              >
                <Text as="p" variant="bodyMd">
                  {msg.content}
                </Text>
              </div>
            ))
          )}
          {isLoading && (
            <Text as="p" color="subdued">AI is thinking...</Text>
          )}
        </div>

        {error && (
          <Banner status="critical">
            <p>{error}</p>
          </Banner>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <TextField
            label=""
            labelHidden
            value={message}
            onChange={(value) => setMessage(value)}
            placeholder="Type your message here..."
            autoComplete="off"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button primary onClick={handleSendMessage} loading={isLoading} disabled={!message.trim()}>
            Send
          </Button>
        </div>
      </Stack>
    </Card>
  );
};

export default AIChat;
