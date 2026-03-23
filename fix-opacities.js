const fs = require('fs');
const path = require('path');

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
      
      // Fix bg-card/10 to 70 -> 80
      content = content.replace(/bg-card\/[1-7]0/g, 'bg-card/80');
      // Fix bg-secondary/10 to 70 -> 80
      content = content.replace(/bg-secondary\/[1-7]0/g, 'bg-secondary/80');
      // Fix bg-background/10 to 70 -> 80
      content = content.replace(/bg-background\/[1-7]0/g, 'bg-background/80');
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    processDirectory(dir);
  }
});

console.log('Opacities fixed globally.');
