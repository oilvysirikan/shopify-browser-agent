import React, { useEffect, useState } from 'react';
import { AppProvider as PolarisProvider, Page, Card, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';
import ProductList from './components/ProductList';

// Type for the Shopify App Bridge configuration
interface AppBridgeConfig {
  apiKey: string;
  host: string;
  forceRedirect?: boolean;
}

export function App() {
  const [appBridgeConfig, setAppBridgeConfig] = useState<AppBridgeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Get the API key from the meta tag or environment variable
      const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY || '';
      const host = new URLSearchParams(window.location.search).get('host') || '';
      
      if (!apiKey) {
        throw new Error('Missing VITE_SHOPIFY_API_KEY in environment variables');
      }
      
      if (!host) {
        throw new Error('This app must be loaded in the Shopify Admin');
      }
      
      setAppBridgeConfig({
        apiKey,
        host,
        forceRedirect: true
      });
    } catch (err) {
      console.error('Error initializing app:', err);
      setError(err.message);
    }
  }, []);

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Text as="h2" variant="headingMd">
          Error Loading App
        </Text>
        <p>{error}</p>
        <p>Please check your configuration and try again.</p>
      </div>
    );
  }

  if (!appBridgeConfig) {
    return (
      <div style={{ padding: '20px' }}>
        <Text as="h2" variant="headingMd">
          Loading O2O AI Assistant...
        </Text>
      </div>
    );
  }

  return (
    <PolarisProvider i18n={enTranslations}>
      <Page title="O2O AI Assistant">
        <Card>
          <Text as="h2" variant="headingMd">
            Welcome to O2O AI Assistant
          </Text>
          <ProductList />
        </Card>
      </Page>
    </PolarisProvider>
  );
}
