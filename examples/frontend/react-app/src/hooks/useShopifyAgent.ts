import { useState, useCallback } from 'react';

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

// Types
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ShopData {
  shop: string;
  scopes: string[];
  expiresIn: number;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

interface GenerateDescriptionRequest {
  type: 'product_description';
  productId: string;
  input: {
    title: string;
    currentDescription?: string;
    style?: 'professional' | 'casual' | 'persuasive' | 'informative';
    extraPrompt?: string;
  };
}

interface GenerateDescriptionResponse {
  description: string;
  usage: {
    tokens: number;
    model: string;
  };
}

// Custom hook for Shopify Agent API
export const useShopifyAgent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shopData, setShopData] = useState<ShopData | null>(null);

  // Generic API request helper
  const apiRequest = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    const token = localStorage.getItem('shopify_agent_token');
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'API request failed');
    }

    return data;
  }, []);

  // Register shop
  const registerShop = useCallback(async (data: { shop: string; sessionToken: string }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<ShopData>('/shopify/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        setShopData(response.data);
        setIsAuthenticated(true);
        // Store token (simplified - in production, use secure storage)
        localStorage.setItem('shopify_agent_token', data.sessionToken);
      }

      return response;
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Get shop info
  const getShopInfo = useCallback(async () => {
    try {
      const response = await apiRequest<any>('/shopify/shop');
      if (response.success) {
        setShopData(response.data);
        setIsAuthenticated(true);
      }
      return response;
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [apiRequest]);

  // Get products
  const getProducts = useCallback(async (params: { page?: number; limit?: number } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams(params as any).toString();
      const response = await apiRequest<ProductsResponse>(
        `/shopify/products${queryParams ? `?${queryParams}` : ''}`
      );

      return response;
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Get product by ID
  const getProduct = useCallback(async (productId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<Product>(`/shopify/products/${productId}`);
      return response;
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Generate AI description
  const generateDescription = useCallback(async (data: GenerateDescriptionRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<GenerateDescriptionResponse>('/shopify-ai/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      return response;
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Update product
  const updateProduct = useCallback(async (productId: string, data: Partial<Product>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<Product>(`/shopify/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      return response;
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('shopify_agent_token');
    setShopData(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return {
    // State
    loading,
    error,
    isAuthenticated,
    shopData,
    
    // Methods
    registerShop,
    getShopInfo,
    getProducts,
    getProduct,
    generateDescription,
    updateProduct,
    logout,
    
    // Computed
    isRegistered: !!shopData,
  };
};
