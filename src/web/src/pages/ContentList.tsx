import React, { useState, useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  DataTable, 
  EmptyState, 
  Button, 
  TextContainer, 
  Stack, 
  Badge, 
  Pagination,
  TextField,
  Select,
  Filters,
  ButtonGroup,
  Icon
} from '@shopify/polaris';
import { SearchMinor, FilterMajor } from '@shopify/polaris-icons';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  date: string;
  status: 'draft' | 'published' | 'archived';
  preview: string;
}

type SortDirection = 'ascending' | 'descending';
type SortField = 'title' | 'date' | 'type' | 'status';

export function ContentList() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Mock data - replace with actual API call
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock data
        const mockData: ContentItem[] = [
          {
            id: '1',
            title: 'Summer Collection Product Descriptions',
            type: 'product_description',
            date: '2023-06-15T10:30:00Z',
            status: 'published',
            preview: 'Beautiful summer collection featuring...',
          },
          {
            id: '2',
            title: 'Weekly Newsletter',
            type: 'email',
            date: '2023-06-10T14:45:00Z',
            status: 'draft',
            preview: 'Check out our latest products and offers...',
          },
          // Add more mock items as needed
        ];
        
        setContent(mockData);
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  // Filter and sort content
  const filteredContent = content
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(query.toLowerCase()) ||
                         item.preview.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      if (a[sortField] < b[sortField]) {
        comparison = -1;
      } else if (a[sortField] > b[sortField]) {
        comparison = 1;
      }
      
      return sortDirection === 'ascending' ? comparison : -comparison;
    });

  // Pagination
  const totalPages = Math.ceil(filteredContent.length / rowsPerPage);
  const paginatedContent = filteredContent.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  // Table rows
  const rows = paginatedContent.map(item => [
    item.title,
    item.type.replace('_', ' '),
    new Date(item.date).toLocaleDateString(),
    <Badge status={item.status === 'published' ? 'success' : 'new'}>{item.status}</Badge>,
    item.preview,
    <ButtonGroup>
      <Button size="slim" onClick={() => handleView(item.id)}>View</Button>
      <Button size="slim" onClick={() => handleEdit(item.id)}>Edit</Button>
    </ButtonGroup>
  ]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'ascending' ? 'descending' : 'ascending');
    } else {
      setSortField(field);
      setSortDirection('ascending');
    }
  };

  const handleView = (id: string) => {
    // Implement view functionality
    console.log('View content:', id);
  };

  const handleEdit = (id: string) => {
    // Implement edit functionality
    console.log('Edit content:', id);
  };

  const handleBulkAction = (action: string) => {
    // Implement bulk actions
    console.log(`${action} selected items:`, selectedItems);
  };

  const statusFilterOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
  ];

  const typeFilterOptions = [
    { label: 'All Types', value: 'all' },
    { label: 'Product Description', value: 'product_description' },
    { label: 'Blog Post', value: 'blog_post' },
    { label: 'Email', value: 'email' },
    { label: 'Meta Description', value: 'meta_description' },
  ];

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <Select
          label="Status"
          labelHidden
          options={statusFilterOptions}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
        />
      ),
      shortcut: true,
    },
    {
      key: 'type',
      label: 'Type',
      filter: (
        <Select
          label="Type"
          labelHidden
          options={typeFilterOptions}
          value={typeFilter}
          onChange={(value) => setTypeFilter(value)}
        />
      ),
      shortcut: true,
    },
  ];

  return (
    <Page
      title="Content Library"
      primaryAction={{
        content: 'Generate New',
        url: '/generate',
      }}
      secondaryActions={[
        {
          content: 'Export',
          onAction: () => console.log('Export'),
        },
      ]}
      pagination={{
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        onNext: () => setPage(prev => Math.min(prev + 1, totalPages)),
        onPrevious: () => setPage(prev => Math.max(prev - 1, 1)),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: '2rem 0' }}>
              <Stack vertical spacing="loose">
                <Stack distribution="equalSpacing" alignment="center">
                  <div style={{ width: '50%' }}>
                    <TextField
                      label="Search content"
                      labelHidden
                      placeholder="Search by title or content..."
                      value={query}
                      onChange={setQuery}
                      prefix={<Icon source={SearchMinor} color="base" />}
                      autoComplete="off"
                    />
                  </div>
                  <Filters
                    queryValue=""
                    filters={filters}
                    onQueryChange={() => {}}
                    onQueryClear={() => {}}
                    onClearAll={() => {
                      setStatusFilter('all');
                      setTypeFilter('all');
                    }}
                    hideQueryField
                  >
                    <Button disabled={!selectedItems.length} onClick={() => handleBulkAction('delete')}>
                      Delete Selected
                    </Button>
                  </Filters>
                </Stack>
                
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <Stack vertical alignment="center" spacing="loose">
                      <div style={{ width: '40px', height: '40px' }}>
                        <div style={{ animation: 'spinner-rotate 1s linear infinite' }}>
                          <Icon source={FilterMajor} color="highlight" />
                        </div>
                      </div>
                      <TextContainer>Loading your content...</TextContainer>
                    </Stack>
                  </div>
                ) : filteredContent.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      'text',
                      'text',
                      'text',
                      'text',
                      'text',
                      'text',
                    ]}
                    headings={[
                      'Title',
                      'Type',
                      'Date',
                      'Status',
                      'Preview',
                      'Actions',
                    ]}
                    rows={rows}
                    sortable={[true, true, true, true, false, false]}
                    defaultSortDirection="descending"
                    initialSortColumnIndex={2}
                    onSort={handleSort}
                    selectedItems={selectedItems}
                    onSelectionChange={setSelectedItems}
                    selectable
                  />
                ) : (
                  <EmptyState
                    heading="No content found"
                    image="https://cdn.shopify.com/s/files/1/2376/3301/products/emptystate-files.png"
                  >
                    <p>Try adjusting your search or filter to find what you're looking for.</p>
                    <Button primary onClick={() => {
                      setQuery('');
                      setStatusFilter('all');
                      setTypeFilter('all');
                    }}>
                      Clear all filters
                    </Button>
                  </EmptyState>
                )}
                
                {filteredContent.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Pagination
                      hasPrevious={page > 1}
                      hasNext={page < totalPages}
                      onPrevious={() => setPage(prev => Math.max(prev - 1, 1))}
                      onNext={() => setPage(prev => Math.min(prev + 1, totalPages))}
                      label={`Page ${page} of ${totalPages}`}
                    />
                  </div>
                )}
              </Stack>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default ContentList;
