/**
 * Ulimi wa Malawi | Farming Methods & Practices System
 * Full Bilingual (Chichewa default / English) Support
 */
import { escapeHtml, openModal, bookmarks } from './main.js';
import { getCurrentLang } from './i18n.js';

let farmingData = [];
let activeCategory = 'Zonse';

const categoryMeta = [
  { id: 'Zonse', ny: 'Mitu yonse', en: 'All topics' },
  { id: 'Chakudya', ny: 'Chakudya', en: 'Food-focused' },
  { id: 'Zamalonda', ny: 'Zamalonda', en: 'Commercial' },
  { id: 'Zamakono', ny: 'Zamakono', en: 'Modern & Smart' },
  { id: 'Zachikhalidwe', ny: 'Zachikhalidwe', en: 'Traditional' }
];

export async function loadFarmingData() {
  try {
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

  const lang = getCurrentLang();

  container.innerHTML = categoryMeta.map(cat => {
    const label = lang === 'ny' ? cat.ny : cat.en;
    const isActive = cat.id === activeCategory;
    return `
      <button class="filter ${isActive ? 'active' : ''}" data-category="${escapeHtml(cat.id)}">
        ${escapeHtml(label)}
      </button>
    `;
  }).join('');
}

export function renderFarmingCards() {
  const container = document.getElementById('cards');
  const searchInput = document.getElementById('search');
  const resultCount = document.getElementById('resultCount');
  const methodCount = document.getElementById('methodCount');

  if (!container) return;

  const lang = getCurrentLang();
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
    if (lang === 'ny') {
      resultCount.textContent = `Mitu ${filtered.length}`;
    } else {
      resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'topic' : 'topics'}`;
    }
  }
  if (methodCount) {
    methodCount.textContent = farmingData.length;
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty">
        <strong>${lang === 'ny' ? 'Palibe njira yolimira yomwe yapezeka.' : 'No matching farming topics found.'}</strong><br>
        ${lang === 'ny' ? 'Yesani kufunafuna mawu ena kapena sankhani mitu yonse.' : 'Try another search word or switch topic categories.'}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isSaved = bookmarks.has(item.id);
    const title = lang === 'ny' ? item.nameCh : item.nameEn;
    const subTitle = lang === 'ny' ? item.nameEn : item.nameCh;
    const catMeta = categoryMeta.find(c => c.id === item.category);
    const catLabel = lang === 'ny' ? (catMeta?.ny || item.category) : (catMeta?.en || item.category);
    const readText = lang === 'ny' ? 'Werengani zonse →' : 'Read full guide →';

    return `
      <article class="farm-card" tabindex="0" role="button" data-id="${item.id}" aria-label="${escapeHtml(title)}">
        <div class="card-top">
          <div class="crop-icon">${item.emoji}</div>
          <span class="category">${escapeHtml(catLabel)}</span>
        </div>
        <h3>${escapeHtml(title)}</h3>
        <div class="english">${escapeHtml(subTitle)}</div>
        <p class="desc">${escapeHtml(item.desc)}</p>
        <div class="tags">
          ${(item.zitsanzo || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="card-foot">
          <span>${escapeHtml(readText)}</span>
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

  const lang = getCurrentLang();
  const catMeta = categoryMeta.find(c => c.id === item.category);
  const catLabel = lang === 'ny' ? (catMeta?.ny || item.category) : (catMeta?.en || item.category);
  const title = lang === 'ny' ? item.nameCh : item.nameEn;
  const subtitle = lang === 'ny' ? `${item.nameEn} • ${catLabel}` : `${item.nameCh} • ${catLabel}`;

  const bodyHtml = lang === 'ny' ? `
    <p>${escapeHtml(item.desc)}</p>
    <p>${escapeHtml(item.full || '')}</p>
    <h3>Mfundo zazikulu zoyenera kuzidziwa</h3>
    <ul>
      ${(item.mfundo || []).map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
    </ul>
    <h3>Madera oyenera ku Malawi</h3>
    <p>${escapeHtml(item.bwino || 'Tsimikizirani ndi mlangizi wazaulimi wa m’dera lanu.')}</p>
    <h3>Zitsanzo za mbewu ndi mchitidwe</h3>
    <p>${(item.zitsanzo || []).map(escapeHtml).join(' • ')}</p>
    <div class="modal-grid">
      <div class="modal-box">
        <h4>Ubwino wa njirayi</h4>
        <ul>
          ${(item.ubwino || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
      <div class="modal-box">
        <h4>Zovuta zake</h4>
        <ul>
          ${(item.vuto || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
    </div>
    <p style="font-size:11px;color:#718078;margin-top:18px">
      Gwiritsani ntchito malangizowa ngati phunziro ndipo funsani mlangizi wa zaulimi (AEDO) musanapange zigamulo zikuluzikulu m’munda.
    </p>
  ` : `
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
    title: `${item.emoji} ${title}`,
    subtitle,
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

    loadFarmingData();
  }

  // Listen to language switch event
  window.addEventListener('languageChanged', () => {
    renderCategories();
    renderFarmingCards();
  });
}

document.addEventListener('DOMContentLoaded', initFarmingMethods);
