/**
 * Ulimi wa Malawi | Pest & Disease Diagnostic Centre
 */
import { escapeHtml, openModal } from './main.js';
import { getCurrentLang } from './i18n.js';
import { getIconSvg } from './icons.js';

let pestData = [];
let activeType = 'all';
let activeCropFilter = 'all';

export async function loadPestData() {
  const container = document.getElementById('pestGrid');
  try {
    const basePath = window.location.pathname.includes('/pages/') ? '../data/' : 'data/';
    const response = await fetch(`${basePath}pests-diseases.json`);
    if (!response.ok) throw new Error('Failed to load pest & disease data');
    pestData = await response.json();
    renderPestCards();
  } catch (err) {
    console.error('Error loading pest & disease data:', err);
    if (container) {
      container.innerHTML = `<div class="empty">Unable to load pest and disease profiles right now. Please refresh the page or check your connection.</div>`;
    }
  }
}

export function renderPestCards() {
  const container = document.getElementById('pestGrid');
  const searchInput = document.getElementById('pestSearch');
  const countEl = document.getElementById('pestCount');

  if (!container) return;

  const query = (searchInput?.value || '').trim().toLowerCase();

  const filtered = pestData.filter(item => {
    const matchType = activeType === 'all' || item.type === activeType;
    const matchCrop = activeCropFilter === 'all' || (item.affectedCrops || []).some(c => c.toLowerCase().includes(activeCropFilter.toLowerCase()));
    const matchQuery = !query || [
      item.nameCh,
      item.nameEn,
      item.scientificName,
      item.symptoms,
      ...(item.affectedCrops || []),
      ...(item.prevention || []),
      ...(item.control || [])
    ].join(' ').toLowerCase().includes(query);

    return matchType && matchCrop && matchQuery;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} diagnostic profiles`;
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty">
        No pests or diseases found matching your search. Try different keywords (e.g., "blight", "yellow", "armyworm", "leaves").
      </div>
    `;
    return;
  }

  const lang = getCurrentLang();
  const bugSvg = getIconSvg('bug', 'pro-icon');
  const leafSvg = getIconSvg('leaf', 'pro-icon');

  container.innerHTML = filtered.map(item => {
    const isPest = item.type === 'pest';
    const typeText = isPest
      ? (lang === 'ny' ? 'Tizilombo Towononga' : 'Insect Pest')
      : (lang === 'ny' ? 'Matenda a Mbewu' : 'Crop Disease');

    const typeBadge = isPest
      ? `<span class="tag" style="background:#fff3e0;color:#b45309;font-weight:800;display:inline-flex;align-items:center;gap:4px">${bugSvg} ${typeText}</span>`
      : `<span class="tag" style="background:#fce7f3;color:#be185d;font-weight:800;display:inline-flex;align-items:center;gap:4px">${leafSvg} ${typeText}</span>`;

    const severityColor = item.severity === 'Critical' ? '#dc2626' : '#d97706';
    const severityLabel = lang === 'ny' ? (item.severity === 'Critical' ? 'Choopsa Kwambiri' : 'Choopsa') : item.severity;
    const title = lang === 'ny' ? item.nameCh : item.nameEn;
    const subTitle = lang === 'ny' ? `${item.nameEn} (${item.scientificName})` : `${item.nameCh} (${item.scientificName})`;
    const symptomsLabel = lang === 'ny' ? 'Zizindikiro Zazikulu:' : 'Key Symptoms:';
    const actionLabel = lang === 'ny' ? 'Onani Kafukufuku & Mankhwala →' : 'View Diagnostics & Treatment →';

    return `
      <article class="farm-card" style="min-height:auto" tabindex="0" role="button" data-pest-id="${escapeHtml(item.id)}" aria-label="Diagnose ${escapeHtml(title)}">
        <div class="card-top">
          <div class="crop-icon">${isPest ? bugSvg : leafSvg}</div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${typeBadge}
            <span style="font-size:10px;font-weight:850;color:${severityColor};background:#fff;border:1px solid ${severityColor}40;border-radius:999px;padding:3px 8px">
              ${escapeHtml(severityLabel)}
            </span>
          </div>
        </div>
        <h3 style="margin-top:12px">${escapeHtml(title)}</h3>
        <div class="english">${escapeHtml(subTitle)}</div>
        <p class="desc" style="margin-bottom:12px">
          <strong>${symptomsLabel}</strong> ${escapeHtml(item.symptoms.slice(0, 140))}…
        </p>
        <div class="tags" style="margin-bottom:12px">
          ${(item.affectedCrops || []).map(c => `<span class="tag">${escapeHtml(c)}</span>`).join('')}
        </div>
        <div class="card-foot">
          <span>${actionLabel}</span>
        </div>
      </article>
    `;
  }).join('');
}

export function openPestDetails(id) {
  const item = pestData.find(p => p.id === id);
  if (!item) return;

  const isPest = item.type === 'pest';
  const bugSvg = getIconSvg('bug', 'pro-icon');
  const leafSvg = getIconSvg('leaf', 'pro-icon');
  const warnSvg = getIconSvg('alertTriangle', 'pro-icon');
  const affected = (item.affectedCrops || []).map(c => escapeHtml(c)).join(' • ');

  const bodyHtml = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <span class="badge-verified" style="display:inline-flex;align-items:center;gap:5px;background:${isPest ? '#fff7ed' : '#fdf2f8'};color:${isPest ? '#c2410c' : '#be185d'};border-color:#fbcfe8">
        ${isPest ? bugSvg : leafSvg} ${isPest ? 'INSECT PEST' : 'CROP DISEASE'}
      </span>
      <span style="font-size:11px;font-weight:800;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:4px 10px;border-radius:999px">
        Severity: ${escapeHtml(item.severity)}
      </span>
    </div>

    <div class="modal-box" style="margin-bottom:16px">
      <h4>Host Crops Vulnerable in Malawi</h4>
      <p style="font-size:13px;color:#2c4033;margin:0">${affected}</p>
    </div>

    <h3>Visible Symptoms &amp; Diagnostic Indicators</h3>
    <p style="font-size:13px;line-height:1.7;color:#374151">${escapeHtml(item.symptoms)}</p>

    <h3>Cultural &amp; Agronomic Prevention</h3>
    <ul>
      ${(item.prevention || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
    </ul>

    <h3>Safe Management &amp; Control Recommendations</h3>
    <ul>
      ${(item.control || []).map(c => `<li>${escapeHtml(c)}</li>`).join('')}
    </ul>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:14px;margin-top:16px">
      <h4 style="font-size:12px;font-weight:900;color:#92400e;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:6px">
        ${warnSvg} Safe Handling &amp; Chemical Precautions
      </h4>
      <p style="font-size:12px;line-height:1.65;color:#78350f;margin:0">
        ${escapeHtml(item.safeHandling)}
      </p>
    </div>

    <div class="notice" style="margin-top:18px">
      <strong>Extension &amp; Field Confirmation Disclaimer:</strong> This reference guide supports early scouting only and does not replace laboratory diagnostics or confirmation by your local Agricultural Extension Development Officer (AEDO) or agro-dealer registered under the Pesticides Control Board of Malawi.
    </div>
  `;

  openModal({
    title: `${item.nameCh} (${item.nameEn})`,
    subtitle: `${item.scientificName} • Diagnostic Guide`,
    bodyHtml
  });
}

export function initPestDisease() {
  const searchInput = document.getElementById('pestSearch');
  const typeButtons = document.getElementById('pestTypeFilters');
  const cropSelect = document.getElementById('pestCropFilter');
  const grid = document.getElementById('pestGrid');

  if (searchInput) {
    searchInput.addEventListener('input', renderPestCards);
  }

  if (typeButtons) {
    typeButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      activeType = btn.dataset.type;
      typeButtons.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPestCards();
    });
  }

  if (cropSelect) {
    cropSelect.addEventListener('change', (e) => {
      activeCropFilter = e.target.value;
      renderPestCards();
    });
  }

  if (grid) {
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-pest-id]');
      if (card) {
        openPestDetails(card.dataset.pestId);
      }
    });

    grid.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-pest-id]')) {
        e.preventDefault();
        openPestDetails(e.target.dataset.pestId);
      }
    });

    loadPestData();
  }

  window.addEventListener('languageChanged', renderPestCards);
}

document.addEventListener('DOMContentLoaded', initPestDisease);
