import React from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Stack, 
  Button, 
  Banner, 
  Icon, 
  Badge,
  Thumbnail,
  DataTable,
  TextStyle,
  ButtonGroup
} from '@shopify/polaris';
import { 
  PlusIcon,
  ViewMinor,
  AnalyticsMinor,
  ClockMinor,
  CalendarMinor,
  ProductsMajor
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';

// Mock data - replace with actual data from your API
const stats = [
  {
    id: 'total',
    label: 'Total Content',
    value: '24',
    icon: ProductsMajor,
    trend: 'up' as const,
    trendValue: '12%',
  },
  {
    id: 'thisWeek',
    label: 'This Week',
    value: '8',
    icon: CalendarMinor,
    trend: 'up' as const,
    trendValue: '5%',
  },
  {
    id: 'active',
    label: 'Active',
    value: '18',
    icon: AnalyticsMinor,
    trend: 'down' as const,
    trendValue: '3%',
  },
];

const recentActivities = [
  {
    id: '1',
    type: 'content',
    title: 'Summer Collection',
    description: 'Product description generated',
    time: '2 hours ago',
    status: 'completed',
  },
  {
    id: '2',
    type: 'content',
    title: 'Winter Sale',
    description: 'Promotional email created',
    time: '1 day ago',
    status: 'completed',
  },
  {
    id: '3',
    type: 'content',
    title: 'New Arrivals',
    description: 'Product titles generated',
    time: '2 days ago',
    status: 'completed',
  },
];

interface StatCardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  trend?: 'up' | 'down';
  trendValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, trend, trendValue }) => (
  <Card sectioned>
    <Stack vertical spacing="tight">
      <Stack alignment="center" spacing="tight">
        <div style={{ backgroundColor: '#F4F6F8', borderRadius: '50%', padding: '8px' }}>
          <Icon source={Icon} color="highlight" />
        </div>
        <Text variant="headingLg" as="h3">{value}</Text>
      </Stack>
      <Text as="p" variant="bodyMd" color="subdued">{label}</Text>
      {trend && trendValue && (
        <Text as="p" variant="bodySm" color={trend === 'up' ? 'success' : 'critical'}>
          {trend === 'up' ? '↑' : '↓'} {trendValue} from last week
        </Text>
      )}
    </Stack>
  </Card>
);

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  status: string;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ title, description, time, status }) => (
  <div style={{ padding: '12px 0', borderBottom: '1px solid #E1E3E5' }}>
    <Stack alignment="baseline">
      <Text variant="bodyMd" fontWeight="semibold" as="h4">{title}</Text>
      <Badge status={status === 'completed' ? 'success' : 'attention'}>{status}</Badge>
    </Stack>
    <Text as="p" variant="bodySm" color="subdued">{description}</Text>
    <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
      <Icon source={ClockMinor} color="subdued" />
      <div style={{ marginLeft: '4px' }}>
        <Text as="span" variant="bodySm" color="subdued">{time}</Text>
      </div>
    </div>
  </div>
);

export function Dashboard() {
  const navigate = useNavigate();
  
  return (
    <Page
      title="Dashboard"
      primaryAction={
        <Button primary icon={PlusIcon} onClick={() => navigate('/generate')}>
          Generate Content
        </Button>
      }
      secondaryActions={[
        {
          content: 'View Analytics',
          onAction: () => console.log('View Analytics'),
          icon: AnalyticsMinor,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Banner
            title="Welcome to AI Content Generator"
            status="info"
          >
            <p>Create engaging content for your Shopify store with the power of AI.</p>
          </Banner>
        </Layout.Section>
        
        {/* Stats Overview */}
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingLg" as="h2">Overview</Text>
            <div style={{ marginTop: '16px' }}>
              <Stack distribution="fillEvenly" wrap={false} spacing="loose">
                {stats.map((stat) => (
                  <StatCard key={stat.id} {...stat} />
                ))}
              </Stack>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Layout>
            {/* Quick Actions */}
            <Layout.Section oneHalf>
              <Card title="Quick Actions" sectioned>
                <Stack vertical spacing="loose">
                  <ButtonGroup fullWidth segmented>
                    <Button 
                      icon={PlusIcon}
                      onClick={() => navigate('/generate')}
                      fullWidth
                      primary
                    >
                      Generate Content
                    </Button>
                    <Button 
                      icon={ViewMinor}
                      onClick={() => navigate('/content')}
                      fullWidth
                    >
                      View Library
                    </Button>
                  </ButtonGroup>
                  
                  <Stack distribution="fillEvenly">
                    <Button onClick={() => navigate('/generate?type=product')}>
                      Product Descriptions
                    </Button>
                    <Button onClick={() => navigate('/generate?type=email')}>
                      Email Campaigns
                    </Button>
                    <Button onClick={() => navigate('/generate?type=social')}>
                      Social Media
                    </Button>
                  </Stack>
                </Stack>
              </Card>
            </Layout.Section>
            
            {/* Recent Activity */}
            <Layout.Section oneHalf>
              <Card title="Recent Activity" sectioned>
                <Stack vertical spacing="loose">
                  {recentActivities.length > 0 ? (
                    recentActivities.map((activity) => (
                      <ActivityItem key={activity.id} {...activity} />
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Text as="p" variant="bodyMd" color="subdued">
                        No recent activities found.
                      </Text>
                    </div>
                  )}
                  <div style={{ textAlign: 'right', marginTop: '12px' }}>
                    <Button plain onClick={() => navigate('/content')}>
                      View all activities
                    </Button>
                  </div>
                </Stack>
              </Card>
            </Layout.Section>
          </Layout>
        </Layout.Section>
        
        {/* Content Performance */}
        <Layout.Section>
          <Card 
            title="Content Performance" 
            sectioned
            actions={[
              { content: 'View Full Report', onAction: () => console.log('View report') },
            ]}
          >
            <div style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text as="p" variant="bodyMd" color="subdued">
                Performance metrics and analytics will be displayed here.
              </Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default Dashboard;
