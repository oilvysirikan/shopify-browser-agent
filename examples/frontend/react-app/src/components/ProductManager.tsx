import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Space, 
  Tag, 
  message,
  Spin,
  Popconfirm
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  RobotOutlined,
  ReloadOutlined 
} from '@ant-design/icons';
import { useShopifyAgent } from '../hooks/useShopifyAgent';

const { TextArea } = Input;
const { Option } = Select;

interface Product {
  id: string;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const ProductManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  
  const { getProducts, generateDescription, updateProduct } = useShopifyAgent();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const result = await getProducts();
      if (result.success) {
        setProducts(result.data.products);
      } else {
        message.error('Failed to fetch products');
      }
    } catch (error) {
      message.error('Error fetching products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      title: product.title,
      description: product.description,
      status: product.status
    });
    setModalVisible(true);
  };

  const handleGenerateDescription = async (product: Product) => {
    setEditingProduct(product);
    aiForm.setFieldsValue({
      title: product.title,
      currentDescription: product.description,
      style: 'professional'
    });
    setAiModalVisible(true);
  };

  const handleAiGenerate = async (values: any) => {
    if (!editingProduct) return;
    
    try {
      const result = await generateDescription({
        type: 'product_description',
        productId: editingProduct.id,
        input: values
      });

      if (result.success) {
        // Update the product with AI-generated description
        await updateProduct(editingProduct.id, {
          description: result.data.description
        });
        
        message.success('Description generated successfully!');
        setAiModalVisible(false);
        fetchProducts(); // Refresh products
      } else {
        message.error('Failed to generate description');
      }
    } catch (error) {
      message.error('Error generating description');
    }
  };

  const handleSave = async (values: any) => {
    if (!editingProduct) return;
    
    try {
      const result = await updateProduct(editingProduct.id, values);
      if (result.success) {
        message.success('Product updated successfully!');
        setModalVisible(false);
        fetchProducts();
      } else {
        message.error('Failed to update product');
      }
    } catch (error) {
      message.error('Error updating product');
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Product) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>{record.handle}</div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          active: 'green',
          draft: 'orange',
          archived: 'red'
        };
        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      }
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (
        <div style={{ 
          maxWidth: '200px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {description || 'No description'}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Product) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button 
            icon={<RobotOutlined />} 
            size="small"
            type="dashed"
            onClick={() => handleGenerateDescription(record)}
          >
            AI
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card 
      title="Product Management"
      extra={
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchProducts}
          loading={loading}
        >
          Refresh
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={products}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true
        }}
      />

      {/* Edit Product Modal */}
      <Modal
        title={`Edit Product: ${editingProduct?.title}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: 'Please enter product title' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <TextArea rows={4} />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="draft">Draft</Option>
              <Option value="archived">Archived</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Save Changes
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Description Generator Modal */}
      <Modal
        title={`Generate AI Description for: ${editingProduct?.title}`}
        open={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={aiForm}
          layout="vertical"
          onFinish={handleAiGenerate}
        >
          <Form.Item
            label="Product Title"
            name="title"
            rules={[{ required: true, message: 'Product title is required' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Current Description (Optional)"
            name="currentDescription"
          >
            <TextArea rows={3} placeholder="Enter current description to improve it" />
          </Form.Item>

          <Form.Item
            label="Writing Style"
            name="style"
            initialValue="professional"
          >
            <Select>
              <Option value="professional">Professional</Option>
              <Option value="casual">Casual</Option>
              <Option value="persuasive">Persuasive</Option>
              <Option value="informative">Informative</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Additional Instructions (Optional)"
            name="extraPrompt"
          >
            <TextArea 
              rows={2} 
              placeholder="e.g., Focus on eco-friendly features, target tech enthusiasts"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<RobotOutlined />}>
                Generate Description
              </Button>
              <Button onClick={() => setAiModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
