import { prisma } from '../prisma.js';
import fetch from 'node-fetch';
import { z } from 'zod';

const TokenResponseSchema = z.object({
  access_token: z.string(),
  scope: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z.number().optional(),
});

type TokenResponse = z.infer<typeof TokenResponseSchema>;

export class ShopifyTokenService {
  static async exchangeToken(shop: string, sessionToken: string): Promise<TokenResponse> {
    const url = `https://${shop}/admin/oauth/access_token`;
    const params = new URLSearchParams();
    
    params.append('client_id', process.env.SHOPIFY_API_KEY!);
    params.append('client_secret', process.env.SHOPIFY_API_SECRET!);
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:token-exchange');
    params.append('subject_token', sessionToken);
    params.append('subject_token_type', 'urn:ietf:params:oauth:token-type:id_token');
    params.append('requested_token_type', 'urn:shopify:params:oauth:token-type:offline-access-token');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    return TokenResponseSchema.parse(data);
  }

  static async storeToken(tenantId: string, tokenData: TokenResponse) {
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    return prisma.shopifyAuth.upsert({
      where: { tenantId },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scope: tokenData.scope,
        expiresAt,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scope: tokenData.scope,
        expiresAt,
      },
    });
  }

  static async getActiveToken(shop: string) {
    const now = new Date();
    
    // First find the tenant by shop domain
    const tenant = await prisma.tenant.findFirst({
      where: { shop },
      select: { id: true }
    });

    if (!tenant) {
      throw new Error(`No tenant found for shop: ${shop}`);
    }

    // Find active auth for this tenant
    const auth = await prisma.shopifyAuth.findFirst({
      where: { 
        tenantId: tenant.id,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (!auth) {
      throw new Error(`No active token found for shop: ${shop}`);
    }

    // If token is expired but we have a refresh token, try to refresh it
    if (auth.expiresAt && auth.expiresAt < now && auth.refreshToken) {
      return this.refreshToken(tenant.id, auth.refreshToken);
    }

    return auth.accessToken;
  }

  private static async refreshToken(tenantId: string, refreshToken: string) {
    const shop = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { shop: true }
    });

    if (!shop) {
      throw new Error('Tenant not found');
    }

    const url = `https://${shop.shop}/admin/oauth/access_token`;
    const params = new URLSearchParams();
    
    params.append('client_id', process.env.SHOPIFY_API_KEY!);
    params.append('client_secret', process.env.SHOPIFY_API_SECRET!);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    const tokenData = TokenResponseSchema.parse(data);
    
    await this.storeToken(tenantId, tokenData);
    return tokenData.access_token;
  }
}

export default ShopifyTokenService;
