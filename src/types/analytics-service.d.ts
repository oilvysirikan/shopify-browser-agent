declare module '../services/analyticsService' {
  export class AnalyticsService {
    static trackEvent(eventName: string, properties?: Record<string, any>): Promise<void>;
    static getAnalytics(shop: string, startDate: Date, endDate: Date): Promise<any>;
  }

  // Export as default for backward compatibility
  const analyticsService: typeof AnalyticsService;
  export default analyticsService;
}
