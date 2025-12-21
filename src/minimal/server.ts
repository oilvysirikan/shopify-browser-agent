import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Shopify AI Assistant is running',
    healthCheck: 'Visit /health for service status'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Health check available at: http://localhost:${port}/health`);
});
