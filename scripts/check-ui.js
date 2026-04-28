import { chromium } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkUI() {
  // Start the development server
  console.log('Starting development server...');
  const serverProcess = exec('npm run dev');
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Launch the browser
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the app
    console.log('Navigating to the app...');
    await page.goto('http://localhost:5173');
    
    // Wait for the app to load (adjust the selector based on your app)
    await page.waitForSelector('#app', { timeout: 30000 });
    console.log('✅ App loaded successfully!');
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'ui-verification.png' });
    console.log('Screenshot saved as ui-verification.png');
    
  } catch (error) {
    console.error('❌ Error loading the app:', error);
    await page.screenshot({ path: 'ui-error.png' });
    console.log('Screenshot of the error saved as ui-error.png');
  } finally {
    // Close the browser
    await browser.close();
    
    // Kill the server process
    serverProcess.kill();
    console.log('Development server stopped.');
  }
}

checkUI().catch(console.error);
