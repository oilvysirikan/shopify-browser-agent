import React, { useState, useCallback } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  FormLayout, 
  TextField, 
  Select, 
  Button, 
  Stack, 
  Banner, 
  Spinner,
  Text,
  TextContainer,
  TextStyle,
  Checkbox,
  RangeSlider,
  Tabs,
  Icon,
  Toast,
  Frame,
  Collapsible
} from '@shopify/polaris';
import { 
  CirclePlusMinor, 
  CircleMinusMinor, 
  ClipboardMinor, 
  TickSmallMinor,
  PlusIcon,
  AddMajor
} from '@shopify/polaris-icons';

type ContentType = 'product_description' | 'blog_post' | 'email' | 'meta_description' | 'social_media' | 'ad_copy';
type Tone = 'professional' | 'friendly' | 'enthusiastic' | 'casual' | 'persuasive' | 'informative';
type AIModel = 'gpt-4' | 'gpt-3.5-turbo' | 'claude-2' | 'claude-instant';

const contentTypes = [
  { label: 'Product Description', value: 'product_description' },
  { label: 'Blog Post', value: 'blog_post' },
  { label: 'Email', value: 'email' },
  { label: 'Meta Description', value: 'meta_description' },
  { label: 'Social Media Post', value: 'social_media' },
  { label: 'Ad Copy', value: 'ad_copy' },
];

const tones = [
  { label: 'Professional', value: 'professional' },
  { label: 'Friendly', value: 'friendly' },
  { label: 'Enthusiastic', value: 'enthusiastic' },
  { label: 'Casual', value: 'casual' },
  { label: 'Persuasive', value: 'persuasive' },
  { label: 'Informative', value: 'informative' },
];

const aiModels = [
  { label: 'GPT-4', value: 'gpt-4' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { label: 'Claude 2', value: 'claude-2' },
  { label: 'Claude Instant', value: 'claude-instant' },
];

interface ContentVariation {
  id: string;
  content: string;
  isSelected: boolean;
}

const CONTENT_LENGTH_LABELS = {
  0: 'Short',
  50: 'Medium',
  100: 'Long',
  150: 'Very Long'
};

export function ContentGenerator() {
  // Form state
  const [contentType, setContentType] = useState<ContentType>('product_description');
  const [tone, setTone] = useState<Tone>('professional');
  const [aiModel, setAiModel] = useState<AIModel>('gpt-4');
  const [contentLength, setContentLength] = useState<number>(50);
  
  // Handle RangeSlider change with proper type
  const handleContentLengthChange = useCallback((value: number) => {
    setContentLength(value);
  }, []);
  const [keywords, setKeywords] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [productDetails, setProductDetails] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [includeSeo, setIncludeSeo] = useState(true);
  const [includeCallToAction, setIncludeCallToAction] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [variations, setVariations] = useState<ContentVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    advanced: false,
    preview: false
  });

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);
  
  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastActive(true);
    setTimeout(() => setToastActive(false), 3000);
  }, []);

  // Options for form fields
  const contentTypes: {label: string, value: ContentType}[] = [
    { label: 'Product Description', value: 'product_description' },
    { label: 'Blog Post', value: 'blog_post' },
    { label: 'Marketing Email', value: 'email' },
    { label: 'Meta Description', value: 'meta_description' },
    { label: 'Social Media Post', value: 'social_media' },
    { label: 'Ad Copy', value: 'ad_copy' },
  ];

  const tones: {label: string, value: Tone}[] = [
    { label: 'Professional', value: 'professional' },
    { label: 'Friendly', value: 'friendly' },
    { label: 'Enthusiastic', value: 'enthusiastic' },
    { label: 'Casual', value: 'casual' },
    { label: 'Persuasive', value: 'persuasive' },
    { label: 'Informative', value: 'informative' },
  ];

  const aiModels: {label: string, value: AIModel}[] = [
    { label: 'GPT-4 (Most Capable)', value: 'gpt-4' },
    { label: 'GPT-3.5 Turbo (Faster)', value: 'gpt-3.5-turbo' },
    { label: 'Claude 2 (Balanced)', value: 'claude-2' },
    { label: 'Claude Instant (Fastest)', value: 'claude-instant' },
  ];

  const generateContent = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!productDetails.trim()) {
      setError('Please provide product/content details');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    
    try {
      // Simulate API call with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate multiple variations
      const newVariations: ContentVariation[] = [];
      const variationCount = 3; // Generate 3 variations
      
      for (let i = 0; i < variationCount; i++) {
        const variationId = `var-${Date.now()}-${i}`;
        const variationTone = i === 0 ? tone : 
                            i === 1 ? 'persuasive' : 
                            'friendly';
        
        // More realistic mock content based on content type
        let mockContent = '';
        const productName = productDetails.split('\n')[0] || 'your product';
        
        switch(contentType) {
          case 'product_description':
            mockContent = `Introducing our premium ${productName}. ${productDetails}\n\n` +
              `Crafted with attention to detail, this ${productName.toLowerCase()} is perfect for ${targetAudience || 'our valued customers'}. ` +
              `With features like ${keywords || 'high-quality materials and expert craftsmanship'}, it's designed to impress.`;
            break;
            
          case 'blog_post':
            mockContent = `# The Ultimate Guide to ${productName}\n\n` +
              `${productDetails}\n\n` +
              `## Why ${productName} Matters\n` +
              `In today's market, ${productName.toLowerCase()} plays a crucial role. Whether you're a ${targetAudience || 'seasoned professional'}, ` +
              `understanding ${keywords || 'the latest trends and features'} can give you an edge.`;
            break;
            
          case 'email':
            mockContent = `Subject: ${tone === 'persuasive' ? '🚀 Exclusive Offer: ' : ''}Discover ${productName}\n\n` +
              `Hi there,\n\n` +
              `We're excited to introduce you to ${productName}! ${productDetails}\n\n` +
              `${includeCallToAction ? '👉 [Shop Now](#) | [Learn More](#)' : ''}\n\n` +
              `Best regards,\nThe Team`;
            break;
            
          default:
            mockContent = `This is a ${tone} ${contentType.replace('_', ' ')} ` +
              `for ${productName}. ${productDetails}. ` +
              `Targeting: ${targetAudience || 'general audience'}. ` +
              `Keywords: ${keywords || 'not specified'}.`;
        }
        
        // Adjust length based on slider
        const targetLength = contentLength * 5 + 100; // Scale to reasonable length
        mockContent = mockContent.slice(0, targetLength);
        
        newVariations.push({
          id: variationId,
          content: mockContent,
          isSelected: i === 0 // Select first variation by default
        });
      }
      
      setVariations(newVariations);
      if (newVariations.length > 0) {
        setSelectedVariation(newVariations[0].id);
      }
      
      setActiveTab(1); // Switch to variations tab
      showToast('Content generated successfully!');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate content';
      setError(`Error: ${errorMessage}`);
      console.error('Generation error:', err);
      showToast('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [contentType, tone, productDetails, targetAudience, keywords, contentLength, includeCallToAction]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateContent();
  };

  const handleSave = useCallback((content: string) => {
    // In a real app, this would save to your backend
    console.log('Saving content to library:', content);
    showToast('Content saved to library!');
  }, []);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard!');
  }, []);
  
  const handleRegenerate = useCallback(() => {
    // Clear previous variations and regenerate
    setVariations([]);
    setSelectedVariation(null);
    generateContent();
  }, [generateContent]);
  
  const selectVariation = useCallback((id: string) => {
    setSelectedVariation(id);
    setVariations(prev => 
      prev.map(v => ({
        ...v,
        isSelected: v.id === id
      }))
    );
  }, []);
  
  const selectedContent = variations.find(v => v.id === selectedVariation)?.content || '';

  // Toast markup
  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={() => setToastActive(false)} />
  ) : null;

  return (
    <Frame>
      <Page
        title="AI Content Generator"
        primaryAction={{
        content: 'Generate Content',
        onAction: () => generateContent(),
        disabled: isGenerating || !productDetails.trim(),
        loading: isGenerating,
        icon: AddMajor,
        }}
        secondaryActions={[
          {
            content: 'Save to Library',
            onAction: () => selectedContent && handleSave(selectedContent),
            disabled: !selectedVariation,
          },
          {
            content: 'Copy to Clipboard',
            onAction: () => selectedContent && handleCopy(selectedContent),
            disabled: !selectedVariation,
          },
        ]}
        breadcrumbs={[{ content: 'Dashboard', url: '/' }]}
      >
        <Layout>
        <Layout.Section>
          <Card sectioned>
            <Tabs
              tabs={[
                { id: 'generator', content: 'Content Generator' },
                { id: 'variations', content: 'Variations' },
              ]}
              selected={activeTab}
              onSelect={(selectedTabIndex) => setActiveTab(selectedTabIndex)}
            >
              {activeTab === 0 ? (
                <form onSubmit={handleSubmit}>
                  <FormLayout>
                <Select
                  label="Content Type"
                  options={contentTypes}
                  onChange={(value) => setContentType(value as ContentType)}
                  value={contentType}
                />
                
                <Select
                  label="Tone"
                  options={tones}
                  onChange={(value) => setTone(value as Tone)}
                  value={tone}
                />
                
                <TextField
                  label="Product/Content Details"
                  value={productDetails}
                  onChange={setProductDetails}
                  multiline={3}
                  autoComplete="off"
                  helpText="Provide details about the product or content you want to generate"
                />
                
                <TextField
                  label="Target Audience"
                  value={targetAudience}
                  onChange={setTargetAudience}
                  autoComplete="off"
                  helpText="Who is this content for?"
                />
                
                <TextField
                  label="Keywords (comma-separated)"
                  value={keywords}
                  onChange={setKeywords}
                  autoComplete="off"
                  helpText="Keywords to include for SEO"
                />
                
                    <FormLayout.Group>
                      <Select
                        label="AI Model"
                        options={aiModels}
                        onChange={(value) => setAiModel(value as AIModel)}
                        value={aiModel}
                        helpText="Choose the AI model to use for generation"
                      />
                      
                      <div style={{ paddingTop: '8px' }}>
                        <Text as="p" variant="bodyMd" color="subdued">
                          Content Length: {CONTENT_LENGTH_LABELS[contentLength as keyof typeof CONTENT_LENGTH_LABELS] || 'Custom'}
                        </Text>
                        <RangeSlider
                          output
                          label=""
                          min={0}
                          max={150}
                          step={50}
                          value={contentLength}
                          onChange={handleContentLengthChange}
                        />
                        <div style={{ textAlign: 'right', marginTop: '4px' }}>
                          <Text as="span" variant="bodySm" color="subdued">
                            {contentLength}%
                          </Text>
                        </div>
                      </div>
                    </FormLayout.Group>
                    
                    <Checkbox
                      label="Optimize for SEO"
                      checked={includeSeo}
                      onChange={(checked) => setIncludeSeo(checked)}
                    />
                    
                    <Checkbox
                      label="Include Call-to-Action"
                      checked={includeCallToAction}
                      onChange={(checked) => setIncludeCallToAction(checked)}
                    />
                    
                    <Collapsible
                      open={expandedSections.advanced}
                      id="advanced-options"
                      transition={{ duration: '150ms', timingFunction: 'ease' }}
                      expandOnPrint
                    >
                      <div style={{ marginTop: '16px' }}>
                        <TextField
                          label="Custom Instructions"
                          value={customInstructions}
                          onChange={setCustomInstructions}
                          multiline={3}
                          autoComplete="off"
                          placeholder="Add any specific instructions or requirements for the AI..."
                        />
                      </div>
                    </Collapsible>
                    
                    <Button 
                      onClick={() => toggleSection('advanced')} 
                      plain
                      size="slim"
                      icon={expandedSections.advanced ? CircleMinusMinor : CirclePlusMinor}
                    >
                      {expandedSections.advanced ? 'Hide' : 'Show'} Advanced Options
                    </Button>
                  </FormLayout>
                </form>
              ) : (
                <div style={{ minHeight: '300px' }}>
                  {isGenerating ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                      <Spinner accessibilityLabel="Generating content" size="large" />
                      <p>Generating your content variations...</p>
                    </div>
                  ) : variations.length > 0 ? (
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      {/* Variations sidebar */}
                      <div style={{ width: '250px', flexShrink: 0 }}>
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Variations</h3>
                          <Button size="slim" onClick={handleRegenerate} disabled={isGenerating}>
                            Regenerate All
                          </Button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {variations.map((variation, index) => (
                            <div 
                              key={variation.id}
                              onClick={() => selectVariation(variation.id)}
                              style={{
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: `1px solid ${variation.id === selectedVariation ? '#5c6ac4' : '#dfe3e8'}`,
                                backgroundColor: variation.id === selectedVariation ? '#f4f5fa' : 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {variation.isSelected && <Icon source={TickSmallMinor} color="success" />}
                                <span style={{ 
                                  fontWeight: variation.isSelected ? 600 : 400,
                                  fontSize: '0.9375rem'
                                }}>
                                  Variation {index + 1}
                                </span>
                              </div>
                              <div style={{ marginTop: '0.25rem' }}>
                                <p style={{
                                  color: 'var(--p-color-text-subdued)',
                                  fontSize: '0.8125rem',
                                  margin: '4px 0 0',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {variation.content.substring(0, 60)}...
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Main content preview */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          backgroundColor: 'white',
                          borderRadius: '0.5rem',
                          border: '1px solid #dfe3e8',
                          padding: '1.5rem',
                          minHeight: '400px',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'break-word'
                        }}>
                          {selectedContent ? (
                            <div>
                              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <Button size="slim" onClick={() => handleCopy(selectedContent)}>
                                  <Icon source={ClipboardMinor} />
                                </Button>
                                <Button size="slim" onClick={() => handleSave(selectedContent)}>
                                  Save
                                </Button>
                              </div>
                              
                              <div style={{ lineHeight: '1.6' }}>
                                {selectedContent.split('\n').map((paragraph, i) => 
                                  paragraph ? <p key={i} style={{ marginBottom: '1em' }}>{paragraph}</p> : <br key={i} />
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ 
                              height: '100%', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              color: '#637381',
                              textAlign: 'center',
                              padding: '2rem'
                            }}>
                              <div>
                                <p>Select a variation to preview the generated content</p>
                                <p><small>Or go back to generate new content</small></p>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {selectedContent && (
                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{
                                color: 'var(--p-color-text-subdued)',
                                fontSize: '0.8125rem'
                              }}>
                                {selectedContent.length} characters • {selectedContent.split(/\s+/).length} words
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button size="slim" onClick={handleRegenerate} disabled={isGenerating}>
                                Regenerate
                              </Button>
                              <Button size="slim" primary onClick={() => handleSave(selectedContent)}>
                                Save to Library
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      height: '300px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      textAlign: 'center',
                      color: '#637381'
                    }}>
                      <p>No variations generated yet.</p>
                      <p>Go to the "Content Generator" tab to create some!</p>
                      <div style={{ marginTop: '1rem' }}>
                        <Button onClick={() => setActiveTab(0)}>Go to Generator</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Tabs>
            
            {error && (
              <div style={{ marginTop: '1.5rem' }}>
                <Banner status="critical" onDismiss={() => setError('')}>
                  <p>{error}</p>
                </Banner>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>
      {toastMarkup}
    </Page>
    </Frame>
  );
}

export default ContentGenerator;
