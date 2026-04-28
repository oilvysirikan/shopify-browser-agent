import { TitleBar } from "@shopify/app-bridge-react";
import { Page, Layout, Card } from "@shopify/polaris";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();
  
  return (
    <Page>
      <TitleBar title={t("Seafood Marketplace")} />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <h1>Welcome to Seafood Marketplace</h1>
            <p>Manage your seafood products and orders in one place.</p>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
