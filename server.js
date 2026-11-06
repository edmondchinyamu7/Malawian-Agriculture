import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Serve static assets from project root
app.use(express.static(__dirname, { extensions: ['html'] }));

// Optional clean URL routing for pages
app.get('/:page', (req, res, next) => {
  const pagePath = path.join(__dirname, 'pages', `${req.params.page}.html`);
  if (fs.existsSync(pagePath)) {
    return res.sendFile(pagePath);
  }
  next();
});

// Route fallback to index.html. Never return HTML for missing static assets.
app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).type('text/plain').send('Requested file was not found.');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Malawian Agriculture Knowledge Hub running on http://${HOST}:${PORT}`);
});
