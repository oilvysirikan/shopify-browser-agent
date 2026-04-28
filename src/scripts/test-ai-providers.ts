import { AIServiceFactory, type AIGenerationOptions } from '../services/ai.service.js';
import { logger } from '../utils/logger.js';
import { trackAIMetrics } from '../monitoring/dashboard.js';
import { config } from '../config/index.js';

// Test prompts for different scenarios
const TEST_PROMPTS = [
  'Explain quantum computing in simple terms',
  'Write a short poem about artificial intelligence',
  'What are the main benefits of TypeScript?',
  'Generate a list of 5 ideas for a new mobile app',
  'Explain the concept of blockchain technology'
];

// AI providers to test
const PROVIDERS = ['openai', 'anthropic', 'cohere', 'mistral'] as const;

type ProviderType = typeof PROVIDERS[number];

// Test configuration
const TEST_CONFIG = {
  maxTokens: 300,
  temperature: 0.7,
  numIterations: 3
};

// Track test results
const results: Record<ProviderType, {
  success: number;
  failures: number;
  totalTime: number;
  avgResponseTime: number;
  errors: Array<{ prompt: string; error: string }>;
}> = {
  openai: { success: 0, failures: 0, totalTime: 0, avgResponseTime: 0, errors: [] },
  anthropic: { success: 0, failures: 0, totalTime: 0, avgResponseTime: 0, errors: [] },
  cohere: { success: 0, failures: 0, totalTime: 0, avgResponseTime: 0, errors: [] },
  mistral: { success: 0, failures: 0, totalTime: 0, avgResponseTime: 0, errors: [] }
};

// Function to test a single provider
async function testProvider(provider: ProviderType) {
  logger.info(`\n=== Testing ${provider.toUpperCase()} ===`);
  
  for (let i = 0; i < TEST_CONFIG.numIterations; i++) {
    const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
    
    try {
      const startTime = Date.now();
      const result = await trackAIMetrics(provider)(prompt, {
        maxTokens: TEST_CONFIG.maxTokens,
        temperature: TEST_CONFIG.temperature,
        model: getModelForProvider(provider)
      });
      
      const duration = Date.now() - startTime;
      results[provider].success++;
      results[provider].totalTime += duration;
      results[provider].avgResponseTime = results[provider].totalTime / results[provider].success;
      
      logger.info(`✅ [${provider.toUpperCase()}] Success (${duration}ms) - Prompt: ${truncate(prompt, 50)}`);
      logger.debug(`Response: ${truncate(result, 100)}`);
      
      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results[provider].failures++;
      results[provider].errors.push({ prompt, error: errorMessage });
      
      logger.error(`❌ [${provider.toUpperCase()}] Failed - ${errorMessage}`);
      logger.debug(`Failed prompt: ${prompt}`);
      
      // Add a small delay before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Helper function to get the appropriate model for each provider
function getModelForProvider(provider: ProviderType): string {
  switch (provider) {
    case 'openai':
      return config.ai.openai.model;
    case 'anthropic':
      return config.ai.anthropic.model;
    case 'cohere':
      return config.ai.cohere.model;
    case 'mistral':
      return config.ai.mistral.model;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Helper function to truncate long strings
function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

// Main function to run all tests
async function runTests() {
  logger.info('Starting AI Provider Tests');
  logger.info('=========================');
  
  // Test each provider
  for (const provider of PROVIDERS) {
    await testProvider(provider);
  }
  
  // Print summary
  logger.info('\n=== Test Summary ===');
  for (const provider of PROVIDERS) {
    const result = results[provider];
    const totalTests = result.success + result.failures;
    const successRate = totalTests > 0 
      ? (result.success / totalTests * 100).toFixed(1) + '%'
      : '0%';
    
    logger.info(`\n${provider.toUpperCase()} Results:`);
    logger.info(`✅ Success: ${result.success}`);
    logger.info(`❌ Failures: ${result.failures}`);
    logger.info(`📊 Success Rate: ${successRate}`);
    logger.info(`⏱️  Avg. Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
    
    if (result.errors.length > 0) {
      logger.warn('\nErrors encountered:');
      result.errors.forEach((err, i) => {
        logger.warn(`${i + 1}. Prompt: ${err.prompt}`);
        logger.warn(`   Error: ${err.error}\n`);
      });
    }
  }
  
  // Save detailed results to a file
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const resultsDir = path.join(__dirname, '..', '..', 'test-results');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(resultsDir, `ai-test-${timestamp}.json`);
    
    await fs.mkdir(resultsDir, { recursive: true });
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    
    logger.info(`\nDetailed test results saved to: ${filename}`);
  } catch (error) {
    logger.error('Failed to save test results:', error);
  }
  
  process.exit(0);
}

// Run the tests
runTests().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});
