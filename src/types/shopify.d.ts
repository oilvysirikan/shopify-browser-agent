import { Shopify } from '@shopify/shopify-api';

declare module '@shopify/shopify-api' {
  interface Shopify {
    clients: {
      Graphql: new (params: { session: any }) => {
        query: (query: string, variables?: Record<string, any>) => Promise<any>;
      };
    };
  }
}

export {};
