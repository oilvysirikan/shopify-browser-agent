import React from 'react';
import { AppProvider, Page, Layout, Card, Frame } from '@shopify/polaris';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';
import { Navigation } from './components/Navigation';
import { Dashboard } from './pages/Dashboard';
import { ContentGenerator } from './pages/ContentGenerator';
import { ContentList } from './pages/ContentList';
// Theme is configured through PolarisProvider in index.tsx

export function App() {
  return (
    <AppProvider i18n={enTranslations}>
      <Router>
        <Frame navigation={<Navigation />}>
          <Page fullWidth>
            <Layout>
              <Layout.Section>
                <Card sectioned>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/generate" element={<ContentGenerator />} />
                    <Route path="/content" element={<ContentList />} />
                  </Routes>
                </Card>
              </Layout.Section>
            </Layout>
          </Page>
        </Frame>
      </Router>
    </AppProvider>
  );
}

export default App;
