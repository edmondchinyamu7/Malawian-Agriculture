/**
 * Ulimi wa Malawi | V7 Advanced Crop Library Controller
 */
import { escapeHtml, openModal } from './main.js';

let cropData = [];
let activeCropGroup = 'All crops';
const cropGroups = ['All crops', 'Cereals', 'Legumes', 'Root crops', 'Vegetables', 'Cash crops'];

export async function loadCropData() {
  try {
    const basePath = window.location.pathname.includes('/pages/') ? '../data/' : 'data/';
    const response = await fetch(`${basePath}crops.json`);
    if (!response.ok) throw new Error('Failed to load crop data');
    cropData = await response.json();
    renderCropFilters();
    renderCrops();
  } catch (err) {
    console.error('Error loading crop data:', err);
  }
}

export function renderCropFilters() {
  const container = document.getElementById('cropFilters');
  if (!container) return;

  container.innerHTML = cropGroups.map(group => `
    <button class="filter ${group === activeCropGroup ? 'active' : ''}" data-crop-group="${escapeHtml(group)}">
      ${escapeHtml(group)}
    </button>
  `).join('');
}

export function renderCrops() {
  const grid = document.getElementById('cropGrid');
  const searchInput = document.getElementById('cropSearch');
  const countEl = document.getElementById('cropCount');

  if (!grid) return;

  const query = (searchInput?.value || '').trim().toLowerCase();
  const filtered = cropData.filter(crop => {
    const matchGroup = activeCropGroup === 'All crops' || crop.group === activeCropGroup;
    const matchQuery = !query || [
      crop.ch,
      crop.en,
      crop.group,
      crop.summary,
      crop.ecologicalSuitability || '',
      ...(crop.uses || [])
    ].join(' ').toLowerCase().includes(query);
    return matchGroup && matchQuery;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'crop' : 'crops'}`;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty">
        No crops found matching "${escapeHtml(query)}". Try another search keyword or switch crop group.
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(c => `
    <article class="crop-card">
      <div class="crop-emoji">${c.emoji}</div>
      <h3>${escapeHtml(c.ch)}</h3>
      <div class="crop-en">${escapeHtml(c.en)} · ${escapeHtml(c.group)}</div>
      <p>${escapeHtml(c.summary)}</p>
      <div style="font-size:11px;color:#3f5949;margin-bottom:12px;font-weight:700">
        📍 <em>${escapeHtml(c.ecologicalSuitability || 'Malawi-wide')}</em>
      </div>
      <button type="button" data-crop-id="${escapeHtml(c.id)}">
        Explore crop guide →
      </button>
    </article>
  `).join('');
}

export function openCropGuide(id) {
  const c = cropData.find(x => x.id === id);
  if (!c) return;

  const bodyHtml = `
    <p><strong>Overview:</strong> ${escapeHtml(c.summary)}</p>

    <div class="modal-grid" style="margin:16px 0">
      <div class="modal-box">
        <h4>🗓️ Seasonal Windows</h4>
        <p style="font-size:12px;margin:3px 0"><strong>Planting:</strong> ${escapeHtml(c.plantingWindow || 'November – December')}</p>
        <p style="font-size:12px;margin:3px 0"><strong>Harvest:</strong> ${escapeHtml(c.harvestWindow || 'April – May')}</p>
      </div>
      <div class="modal-box">
        <h4>🌍 Ecological Suitability</h4>
        <p style="font-size:12px;margin:3px 0">${escapeHtml(c.ecologicalSuitability || 'Suitable across major Malawi agro-ecological zones')}</p>
      </div>
    </div>

    <h3>🌱 Soil & Land Requirements</h3>
    <p>${escapeHtml(c.soilRequirements || 'Well-drained fertile loam with good organic matter.')}</p>

    <h3>⚡ Recommended Fertiliser Schedule</h3>
    <p>${escapeHtml(c.fertiliserRecommendations || 'Apply recommended basal and top-dressing according to local ADD advice.')}</p>

    <h3>🐛 Key Pests & Disease Risks</h3>
    <p><strong>Common threats:</strong> ${(c.pestsAndDiseases || []).join(' • ')}</p>
    <p style="font-size:12px;color:#78350f;background:#fffbeb;padding:8px 12px;border-radius:10px;border:1px solid #fde68a">
      ⚠️ ${escapeHtml(c.watch)}
    </p>

    <h3>Field-learning checklist / Zoyenera kutsatira m'munda</h3>
    <ol>
      ${(c.field || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}
    </ol>

    <h3>Common uses / Kagwiritsidwe ntchito</h3>
    <ul>
      ${(c.uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('')}
    </ul>

    <div class="notice" style="margin-top:18px">
      <strong>Local guidance matters:</strong> Variety choice, seed rates, and fertilizer amounts vary by district and soil type. Confirm recommendations with your local Agricultural Extension Development Officer (AEDO).
    </div>
  `;

  openModal({
    title: `${c.emoji} ${c.ch}`,
    subtitle: `${c.en} • ${c.group} • Malawi Agronomic Profile`,
    bodyHtml
  });
}

export function initCrops() {
  const filterWrap = document.getElementById('cropFilters');
  const searchInput = document.getElementById('cropSearch');
  const grid = document.getElementById('cropGrid');

  if (filterWrap) {
    filterWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-crop-group]');
      if (!btn) return;
      activeCropGroup = btn.dataset.cropGroup;
      renderCropFilters();
      renderCrops();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderCrops);
  }

  if (grid) {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-crop-id]');
      if (btn) {
        openCropGuide(btn.dataset.cropId);
      }
    });
    loadCropData();
  }
}

document.addEventListener('DOMContentLoaded', initCrops);
