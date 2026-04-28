module.exports = {
  apps: [{
    name: 'shopify-webhooks',
    script: 'dist/app.js',
    instances: 'max',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
