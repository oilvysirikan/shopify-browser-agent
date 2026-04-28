// Initialize Shopify App Bridge
const app = window.shopifyApp;
const { TitleBar, Button, Page } = window['@shopify/polaris'];

// Basic app initialization
document.addEventListener('DOMContentLoaded', () => {
  // Your app initialization code will go here
  console.log('Shopify Browser Agent is running!');
  
  // Example of using Polaris components
  const appElement = document.getElementById('app');
  
  // Simple UI using Polaris components
  const page = document.createElement('div');
  page.innerHTML = `
    <div class="Polaris-Page">
      <div class="Polaris-Page-Header">
        <div class="Polaris-Page-Header__MainContent">
          <div class="Polaris-Header-Title">
            <h1 class="Polaris-DisplayText">Welcome to Shopify Browser Agent</h1>
          </div>
        </div>
      </div>
      <div class="Polaris-Page-Content">
        <div class="Polaris-Card">
          <div class="Polaris-Card__Section">
            <p>Your app is successfully installed and running! 🎉</p>
            <p>Start building your app's interface here.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  appElement.innerHTML = '';
  appElement.appendChild(page);
});
