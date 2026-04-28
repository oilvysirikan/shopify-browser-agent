import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { dirname, join, relative, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.json'];
const IGNORE_DIRS = ['node_modules', 'dist', '.git'];

async function fixFileImports(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    const fileDir = dirname(filePath);
    const fileExt = extname(filePath);

    // Handle import/export statements
    const importExportRegex = /(import|export)([\s\S]*?)from\s+['"]([^'"]+)['"]/g;
    
    let match;
    const importsToUpdate = [];
    
    // First, find all imports that need to be updated
    while ((match = importExportRegex.exec(content)) !== null) {
      const [fullMatch, type, imports, importPath] = match;
      
      // Skip if it's not a relative import or already has an extension
      if (!importPath.startsWith('.') || /\.[a-z0-9]+$/i.test(importPath)) {
        continue;
      }
      
      // Try to find the actual file
      let resolvedPath = null;
      
      // Check with each possible extension
      for (const ext of EXTENSIONS) {
        const testPath = resolve(fileDir, `${importPath}${ext}`);
        if (existsSync(testPath)) {
          resolvedPath = `${importPath}${ext}`;
          break;
        }
      }
      
      // If not found, try with /index
      if (!resolvedPath) {
        for (const ext of EXTENSIONS) {
          const testPath = resolve(fileDir, importPath, `index${ext}`);
          if (existsSync(testPath)) {
            resolvedPath = `${importPath}/index${ext}`;
            break;
          }
        }
      }
      
      if (resolvedPath) {
        importsToUpdate.push({
          original: fullMatch,
          updated: `${type}${imports}from '${resolvedPath}'`
        });
      }
    }
    
    // Update the content with fixed imports
    if (importsToUpdate.length > 0) {
      let newContent = content;
      for (const { original, updated } of importsToUpdate) {
        newContent = newContent.replace(original, updated);
      }
      
      if (newContent !== content) {
        writeFileSync(filePath, newContent, 'utf8');
        console.log(`Fixed imports in: ${relative(process.cwd(), filePath)}`);
        modified = true;
      }
    }
    
    return modified;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

async function processDirectory(directory) {
  try {
    const entries = readdirSync(directory);
    
    for (const entry of entries) {
      if (IGNORE_DIRS.includes(entry)) continue;
      
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        await processDirectory(fullPath);
      } else if (/\.(js|jsx|ts|tsx)$/.test(entry)) {
        await fixFileImports(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${directory}:`, error.message);
  }
}

// Start processing from the src directory
console.log('Starting to fix imports...');
processDirectory(resolve(__dirname, 'src'))
  .then(() => {
    console.log('Import fixing completed!');
  })
  .catch(error => {
    console.error('Error during import fixing:', error);
    process.exit(1);
  });
