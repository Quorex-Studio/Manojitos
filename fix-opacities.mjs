import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directories = [
  path.join(__dirname, 'src', 'pages'),
  path.join(__dirname, 'src', 'components')
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (stat.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let modified = false;
      const original = content;

      content = content.replace(/bg-card\/[1-7]0/g, 'bg-card/80');
      content = content.replace(/bg-secondary\/[1-7]0/g, 'bg-secondary/80');
      content = content.replace(/bg-background\/[1-7]0/g, 'bg-background/80');
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    processDirectory(dir);
  }
});

console.log('Opacities fixed globally.');
