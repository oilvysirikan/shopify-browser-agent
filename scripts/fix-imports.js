import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixImports(file) {
  const content = readFileSync(file, 'utf8');
  // Remove .ts extensions from imports
  const updatedContent = content.replace(/from\s+['"]([^'"]+)\.ts['"]/g, "from '$1'");
  
  if (content !== updatedContent) {
    writeFileSync(file, updatedContent, 'utf8');
    console.log(`Fixed imports in ${file}`);
  }
}

function processDirectory(directory) {
  const files = readdirSync(directory);

  for (const file of files) {
    const fullPath = join(directory, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && !['node_modules', 'dist'].includes(file)) {
      processDirectory(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fixImports(fullPath);
    }
  }
}

// Start processing from the src directory
console.log('Fixing TypeScript imports...');
processDirectory(join(dirname(__dirname), 'src'));
console.log('Import fixing completed!');
