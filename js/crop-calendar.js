/**
 * Ulimi wa Malawi | V6 Interactive Farming & Cropping Calendar
 */
import { escapeHtml, showToast } from './main.js';

let calendarData = null;
let selectedMonthId = new Date().getMonth() + 1; // 1-12 based on current real-world month
let selectedRegion = 'Central';
let selectedCropKey = 'maize';

export async function loadCalendarData() {
  try {
    const basePath = window.location.pathname.includes('/pages/') ? '../data/' : 'data/';
    const response = await fetch(`${basePath}farming-calendar.json`);
    if (!response.ok) throw new Error('Failed to load farming calendar data');
    calendarData = await response.json();
    renderMonthButtons();
    renderMonthDetails(selectedMonthId);
    renderCropTimelineSelector();
    renderCropTimeline(selectedCropKey);
  } catch (err) {
    console.error('Error loading calendar data:', err);
  }
}

export function renderMonthButtons() {
  const container = document.getElementById('calendarMonthNav');
  if (!container || !calendarData?.months) return;

  container.innerHTML = calendarData.months.map(m => {
    const isCurrent = m.id === selectedMonthId;
    return `
      <button class="filter ${isCurrent ? 'active' : ''}" data-month-id="${m.id}" type="button">
        ${m.name} (${escapeHtml(m.nameCh)})
      </button>
    `;
  }).join('');
}

export function renderMonthDetails(monthId) {
  selectedMonthId = Number(monthId);
  const month = calendarData?.months?.find(m => m.id === selectedMonthId);
  const container = document.getElementById('monthDetailsCard');
  if (!container || !month) return;

  renderMonthButtons();

  const regionalAdvice = month.districtAdvisories?.[selectedRegion] || 'Maintain continuous field monitoring.';

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:18px">
      <div>
        <span class="eyebrow" style="background:#e8f4ed;border-color:#c4e2cf;color:var(--forest)">${escapeHtml(month.season)}</span>
        <h3 style="font-size:24px;font-weight:900;color:var(--forest);margin:8px 0 4px">
          ${escapeHtml(month.name)} • ${escapeHtml(month.nameCh)}
        </h3>
        <p style="font-size:14px;color:#405247;margin:0;max-width:750px">
          ${escapeHtml(month.summary)}
        </p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <label for="calendarRegionSelect" style="font-size:12px;font-weight:800;color:var(--forest)">Zone:</label>
        <select id="calendarRegionSelect" style="height:38px;border-radius:10px;border:1px solid #cbdad0;background:#f8faf8;padding:0 10px;font-size:12px;font-weight:700">
          <option value="Southern" ${selectedRegion === 'Southern' ? 'selected' : ''}>Southern Region (Shire / Highlands)</option>
          <option value="Central" ${selectedRegion === 'Central' ? 'selected' : ''}>Central Region (Lilongwe Plain)</option>
          <option value="Northern" ${selectedRegion === 'Northern' ? 'selected' : ''}>Northern Region (Upland / Lakeside)</option>
        </select>
      </div>
    </div>

    <!-- Priority Reminders Checklist -->
    <div style="background:#f4f9f5;border:1px solid #d4e8db;border-radius:16px;padding:18px;margin-bottom:18px">
      <h4 style="font-size:14px;font-weight:850;color:var(--forest);margin:0 0 10px;display:flex;align-items:center;gap:6px">
        <span>✅</span> Priority Seasonal Reminders for ${escapeHtml(month.name)}:
      </h4>
      <ul style="padding-left:20px;margin:0;font-size:13px;line-height:1.75;color:#30493b">
        ${month.reminders.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>

    <div class="modal-grid">
      <div class="modal-box">
        <h4>Crops in Active Focus</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
          ${month.cropsInFocus.map(c => `<span class="tag" style="background:#fff;border-color:#cbdad0">${escapeHtml(c)}</span>`).join('')}
        </div>
      </div>
      <div class="modal-box">
        <h4>${selectedRegion} Region Ecological Advisory</h4>
        <p style="font-size:13px;line-height:1.65;color:#355342;margin:4px 0 0">
          ${escapeHtml(regionalAdvice)}
        </p>
      </div>
    </div>
  `;

  // Attach region listener
  const regSelect = document.getElementById('calendarRegionSelect');
  if (regSelect) {
    regSelect.addEventListener('change', (e) => {
      selectedRegion = e.target.value;
      renderMonthDetails(selectedMonthId);
      showToast(`Calendar adapted for ${selectedRegion} Region`);
    });
  }
}

export function renderCropTimelineSelector() {
  const container = document.getElementById('cropTimelineButtons');
  if (!container || !calendarData?.cropTimelines) return;

  container.innerHTML = calendarData.cropTimelines.map(c => `
    <button class="filter ${c.cropKey === selectedCropKey ? 'active' : ''}" data-crop-key="${c.cropKey}" type="button">
      ${c.emoji} ${escapeHtml(c.name.split(' (')[0])}
    </button>
  `).join('');
}

export function renderCropTimeline(cropKey) {
  selectedCropKey = cropKey;
  const crop = calendarData?.cropTimelines?.find(c => c.cropKey === selectedCropKey);
  const container = document.getElementById('cropTimelineDisplay');
  if (!container || !crop) return;

  renderCropTimelineSelector();

  container.innerHTML = `
    <div style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:0 8px 24px rgba(11,53,32,0.04)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;border-bottom:1px solid #edf2ee;padding-bottom:14px">
        <div>
          <h3 style="font-size:20px;font-weight:900;color:var(--forest);margin:0">
            ${crop.emoji} ${escapeHtml(crop.name)}
          </h3>
          <span style="font-size:12px;color:var(--muted);font-weight:600">Maturity Window: <strong>${escapeHtml(crop.durationDays)}</strong></span>
        </div>
        <span class="badge-verified">${escapeHtml(crop.ecology)}</span>
      </div>

      <!-- Gantt Stage Timeline Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px">
        ${crop.stages.map((st, idx) => `
          <div style="background:#f7faf8;border:1px solid #e1ebe3;border-radius:14px;padding:16px;position:relative">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:10px;font-weight:850;color:var(--green);text-transform:uppercase;letter-spacing:0.08em">Phase ${idx + 1}</span>
              <span style="font-size:11px;font-weight:800;color:var(--forest);background:#e7f3ec;padding:3px 8px;border-radius:999px">${escapeHtml(st.timing)}</span>
            </div>
            <h4 style="font-size:15px;font-weight:850;color:var(--forest);margin:0 0 6px">
              ${escapeHtml(st.phase)}
            </h4>
            <p style="font-size:12px;color:#45594e;line-height:1.6;margin:0">
              ${escapeHtml(st.notes)}
            </p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function initCropCalendar() {
  const monthNav = document.getElementById('calendarMonthNav');
  const cropNav = document.getElementById('cropTimelineButtons');
  const currentMonthBtn = document.getElementById('jumpCurrentMonthBtn');

  if (monthNav) {
    monthNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-month-id]');
      if (!btn) return;
      renderMonthDetails(Number(btn.dataset.monthId));
    });
  }

  if (cropNav) {
    cropNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-crop-key]');
      if (!btn) return;
      renderCropTimeline(btn.dataset.cropKey);
    });
  }

  if (currentMonthBtn) {
    currentMonthBtn.addEventListener('click', () => {
      const nowMonth = new Date().getMonth() + 1;
      renderMonthDetails(nowMonth);
      showToast('Jumped to current month');
    });
  }

  if (document.getElementById('calendarMonthNav')) {
    loadCalendarData();
  }
}

document.addEventListener('DOMContentLoaded', initCropCalendar);
