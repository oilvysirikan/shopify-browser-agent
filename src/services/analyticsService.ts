import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Type for the error with code property
type PrismaError = Error & { code?: string };

export interface TrackEventParams {
  shop: string;
  eventType: string;
  resourceType?: 'product' | 'collection' | 'article' | string;
  resourceId?: string;
  metadata?: Record<string, any>;
  tokensUsed?: number;
  processingTime?: number;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}

export interface ShopUsageUpdateInput {
  totalRequests?: number;
  totalTokensUsed?: number;
}

export class AnalyticsService {
  /**
   * Track an analytics event
   */
  static async trackEvent(params: TrackEventParams) {
    const {
      shop,
      eventType,
      resourceType,
      resourceId,
      metadata,
      tokensUsed,
      processingTime,
      status,
      errorMessage,
    } = params;

    // Create the analytics event
    const event = await prisma.analyticsEvent.create({
      data: {
        shop,
        eventType,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        tokensUsed,
        processingTime,
        status,
        errorMessage,
      },
    });

    // Update daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await prisma.dailyAnalytics.upsert({
      where: {
        shop_date: {
          shop,
          date: today
        }
      },
      update: {
        totalRequests: { increment: 1 },
        ...(status === 'success' && { successfulRequests: { increment: 1 } }),
        ...(status === 'failed' && { failedRequests: { increment: 1 } }),
        ...(tokensUsed && { totalTokensUsed: { increment: tokensUsed } }),
        ...(resourceType === 'product' && { productsProcessed: { increment: 1 } }),
        ...(resourceType === 'collection' && { collectionsProcessed: { increment: 1 } }),
        ...(resourceType === 'article' && { articlesProcessed: { increment: 1 } }),
      },
      create: {
        shop,
        date: today,
        totalRequests: 1,
        successfulRequests: status === 'success' ? 1 : 0,
        failedRequests: status === 'failed' ? 1 : 0,
        totalTokensUsed: tokensUsed || 0,
        productsProcessed: resourceType === 'product' ? 1 : 0,
        collectionsProcessed: resourceType === 'collection' ? 1 : 0,
        articlesProcessed: resourceType === 'article' ? 1 : 0,
      },
    });

    // Use raw SQL to update or create shop usage record
    const nextMonthFirstDay = this.getNextMonthFirstDay();
    
    try {
      // First, try to update the existing record
      if (tokensUsed !== undefined) {
        await prisma.$executeRaw`
          INSERT INTO "ShopUsage" (shop, "totalRequests", "totalTokensUsed", "monthlyQuota", "quotaResetDate", "planTier", "isActive", "createdAt", "updatedAt")
          VALUES (${shop}, 1, ${tokensUsed}, 1000, ${nextMonthFirstDay.toISOString()}, 'free', true, ${new Date().toISOString()}, ${new Date().toISOString()})
          ON CONFLICT (shop) 
          DO UPDATE SET 
            "totalRequests" = "ShopUsage"."totalRequests" + 1,
            "totalTokensUsed" = COALESCE("ShopUsage"."totalTokensUsed", 0) + ${tokensUsed},
            "updatedAt" = ${new Date().toISOString()}
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "ShopUsage" (shop, "totalRequests", "monthlyQuota", "quotaResetDate", "planTier", "isActive", "createdAt", "updatedAt")
          VALUES (${shop}, 1, 1000, ${nextMonthFirstDay.toISOString()}, 'free', true, ${new Date().toISOString()}, ${new Date().toISOString()})
          ON CONFLICT (shop) 
          DO UPDATE SET 
            "totalRequests" = "ShopUsage"."totalRequests" + 1,
            "updatedAt" = ${new Date().toISOString()}
        `;
      }
    } catch (error) {
      console.error('Error updating shop usage:', error);
      throw error;
    }

    return event;
  }

  /**
   * Update daily analytics
   */
  static async updateDailyStats(shop: string, date: Date, updates: Record<string, any>) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    // Create a new object for the update data with proper typing
    const updateData: Prisma.DailyAnalyticsUpdateInput = {
      updatedAt: new Date()
    };

    // Process updates to handle increment operations
    for (const [key, value] of Object.entries(updates)) {
      if (value && typeof value === 'object' && 'increment' in value) {
        // Handle increment operations with type assertion
        (updateData as any)[key] = { increment: (value as any).increment };
      } else {
        // Handle regular updates with type assertion
        (updateData as any)[key] = value;
      }
    }

    // Create the data for a new record if needed
    const createData: Prisma.DailyAnalyticsCreateInput = {
      shop,
      date: dateOnly,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokensUsed: 0,
      productsProcessed: 0,
      collectionsProcessed: 0,
      articlesProcessed: 0,
      // Spread the updates that are not increment operations
      ...Object.entries(updates).reduce((acc, [key, value]) => {
        if (!(value && typeof value === 'object' && 'increment' in value)) {
          (acc as any)[key] = value;
        }
        return acc;
      }, {} as Record<string, any>)
    };

    try {
      return await prisma.dailyAnalytics.upsert({
        where: { shop_date: { shop, date: dateOnly } },
        update: updateData,
        create: createData,
      });
    } catch (error) {
      console.error('Error updating daily stats:', error);
      throw error;
    }
  }

  /**
   * Get dashboard data
   */
  static async getDashboardData(shop: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Define types for the raw query result
    type EventsByTypeResult = Array<{
      eventType: string;
      status: string;
      count: bigint;
    }>;

    // Fetch all data in parallel
    const [
      dailyStats,
      recentEvents,
      shopUsage,
      eventsByTypeRaw,
    ] = await Promise.all([
      // Daily statistics
      prisma.dailyAnalytics.findMany({
        where: {
          shop,
          date: { gte: startDate },
        },
        orderBy: { date: 'asc' },
      }),

      // Recent events
      prisma.analyticsEvent.findMany({
        where: { shop },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // Shop usage
      prisma.shopUsage.findUnique({
        where: { shop },
      }),

      // Events by type - using raw query as groupBy might not be supported in SQLite
      prisma.$queryRaw<EventsByTypeResult>`
        SELECT "eventType", status, COUNT(*) as count
        FROM "AnalyticsEvent"
        WHERE shop = ${shop} AND "createdAt" >= ${startDate}
        GROUP BY "eventType", status
      `,
    ]);

    // Convert BigInt to number for the events by type
    const eventsByType = (eventsByTypeRaw || []).map(item => ({
      ...item,
      count: Number(item.count)
    }));

    // Calculate summary statistics
    const summary = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokensUsed: 0,
      productsProcessed: 0,
      collectionsProcessed: 0,
      articlesProcessed: 0,
    };

    // Type guard to check if the value is a number
    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'bigint') return Number(value);
      if (typeof value === 'string') return parseFloat(value) || 0;
      return 0;
    };

    // Calculate summary from daily stats
    for (const day of dailyStats) {
      summary.totalRequests += toNumber(day.totalRequests);
      summary.successfulRequests += toNumber(day.successfulRequests);
      summary.failedRequests += toNumber(day.failedRequests);
      summary.totalTokensUsed += toNumber(day.totalTokensUsed);
      summary.productsProcessed += toNumber(day.productsProcessed);
      summary.collectionsProcessed += toNumber(day.collectionsProcessed);
      summary.articlesProcessed += toNumber(day.articlesProcessed);
    }

    return {
      summary,
      dailyStats: dailyStats.map(day => ({
        ...day,
        // Ensure all numeric fields are converted to numbers
        totalRequests: toNumber(day.totalRequests),
        successfulRequests: toNumber(day.successfulRequests),
        failedRequests: toNumber(day.failedRequests),
        totalTokensUsed: toNumber(day.totalTokensUsed),
        productsProcessed: toNumber(day.productsProcessed),
        collectionsProcessed: toNumber(day.collectionsProcessed),
        articlesProcessed: toNumber(day.articlesProcessed),
        // Convert date to string for consistent serialization
        date: day.date.toISOString(),
        createdAt: day.createdAt.toISOString(),
        updatedAt: day.updatedAt.toISOString()
      })),
      recentEvents: recentEvents.map(event => ({
        ...event,
        // Convert date to string for consistent serialization
        createdAt: event.createdAt.toISOString(),
        // Ensure metadata is properly serialized
        metadata: event.metadata ? JSON.parse(JSON.stringify(event.metadata)) : null
      })),
      shopUsage: shopUsage ? {
        ...shopUsage,
        // Convert date to string for consistent serialization
        quotaResetDate: shopUsage.quotaResetDate.toISOString(),
        createdAt: shopUsage.createdAt.toISOString(),
        updatedAt: shopUsage.updatedAt.toISOString()
      } : null,
      eventsByType
    };
  }

  /**
   * Get events with filtering
   */
  static async getEvents({
    shop,
    eventType,
    status,
    limit = 100,
    offset = 0,
  }: {
    shop: string;
    eventType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { shop };
    
    if (eventType) where.eventType = eventType;
    if (status) where.status = status;

    const [events, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.analyticsEvent.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Get shop usage
   */
  static async getShopUsage(shop: string) {
    return prisma.shopUsage.findUnique({
      where: { shop },
    });
  }

  /**
   * Get distinct event types for a shop
   */
  static async getEventTypes(shop: string): Promise<string[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ eventType: string }>>`
        SELECT DISTINCT "eventType" 
        FROM "AnalyticsEvent" 
        WHERE shop = ${shop}
        ORDER BY "eventType" ASC
      `;
      
      return result.map(row => row.eventType);
    } catch (error) {
      console.error('Error getting event types:', error);
      return [];
    }
  }

  /**
   * Helper to get first day of next month
   */
  private static getNextMonthFirstDay(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /**
   * Update shop usage metrics
   */
  static async updateShopUsage(shop: string, update: ShopUsageUpdateInput) {
    if (!update.totalRequests && !update.totalTokensUsed) {
      return; // No updates needed
    }

    const now = new Date();
    const nextMonthFirstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    try {
      // First, try to update the existing record
      if (update.totalTokensUsed !== undefined) {
        await prisma.$executeRaw`
          INSERT INTO "ShopUsage" (shop, "totalRequests", "totalTokensUsed", "monthlyQuota", "quotaResetDate", "planTier", "isActive", "createdAt", "updatedAt")
          VALUES (
            ${shop}, 
            ${update.totalRequests || 1}, 
            ${update.totalTokensUsed}, 
            1000, 
            ${nextMonthFirstDay.toISOString()}, 
            'free', 
            true, 
            ${now.toISOString()}, 
            ${now.toISOString()}
          )
          ON CONFLICT (shop) 
          DO UPDATE SET 
            "totalRequests" = COALESCE("ShopUsage"."totalRequests", 0) + ${update.totalRequests || 1},
            "totalTokensUsed" = COALESCE("ShopUsage"."totalTokensUsed", 0) + ${update.totalTokensUsed},
            "updatedAt" = ${now.toISOString()}
        `;
      } else if (update.totalRequests !== undefined) {
        await prisma.$executeRaw`
          INSERT INTO "ShopUsage" (shop, "totalRequests", "monthlyQuota", "quotaResetDate", "planTier", "isActive", "createdAt", "updatedAt")
          VALUES (
            ${shop}, 
            ${update.totalRequests}, 
            1000, 
            ${nextMonthFirstDay.toISOString()}, 
            'free', 
            true, 
            ${now.toISOString()}, 
            ${now.toISOString()}
          )
          ON CONFLICT (shop) 
          DO UPDATE SET 
            "totalRequests" = COALESCE("ShopUsage"."totalRequests", 0) + ${update.totalRequests},
            "updatedAt" = ${now.toISOString()}
        `;
      }
    } catch (error) {
      console.error('Error updating shop usage:', error);
      throw error;
    }
  }
}

export default AnalyticsService;