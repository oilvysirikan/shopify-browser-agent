import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Shopify AI Assistant is running' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
