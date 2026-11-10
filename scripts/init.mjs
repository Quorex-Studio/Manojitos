import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tempDir = path.join(root, '.tmp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
