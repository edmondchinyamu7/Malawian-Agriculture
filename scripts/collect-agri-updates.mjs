import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'data', 'agri-updates.json');
const MAX_AGE_DAYS = 90;
const FEEDS = [
  { name: 'IFPRI Malawi', url: 'https://massp.ifpri.info/feed/' },
  { name: 'Malawi24', url: 'https://malawi24.com/feed/' }
];
const AGRICULTURE_TERMS = /\b(agricultur|farm|farmer|maize|corn|fertili[sz]er|seed|crop|livestock|cattle|goat|poultry|irrigat|harvest|food security|market price|weather|rainfall|drought|flood|fisp|aip|agribusiness|fisher|aquaculture|soil|pest|disease)\b/i;

function cleanText(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function readTag(xml, tag) {
  const match = xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? cleanText(match[1]) : '';
}

function categoryFor(text) {
  const value = text.toLowerCase();
  if (/price|market|trade|commodity/.test(value)) return 'Markets & prices';
  if (/weather|rain|drought|flood|el niño|climate/.test(value)) return 'Weather & climate';
  if (/fertili[sz]er|seed|input|fisp|aip/.test(value)) return 'Farm inputs';
  if (/livestock|cattle|goat|poultry|fish|aquaculture/.test(value)) return 'Livestock & fisheries';
  if (/pest|disease|crop protection/.test(value)) return 'Crop health';
  if (/programme|fund|loan|opportunit|support/.test(value)) return 'Programmes & opportunities';
  return 'Agriculture news';
}

async function collectFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { 'user-agent': 'Ulimi-wa-Malawi-Agriculture-News-Bot/1.0', accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(feed.name + ' feed returned HTTP ' + response.status);
  const xml = await response.text();
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => match[1]);
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;

  return items.map(item => {
    const title = readTag(item, 'title');
    const summary = readTag(item, 'description') || readTag(item, 'content:encoded');
    const link = readTag(item, 'link') || readTag(item, 'guid');
    const dateText = readTag(item, 'pubDate') || readTag(item, 'dc:date');
    const timestamp = Date.parse(dateText);
    if (!title || !link || !/^https?:\/\//i.test(link)) return null;
    if (!AGRICULTURE_TERMS.test(title + ' ' + summary)) return null;
    if (Number.isFinite(timestamp) && timestamp < cutoff) return null;
    return {
      title: title.slice(0, 220),
      summary: summary.slice(0, 520),
      source: feed.name,
      sourceUrl: link,
      publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
      category: categoryFor(title + ' ' + summary)
    };
  }).filter(Boolean);
}

const current = JSON.parse(await fs.readFile(OUTPUT, 'utf8').catch(() => '{"updatedAt":null,"items":[]}'));
const byUrl = new Map((current.items || []).map(item => [item.sourceUrl, item]));
let collected = 0;
const errors = [];

for (const feed of FEEDS) {
  try {
    const entries = await collectFeed(feed);
    for (const entry of entries) {
      if (!byUrl.has(entry.sourceUrl)) {
        byUrl.set(entry.sourceUrl, { ...entry, reviewStatus: 'pending' });
        collected++;
      }
    }
  } catch (error) {
    errors.push(feed.name + ': ' + error.message);
  }
}

const items = [...byUrl.values()]
  .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
  .slice(0, 100);

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(OUTPUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  collectionFrequency: 'daily',
  reviewPolicy: 'Newly collected articles are pending review. Merge the daily update pull request only after checking the original source.',
  feedsChecked: FEEDS.map(feed => feed.name),
  feedErrors: errors,
  newCandidates: collected,
  items
}, null, 2) + '\n');

console.log('Agriculture update collection complete. New review candidates: ' + collected);
if (errors.length) console.warn('Some feeds were unavailable:', errors.join(' | '));
