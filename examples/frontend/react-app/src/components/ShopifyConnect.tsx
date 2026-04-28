import React, { useState } from 'react';
import { Button, Card, Form, Input, Alert, Spin } from 'antd';
import { ShopifyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useShopifyAgent } from '../hooks/useShopifyAgent';

interface ShopifyConnectProps {
  onConnect?: (shopData: any) => void;
}

export const ShopifyConnect: React.FC<ShopifyConnectProps> = ({ onConnect }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const { registerShop, isRegistered } = useShopifyAgent();

  const handleSubmit = async (values: { shop: string; sessionToken: string }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await registerShop(values);
      
      if (result.success) {
        setSuccess(true);
        onConnect?.(result);
        form.resetFields();
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
          <h3>Shop Connected Successfully!</h3>
          <p>Your store is now connected to the Shopify Agent.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShopifyOutlined />
          Connect Your Shopify Store
        </div>
      }
    >
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}
      
      {success && (
        <Alert
          message="Success!"
          description="Your store has been connected successfully."
          type="success"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading}
      >
        <Form.Item
          label="Shop Domain"
          name="shop"
          rules={[
            { required: true, message: 'Please enter your shop domain' },
            { 
              pattern: /^[a-zA-Z0-9-]+\.myshopify\.com$/, 
              message: 'Please enter a valid Shopify domain (e.g., your-store.myshopify.com)' 
            }
          ]}
        >
          <Input 
            placeholder="your-store.myshopify.com"
            prefix={<ShopifyOutlined />}
          />
        </Form.Item>

        <Form.Item
          label="Session Token"
          name="sessionToken"
          rules={[{ required: true, message: 'Please enter your session token' }]}
          extra="Get this from Shopify App Bridge"
        >
          <Input.Password 
            placeholder="Session token from Shopify App Bridge"
          />
        </Form.Item>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            block
            size="large"
          >
            {loading ? <Spin size="small" /> : null}
            Connect Store
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
