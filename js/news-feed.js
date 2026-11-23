const DATA_URL = '../data/agri-updates.json';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  if (!value) return 'Date not supplied';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not supplied';
  return new Intl.DateTimeFormat('en-MW', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function renderNews(items) {
  const container = document.getElementById('agriNewsFeed');
  const updated = document.getElementById('agriNewsUpdated');
  if (!container) return;

  const approved = (items || []).filter(item => item.reviewStatus === 'approved' && item.title && item.sourceUrl);
  container.replaceChildren();

  if (!approved.length) {
    container.append(element('p', 'agri-feed-empty', 'No newly approved updates are available yet. Please check again later.'));
    return;
  }

  approved.slice(0, 8).forEach(item => {
    const card = element('article', 'agri-feed-card');
    const meta = element('div', 'agri-feed-meta');
    meta.append(element('span', 'agri-feed-category', item.category || 'Agriculture news'));
    meta.append(element('time', 'agri-feed-date', formatDate(item.publishedAt)));
    const title = element('h3', '', item.title);
    const summary = element('p', '', item.summary || 'Open the original source for the full update.');
    const footer = element('div', 'agri-feed-footer');
    footer.append(element('span', 'agri-feed-source', item.source || 'Source not specified'));
    const link = element('a', 'agri-feed-link', 'Read original report ↗');
    link.href = item.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    footer.append(link);
    card.append(meta, title, summary, footer);
    container.append(card);
  });

  if (updated) updated.textContent = 'Approved updates • last collection check ' + formatDate(window.agriUpdatesLastChecked);
}

async function loadAgriNews() {
  const container = document.getElementById('agriNewsFeed');
  if (!container) return;
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('News feed request failed');
    const data = await response.json();
    window.agriUpdatesLastChecked = data.updatedAt;
    renderNews(data.items);
  } catch (error) {
    console.warn('Agriculture news feed unavailable:', error);
    container.replaceChildren(element('p', 'agri-feed-empty', 'The latest update feed is temporarily unavailable. Existing news below is still available.'));
  }
}

loadAgriNews();
