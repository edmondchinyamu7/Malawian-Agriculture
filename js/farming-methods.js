/**
 * Ulimi wa Malawi | Farming Methods & Practices System
 */
import { escapeHtml, openModal, bookmarks } from './main.js';

let farmingData = [];
let activeCategory = 'Zonse';
const categories = ['Zonse', 'Chakudya', 'Zamalonda', 'Zamakono', 'Zachikhalidwe'];

export async function loadFarmingData() {
  try {
    // Resolve relative path depending on current location
    const basePath = window.location.pathname.includes('/pages/') ? '../data/' : 'data/';
    const response = await fetch(`${basePath}farming-guides.json`);
    if (!response.ok) throw new Error('Failed to load farming guides');
    farmingData = await response.json();
    renderCategories();
    renderFarmingCards();
  } catch (err) {
    console.error('Error loading farming data:', err);
  }
}

export function renderCategories() {
  const container = document.getElementById('filters');
  if (!container) return;

  container.innerHTML = categories.map(cat => `
    <button class="filter ${cat === activeCategory ? 'active' : ''}" data-category="${escapeHtml(cat)}">
      ${cat === 'Zonse' ? 'All topics' : escapeHtml(cat)}
    </button>
  `).join('');
}

export function renderFarmingCards() {
  const container = document.getElementById('cards');
  const searchInput = document.getElementById('search');
  const resultCount = document.getElementById('resultCount');
  const methodCount = document.getElementById('methodCount');

  if (!container) return;

  const query = (searchInput?.value || '').trim().toLowerCase();
  const filtered = farmingData.filter(item => {
    const matchCat = activeCategory === 'Zonse' || item.category === activeCategory;
    const matchQuery = !query || [
      item.nameCh,
      item.nameEn,
      item.desc,
      item.full || '',
      ...(item.zitsanzo || []),
      ...(item.mfundo || [])
    ].join(' ').toLowerCase().includes(query);
    return matchCat && matchQuery;
  });

  if (resultCount) {
    resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'topic' : 'topics'}`;
  }
  if (methodCount) {
    methodCount.textContent = farmingData.length;
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty">
        <strong>No matching farming topics found.</strong><br>
        Try another search word or switch topic categories.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isSaved = bookmarks.has(item.id);
    return `
      <article class="farm-card" tabindex="0" role="button" data-id="${item.id}" aria-label="Read ${escapeHtml(item.nameEn)}">
        <div class="card-top">
          <div class="crop-icon">${item.emoji}</div>
          <span class="category">${escapeHtml(item.category)}</span>
        </div>
        <h3>${escapeHtml(item.nameCh)}</h3>
        <div class="english">${escapeHtml(item.nameEn)}</div>
        <p class="desc">${escapeHtml(item.desc)}</p>
        <div class="tags">
          ${(item.zitsanzo || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="card-foot">
          <span>Read full guide →</span>
          <button class="save ${isSaved ? 'saved' : ''}" data-save="${item.id}" aria-label="${isSaved ? 'Remove saved topic' : 'Save topic'}">
            ${isSaved ? '★' : '☆'}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

export function openFarmingDetails(id) {
  const item = farmingData.find(x => x.id === Number(id));
  if (!item) return;

  const bodyHtml = `
    <p>${escapeHtml(item.desc)}</p>
    <p>${escapeHtml(item.full || '')}</p>
    <h3>Key points / Mfundo zazikulu</h3>
    <ul>
      ${(item.mfundo || []).map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
    </ul>
    <h3>Where it may be suitable in Malawi</h3>
    <p>${escapeHtml(item.bwino || 'Confirm local suitability with an agricultural extension worker.')}</p>
    <h3>Examples / Zitsanzo</h3>
    <p>${(item.zitsanzo || []).map(escapeHtml).join(' • ')}</p>
    <div class="modal-grid">
      <div class="modal-box">
        <h4>Advantages / Ubwino</h4>
        <ul>
          ${(item.ubwino || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
      <div class="modal-box">
        <h4>Challenges / Zovuta</h4>
        <ul>
          ${(item.vuto || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
    </div>
    <p style="font-size:11px;color:#718078;margin-top:18px">
      Use this as learning material and confirm technical decisions with a local agricultural extension worker.
    </p>
  `;

  openModal({
    title: `${item.emoji} ${item.nameCh}`,
    subtitle: `${item.nameEn} • ${item.category}`,
    bodyHtml
  });
}

export function initFarmingMethods() {
  const filterWrap = document.getElementById('filters');
  const searchInput = document.getElementById('search');
  const cardsWrap = document.getElementById('cards');

  if (filterWrap) {
    filterWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (!btn) return;
      activeCategory = btn.dataset.category;
      renderCategories();
      renderFarmingCards();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderFarmingCards);
  }

  if (cardsWrap) {
    cardsWrap.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('[data-save]');
      if (saveBtn) {
        e.stopPropagation();
        const id = Number(saveBtn.dataset.save);
        bookmarks.toggle(id);
        renderFarmingCards();
        return;
      }
      const card = e.target.closest('[data-id]');
      if (card) {
        openFarmingDetails(card.dataset.id);
      }
    });

    cardsWrap.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) {
        e.preventDefault();
        openFarmingDetails(e.target.dataset.id);
      }
    });
  }

  if (cardsWrap) {
    loadFarmingData();
  }
}

document.addEventListener('DOMContentLoaded', initFarmingMethods);
