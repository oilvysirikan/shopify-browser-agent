import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.env;
const indexPath = path.join(__dirname, '../dist/frontend/src/frontend/index.html');

async function replaceEnvVariables() {
  try {
    // Read the index.html file
    const data = await readFile(indexPath, 'utf8');
    
    // Replace environment variables
    let result = data;
    result = result.replace(/\$\{process\.env\.([^}]+)\}/g, (match, p1) => {
      return env[p1] || '';
    });

    // Write the updated file
    await writeFile(indexPath, result, 'utf8');
    console.log('Successfully updated environment variables in index.html');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

replaceEnvVariables();
