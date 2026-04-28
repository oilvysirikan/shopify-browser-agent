import { logger } from '../logger';

type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

type MetricOptions = {
  type: MetricType;
  name: string;
  help?: string;
  labelNames?: string[];
  buckets?: number[]; // for histogram
  percentiles?: number[]; // for summary
};

type MetricValue = number | { [key: string]: number };

interface IMetric {
  type: MetricType;
  name: string;
  help?: string;
  observe(value: number, labels?: Record<string, string>): void;
  get(labels?: Record<string, string>): number | null;
  reset(): void;
}

class BaseMetric implements IMetric {
  public type: MetricType;
  public name: string;
  public help?: string;
  protected values: Map<string, number> = new Map();

  constructor(options: MetricOptions) {
    this.type = options.type;
    this.name = options.name;
    this.help = options.help;
  }

  protected getKey(labels: Record<string, string> = {}): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  observe(_value: number, _labels?: Record<string, string>): void {
    throw new Error('Method not implemented');
  }

  get(_labels?: Record<string, string>): number | null {
    throw new Error('Method not implemented');
  }

  reset(): void {
    this.values.clear();
  }
}

class CounterMetric extends BaseMetric {
  constructor(options: Omit<MetricOptions, 'type'>) {
    super({ ...options, type: 'counter' });
  }

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  get(labels: Record<string, string> = {}): number | null {
    const key = this.getKey(labels);
    return this.values.get(key) || 0;
  }
}

class GaugeMetric extends BaseMetric {
  constructor(options: Omit<MetricOptions, 'type'>) {
    super({ ...options, type: 'gauge' });
  }

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(labels);
    this.values.set(key, value);
  }

  get(labels: Record<string, string> = {}): number | null {
    const key = this.getKey(labels);
    return this.values.get(key) ?? null;
  }
}

class HistogramMetric extends BaseMetric {
  private buckets: number[];
  private counts: Map<string, number[]> = new Map();
  private sums: Map<string, number> = new Map();

  constructor(options: Omit<MetricOptions, 'type'> & { buckets?: number[] }) {
    super({ ...options, type: 'histogram' });
    this.buckets = options.buckets || [0.1, 0.5, 1, 2.5, 5, 10];
  }

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(labels);
    
    // Update sum
    const currentSum = this.sums.get(key) || 0;
    this.sums.set(key, currentSum + value);
    
    // Update bucket counts
    const counts = this.counts.get(key) || Array(this.buckets.length + 1).fill(0);
    let bucketIndex = 0;
    
    while (bucketIndex < this.buckets.length && value > this.buckets[bucketIndex]) {
      bucketIndex++;
    }
    
    counts[bucketIndex]++;
    this.counts.set(key, counts);
  }

  get(labels: Record<string, string> = {}): { [key: string]: number } | null {
    const key = this.getKey(labels);
    const counts = this.counts.get(key);
    const sum = this.sums.get(key);
    
    if (!counts || sum === undefined) return null;
    
    const result: Record<string, number> = {};
    
    // Add bucket values
    for (let i = 0; i < this.buckets.length; i++) {
      const upperBound = this.buckets[i];
      result[`${this.name}_bucket{le="${upperBound}"}`] = counts
        .slice(0, i + 1)
        .reduce((a, b) => a + b, 0);
    }
    
    // Add the +Inf bucket (count of all observations)
    const totalCount = counts.reduce((a, b) => a + b, 0);
    result[`${this.name}_bucket{le="+Inf"}`] = totalCount;
    
    // Add sum and count
    result[`${this.name}_sum`] = sum;
    result[`${this.name}_count`] = totalCount;
    
    return result;
  }

  reset(): void {
    super.reset();
    this.counts.clear();
    this.sums.clear();
  }
}

export class MetricsCollector {
  private metrics: Map<string, IMetric> = new Map();
  private static instance: MetricsCollector;

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Create a new metric
   */
  createMetric(options: MetricOptions): IMetric {
    if (this.metrics.has(options.name)) {
      throw new Error(`Metric ${options.name} already exists`);
    }

    let metric: IMetric;

    switch (options.type) {
      case 'counter':
        metric = new CounterMetric(options);
        break;
      case 'gauge':
        metric = new GaugeMetric(options);
        break;
      case 'histogram':
        metric = new HistogramMetric({
          name: options.name,
          help: options.help,
          labelNames: options.labelNames,
          buckets: (options as any).buckets,
        });
        break;
      default:
        throw new Error(`Unsupported metric type: ${options.type}`);
    }

    this.metrics.set(options.name, metric);
    return metric;
  }

  /**
   * Get an existing metric
   */
  getMetric(name: string): IMetric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics in Prometheus format
   */
  getMetrics(): string {
    const lines: string[] = [];

    for (const [name, metric] of this.metrics.entries()) {
      // Add help text if available
      if (metric.help) {
        lines.push(`# HELP ${name} ${metric.help}`);
      }

      // Add type
      lines.push(`# TYPE ${name} ${metric.type}`);

      // Add metric values
      if (metric.type === 'histogram' || metric.type === 'summary') {
        const values = metric.get() as Record<string, number>;
        for (const [key, value] of Object.entries(values)) {
          lines.push(`${key} ${value}`);
        }
      } else {
        // For counters and gauges
        const value = metric.get();
        if (value !== null) {
          lines.push(`${name} ${value}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }

  /**
   * Track AI service metrics
   */
  trackAIMetrics(provider: string, duration: number, success: boolean): void {
    // Track request count
    const requestCounter = this.getMetric('ai_requests_total') as CounterMetric | undefined;
    requestCounter?.observe(1, { provider, status: success ? 'success' : 'error' });

    // Track request duration
    const durationHistogram = this.getMetric('ai_request_duration_seconds') as HistogramMetric | undefined;
    durationHistogram?.observe(duration / 1000, { provider });

    if (!success) {
      const errorCounter = this.getMetric('ai_errors_total') as CounterMetric | undefined;
      errorCounter?.observe(1, { provider });
    }
  }
}

// Initialize default metrics
const metrics = MetricsCollector.getInstance();

// AI request counter
export const aiRequestsCounter = metrics.createMetric({
  type: 'counter',
  name: 'ai_requests_total',
  help: 'Total number of AI API requests',
  labelNames: ['provider', 'status'],
}) as CounterMetric;

// AI request duration histogram
export const aiRequestDuration = metrics.createMetric({
  type: 'histogram',
  name: 'ai_request_duration_seconds',
  help: 'Duration of AI API requests in seconds',
  labelNames: ['provider'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10],
}) as HistogramMetric;

// AI error counter
export const aiErrorsCounter = metrics.createMetric({
  type: 'counter',
  name: 'ai_errors_total',
  help: 'Total number of AI API errors',
  labelNames: ['provider'],
}) as CounterMetric;
