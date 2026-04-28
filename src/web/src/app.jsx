import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AppProvider,
  Page,
  Card,
  Button,
  Layout,
  TextContainer,
  Heading,
  Stack,
  Banner,
  Spinner
} from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { getSessionToken } from '@shopify/app-bridge-utils';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shop, setShop] = useState('');

  useEffect(() => {
    // Get the shop domain from the URL
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get('shop');
    
    if (shopParam) {
      setShop(shopParam);
      setLoading(false);
    } else {
      setError('No shop parameter found in URL');
      setLoading(false);
    }
  }, []);

  const handleAction = async () => {
    try {
      const token = await getSessionToken(window.app);
      // Add your API call here using the token
      console.log('Session token:', token);
    } catch (err) {
      console.error('Error getting session token:', err);
      setError('Failed to authenticate with Shopify');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner accessibilityLabel="Loading app" size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Banner title="Error" status="critical">
        <p>{error}</p>
      </Banner>
    );
  }

  return (
    <AppProvider i18n={{}}>
      <Page title="Shopify Browser Agent">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <TextContainer>
                <Heading>Welcome to Shopify Browser Agent</Heading>
                <p>Shop: {shop}</p>
                <p>Your app is up and running! 🚀</p>
                <Stack distribution="trailing">
                  <Button primary onClick={handleAction}>
                    Take Action
                  </Button>
                </Stack>
              </TextContainer>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}

// Initialize Shopify App Bridge
const config = {
  apiKey: process.env.SHOPIFY_API_KEY || '',
  host: new URLSearchParams(window.location.search).get('host') || '',
  forceRedirect: true
};

// Create the root element if it doesn't exist
const rootElement = document.getElementById('root');
if (!rootElement) {
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
}

// Initialize the app
const appBridgeConfig = {
  apiKey: config.apiKey,
  host: config.host,
  forceRedirect: config.forceRedirect
};

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppBridgeProvider config={appBridgeConfig}>
      <App />
    </AppBridgeProvider>
  </React.StrictMode>
);