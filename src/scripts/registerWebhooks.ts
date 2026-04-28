import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { webhookConfig } from '../config/webhooks';
import { errorMonitor } from '../utils/errorMonitor';

interface Session {
  shop: string;
  accessToken: string;
}

export async function registerWebhooks(session: Session) {
  const client = new shopifyApi.clients.Graphql({
    session,
    apiVersion: LATEST_API_VERSION,
  });
  
  for (const webhook of webhookConfig) {
    const webhookUrl = `${process.env.SHOPIFY_APP_URL}${webhook.path}`;
    
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            topic
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    try {
      const response = await client.request({
        data: {
          query: mutation,
          variables: {
            topic: webhook.topic.toUpperCase().replace('/', '_'),
            webhookSubscription: {
              callbackUrl: webhookUrl,
              format: 'JSON',
              includeFields: ['id', 'title'],
            },
          },
        },
      });
      
      const result = response.body as any;
      
      if (result?.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
        const errors = result.data.webhookSubscriptionCreate.userErrors;
        errorMonitor.error('Webhook registration error', {
          topic: webhook.topic,
          webhookUrl,
          errors,
        });
        
        // Skip if webhook already exists
        const isDuplicateError = errors.some((e: any) => 
          e.message.includes('already exists')
        );
        
        if (!isDuplicateError) {
          throw new Error(`Failed to register webhook: ${JSON.stringify(errors)}`);
        }
      }
      
      errorMonitor.info(`Webhook registered successfully`, {
        topic: webhook.topic,
        webhookUrl,
      });
      
    } catch (error) {
      errorMonitor.error(`Failed to register webhook ${webhook.topic}`, {
        error: error instanceof Error ? error.message : String(error),
        webhookUrl,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
    }
  }
}

export async function deleteAllWebhooks(session: Session) {
  const client = new shopifyApi.clients.Graphql({
    session,
    apiVersion: LATEST_API_VERSION,
  });
  
  const query = `
    query {
      webhookSubscriptions(first: 100) {
        edges {
          node {
            id
            topic
            endpoint {
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }
  `;
  
  const deleteMutation = `
    mutation webhookSubscriptionDelete($id: ID!) {
      webhookSubscriptionDelete(id: $id) {
        deletedWebhookSubscriptionId
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const response = await client.request({ query });
    const subscriptions = response.body?.data?.webhookSubscriptions?.edges || [];
    let deletedCount = 0;
    
    for (const { node } of subscriptions) {
      try {
        await client.request({
          query: deleteMutation,
          variables: { id: node.id },
        });
        
        errorMonitor.info(`Deleted webhook: ${node.topic}`, {
          webhookId: node.id,
          callbackUrl: node.endpoint?.callbackUrl,
        });
        
        deletedCount++;
      } catch (error) {
        errorMonitor.error(`Failed to delete webhook ${node.id}`, {
          error: error instanceof Error ? error.message : String(error),
          topic: node.topic,
        });
      }
    }
    
    errorMonitor.info(`Deleted ${deletedCount} webhooks`, {
      shop: session.shop,
      totalFound: subscriptions.length,
    });
    
    return deletedCount;
  } catch (error) {
    errorMonitor.error('Failed to fetch or delete webhooks', {
      error: error instanceof Error ? error.message : String(error),
      shop: session.shop,
    });
    throw error;
  }
}
