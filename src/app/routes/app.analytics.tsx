import { useLoaderData, useSearchParams } from '@remix-run/react';
import { json, LoaderFunctionArgs } from '@remix-run/node';
import { authenticate } from '~/shopify.server';
import { Page, Layout, Card, Text, BlockStack, InlineGrid, Badge, DataTable } from '@shopify/polaris';
import { useState, useEffect } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const days = url.searchParams.get('days') || '30';
  
  const response = await fetch(
    `${process.env.SHOPIFY_APP_URL}/api/analytics/dashboard?shop=${session.shop}&days=${days}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Response('Failed to load analytics data', { status: response.status });
  }
  
  return json(await response.json());
}

export default function AnalyticsDashboard() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeRange, setTimeRange] = useState(searchParams.get('days') || '30');
  
  const { summary, dailyStats = [], recentEvents = [], shopUsage, eventsByType = [] } = data;

  // Update URL when time range changes
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('days', timeRange);
    setSearchParams(newParams, { replace: true });
  }, [timeRange, searchParams, setSearchParams]);

  // Calculate success rate
  const successRate = summary?.totalRequests > 0
    ? ((summary.successfulRequests / summary.totalRequests) * 100).toFixed(1)
    : '0';

  // Prepare chart data
  const chartData = dailyStats.map((day: any) => [
    new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day.totalRequests || 0,
    day.successfulRequests || 0,
    day.failedRequests || 0,
  ]);

  // Prepare recent events table
  const eventRows = recentEvents.slice(0, 10).map((event: any) => [
    new Date(event.createdAt).toLocaleString('en-US'),
    event.eventType,
    event.resourceType || '-',
    <Badge tone={event.status === 'success' ? 'success' : 'critical'}>{event.status}</Badge>,
    event.processingTime ? `${event.processingTime}ms` : '-',
    event.tokensUsed || '-',
  ]);

  return (
    <Page title="Analytics Dashboard" subtitle="Track your AI Assistant usage and performance">
      <Layout>
        {/* Summary Cards */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Total Requests
                </Text>
                <Text as="p" variant="heading2xl">
                  {summary?.totalRequests?.toLocaleString() || '0'}
                </Text>
                <Badge tone="info">Last {timeRange} days</Badge>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Success Rate
                </Text>
                <Text as="p" variant="heading2xl">
                  {successRate}%
                </Text>
                <Badge tone="success">
                  {summary?.successfulRequests?.toLocaleString() || '0'} successful
                </Badge>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Products Processed
                </Text>
                <Text as="p" variant="heading2xl">
                  {summary?.productsProcessed?.toLocaleString() || '0'}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Tokens Used
                </Text>
                <Text as="p" variant="heading2xl">
                  {summary?.totalTokensUsed ? (summary.totalTokensUsed / 1000).toFixed(1) + 'K' : '0'}
                </Text>
                {shopUsage && (
                  <Badge tone="attention">
                    {Math.round((shopUsage.totalRequests / shopUsage.monthlyQuota) * 100)}% of quota
                  </Badge>
                )}
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Request Trends */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineGrid columns="1fr auto">
                <Text as="h2" variant="headingMd">
                  Request Trends
                </Text>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                  }}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </InlineGrid>
              
              {chartData.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                  headings={['Date', 'Total', 'Success', 'Failed']}
                  rows={chartData}
                />
              ) : (
                <Text as="p" tone="subdued">No data available for the selected period</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Events by Type */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Events by Type
                </Text>
                <BlockStack gap="200">
                  {eventsByType.length > 0 ? (
                    eventsByType.map((item: any) => (
                      <InlineGrid key={`${item.eventType}-${item.status}`} columns="1fr auto" gap="400">
                        <Text as="p">
                          {item.eventType}
                          <Badge tone={item.status === 'success' ? 'success' : 'critical'} style={{ marginLeft: '8px' }}>
                            {item.status}
                          </Badge>
                        </Text>
                        <Text as="p" fontWeight="semibold">
                          {item._count}
                        </Text>
                      </InlineGrid>
                    ))
                  ) : (
                    <Text as="p" tone="subdued">No event data available</Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Usage & Quota */}
            {shopUsage && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Usage & Quota
                  </Text>
                  <BlockStack gap="200">
                    <InlineGrid columns="1fr auto">
                      <Text as="p">Plan Tier</Text>
                      <Badge>{shopUsage.planTier.toUpperCase()}</Badge>
                    </InlineGrid>
                    <InlineGrid columns="1fr auto">
                      <Text as="p">Monthly Quota</Text>
                      <Text as="p" fontWeight="semibold">
                        {shopUsage.totalRequests} / {shopUsage.monthlyQuota}
                      </Text>
                    </InlineGrid>
                    <InlineGrid columns="1fr auto">
                      <Text as="p">Quota Reset</Text>
                      <Text as="p">
                        {new Date(shopUsage.quotaResetDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                    </InlineGrid>
                  </BlockStack>
                </BlockStack>
              </Card>
            )}
          </InlineGrid>
        </Layout.Section>

        {/* Recent Events */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Events
              </Text>
              {recentEvents.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'numeric']}
                  headings={['Time', 'Event Type', 'Resource', 'Status', 'Duration', 'Tokens']}
                  rows={eventRows}
                />
              ) : (
                <Text as="p" tone="subdued">No recent events</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
