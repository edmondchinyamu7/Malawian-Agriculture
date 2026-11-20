import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const PROTECTED_ADMIN_PAGES = new Set(['admin.html', 'admin-finance.html']);
const ROOT_HTML_FILES = ['index.html', 'login.html', 'modules.html', 'profile.html', 'reset-password.html'];
const SYNC_DIRS = ['assets', 'css', 'data', 'js', 'partials'];
const UNSAFE_PUBLIC_PATHS = [
  'admin-login.html',
  'vercel.json',
  '.env.example',
  'api',
  path.join('pages', 'admin.html'),
  path.join('pages', 'admin-finance.html')
];

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.mkdirSync(PUBLIC, { recursive: true });

// Remove files that must never be exposed statically from public/
for (const relPath of UNSAFE_PUBLIC_PATHS) {
  const fullPath = path.join(PUBLIC, relPath);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

// Sync root HTML entry points
let syncedFiles = 0;
for (const file of ROOT_HTML_FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(PUBLIC, file));
    syncedFiles++;
  }
}

// Sync public static asset/code directories
for (const dir of SYNC_DIRS) {
  copyRecursive(path.join(ROOT, dir), path.join(PUBLIC, dir));
}

// Sync non-admin pages into public/pages/
const pagesSrc = path.join(ROOT, 'pages');
const pagesDest = path.join(PUBLIC, 'pages');
fs.mkdirSync(pagesDest, { recursive: true });
if (fs.existsSync(pagesSrc)) {
  for (const entry of fs.readdirSync(pagesSrc, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (PROTECTED_ADMIN_PAGES.has(entry.name)) continue;
    fs.copyFileSync(path.join(pagesSrc, entry.name), path.join(pagesDest, entry.name));
    syncedFiles++;
  }
}

console.log(`Build complete: synced ${syncedFiles} HTML files and static assets to public/ (protected admin pages excluded).`);
