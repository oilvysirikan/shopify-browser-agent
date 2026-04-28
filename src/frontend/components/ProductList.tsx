import React, { useState, useEffect } from 'react';
import { Card, DataTable, Page, Layout, SkeletonBodyText, SkeletonDisplayText, Text, Banner } from '@shopify/polaris';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from '@shopify/app-bridge-utils';

interface Product {
  id: string;
  title: string;
  vendor: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const ProductList: React.FC = () => {
  const app = useAppBridge();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch product count
        const countResponse = await authenticatedFetch(app)('/api/shopify/products/count');
        const countData = await countResponse.json();
        setProductCount(countData.count);
        
        // Fetch products
        const productsResponse = await authenticatedFetch(app)('/api/shopify/products');
        const productsData = await productsResponse.json();
        
        if (productsResponse.ok) {
          setProducts(productsData);
        } else {
          throw new Error(productsData.message || 'Failed to fetch products');
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err.message || 'An error occurred while fetching products');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [app]);

  const rows = products.map((product) => [
    product.title,
    product.vendor || '-',
    product.status,
    new Date(product.createdAt).toLocaleDateString(),
    new Date(product.updatedAt).toLocaleDateString(),
  ]);

  if (loading) {
    return (
      <Page title="Products">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <SkeletonBodyText lines={5} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Products">
        <Layout>
          <Layout.Section>
            <Banner
              title="Error loading products"
              status="critical"
            >
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Products"
      subtitle={`${productCount} products in your store`}
      primaryAction={{
        content: 'Add product',
        onAction: () => {
          // Handle add product
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text']}
              headings={['Title', 'Vendor', 'Status', 'Created', 'Last Updated']}
              rows={rows}
              footerContent={`Showing ${products.length} of ${productCount} products`}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default ProductList;
