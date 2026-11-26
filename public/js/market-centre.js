/**
 * Ulimi wa Malawi | Market Intelligence Controller
 * Supabase is the canonical source for verified commodity observations and pending farmer reports.
 * Bundled JSON provides an offline read-only fallback during network outages.
 */
import { escapeHtml, openModal, showToast } from './main.js';
import { supabase } from './auth.js';
import { getIconSvg } from './icons.js';
import { getCurrentLang } from './i18n.js';

let marketData = [];
let dataOrigin = 'database';
const DATA_PATH = '../data/markets.json';
const WB_DATA_PATH = '../data/world-bank-market-estimates.json';

function fromDb(row) {
  return {
    id: row.id,
    crop: row.crop_name,
    cropKey: row.crop_key,
    category: row.category,
    marketName: row.market_name,
    district: row.district,
    region: row.region,
    unit: row.unit,
    priceMin: Number(row.price_min),
    priceMax: Number(row.price_max),
    currency: row.currency || 'MWK',
    dateReported: row.date_observed,
    status: row.status,
    reporter: row.reporter_name || row.source_name || 'Market report',
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceReference: row.source_reference,
    priceBasis: row.price_basis,
    notes: row.notes,
    sourceType: row.source_type
  };
}

function money(value) {
  return new Intl.NumberFormat('en-MW', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function perKgHint(unit, minVal, maxVal) {
  const u = String(unit || '').toLowerCase();
  const match = u.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (!match) return '';
  const kg = Number(match[1]);
  if (!kg || kg === 1) return '';
  const minKg = Math.round(Number(minVal) / kg);
  const maxKg = Math.round(Number(maxVal) / kg);
  return minKg === maxKg ? `~MWK ${money(minKg)}/kg` : `~MWK ${money(minKg)} – ${money(maxKg)}/kg`;
}

function setLoadMessage(message, isError = false) {
  const count = document.getElementById('marketRecordCount');
  const body = document.getElementById('marketTableBody');
  if (count) count.textContent = message;
  if (body && isError) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px">Market prices could not be loaded. Please refresh or try again later.</td></tr>';
  }
}

export async function loadMarketData() {
  setLoadMessage('Loading published market observations…');
  try {
    const { data, error } = await supabase
      .from('market_price_reports')
      .select('*')
      .eq('status', 'verified')
      .order('date_observed', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    marketData = (data || []).map(fromDb);
    dataOrigin = 'database';
    renderMarketStats();
    renderMarketTable();
    renderPriceComparison();
    renderMarketFreshness();
    return marketData;
  } catch (err) {
    console.error('Shared market data unavailable; using bundled reference data:', err);
    try {
      const response = await fetch(DATA_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error('Bundled market data request failed');
      marketData = await response.json();
      dataOrigin = 'fallback';
      renderMarketStats();
      renderMarketTable();
      renderPriceComparison();
      renderMarketFreshness();
      showToast('Showing saved reference data. Live database is unavailable.');
      return marketData;
    } catch (fallbackError) {
      console.error('Market fallback unavailable:', fallbackError);
      marketData = [];
      renderMarketStats();
      renderMarketTable();
      renderPriceComparison();
      setLoadMessage('Market data is temporarily unavailable.', true);
      return [];
    }
  }
}

export function getMarketData() {
  return marketData;
}

export function saveMarketData(data) {
  marketData = Array.isArray(data) ? data : [];
  renderMarketStats();
  renderMarketTable();
  renderPriceComparison();
  renderMarketFreshness();
}

export function renderMarketFreshness() {
  const el = document.getElementById('marketFreshness');
  if (!el) return;
  const dates = marketData.map(item => item.dateReported).filter(Boolean).sort();
  const latest = dates.at(-1);
  const label = latest ? new Date(`${latest}T00:00:00`).toLocaleDateString('en-MW', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No observations yet';
  el.textContent = dataOrigin === 'database'
    ? `Shared database • Latest observation: ${label}`
    : `Offline reference copy • Latest observation: ${label}`;
}

export function renderMarketStats() {
  const container = document.getElementById('marketStatsRow');
  if (!container) return;
  const total = marketData.length;
  const crops = new Set(marketData.map(m => m.cropKey || m.crop)).size;
  const districts = new Set(marketData.map(m => m.district)).size;
  const latest = marketData.map(m => m.dateReported).filter(Boolean).sort().at(-1);
  container.innerHTML = `
    <div class="market-stat-card"><small>Commodities</small><strong>${crops}</strong><span>Published crop types</span></div>
    <div class="market-stat-card"><small>Markets represented</small><strong>${districts}</strong><span>Districts with observations</span></div>
    <div class="market-stat-card"><small>Verified observations</small><strong>${total}</strong><span>Admin-verified records</span></div>
    <div class="market-stat-card"><small>Latest observation</small><strong style="font-size:18px">${escapeHtml(latest || '—')}</strong><span>${dataOrigin === 'database' ? 'Shared market database' : 'Offline reference data'}</span></div>
  `;
}

export function renderMarketTable() {
  const tbody = document.getElementById('marketTableBody');
  if (!tbody) return;
  const crop = document.getElementById('marketCropFilter')?.value || 'all';
  const district = document.getElementById('marketDistrictFilter')?.value || 'all';
  const status = document.getElementById('marketStatusFilter')?.value || 'all';
  const sortMode = document.getElementById('marketSortOrder')?.value || 'newest';
  const query = (document.getElementById('marketSearch')?.value || '').trim().toLowerCase();

  const filtered = marketData.filter(item => {
    const cropMatch = crop === 'all' || item.cropKey === crop || String(item.crop || '').toLowerCase().includes(crop.toLowerCase());
    const districtMatch = district === 'all' || item.district === district;
    const statusMatch = status === 'all' || item.status === status || (status === 'verified' && item.status === 'verified');
    const textMatch = !query || [item.crop, item.marketName, item.district, item.region, item.notes, item.reporter, item.sourceName, item.unit].join(' ').toLowerCase().includes(query);
    return cropMatch && districtMatch && statusMatch && textMatch;
  }).sort((a, b) => {
    if (sortMode === 'priceAsc') return Number(a.priceMin) - Number(b.priceMin);
    if (sortMode === 'priceDesc') return Number(b.priceMax) - Number(a.priceMax);
    if (sortMode === 'cropAsc') return String(a.crop || '').localeCompare(String(b.crop || ''));
    return String(b.dateReported || '').localeCompare(String(a.dateReported || ''));
  });

  const count = document.getElementById('marketRecordCount');
  if (count) count.textContent = `${filtered.length} verified records • ${dataOrigin === 'database' ? 'shared database' : 'offline reference'}`;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:36px;color:#718078">No verified prices match these filters. Try another crop, district, or search keyword.</td></tr>';
    return;
  }

  const checkSvg = getIconSvg('check', 'pro-icon');
  tbody.innerHTML = filtered.map(item => {
    const unitNote = perKgHint(item.unit, item.priceMin, item.priceMax);
    return `
    <tr>
      <td class="crop-col"><strong>${escapeHtml(item.crop)}</strong><div style="font-size:11px;color:#617368">${escapeHtml(item.category)}</div></td>
      <td><strong>${escapeHtml(item.marketName)}</strong><div style="font-size:11px;color:#617368">${escapeHtml(item.district)} (${escapeHtml(item.region)})</div></td>
      <td>${escapeHtml(item.unit)}</td>
      <td class="price-val">MWK ${money(item.priceMin)}${Number(item.priceMin) === Number(item.priceMax) ? '' : ' – ' + money(item.priceMax)}${unitNote ? `<div style="font-size:11px;font-weight:700;color:#52645a">${escapeHtml(unitNote)}</div>` : ''}</td>
      <td><span class="badge-verified" style="display:inline-flex;align-items:center;gap:4px">${checkSvg} Verified</span></td>
      <td style="font-size:12px;color:#52645a">${escapeHtml(item.dateReported)}<div style="font-size:10px;color:#6f8277">${escapeHtml(item.sourceName || item.reporter || 'Source recorded')}</div></td>
      <td><button class="btn" style="padding:6px 10px;font-size:11px;background:#edf5ef;color:var(--forest)" data-market-detail="${escapeHtml(item.id)}">Details</button></td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('[data-market-detail]').forEach(button => {
    button.addEventListener('click', () => openMarketDetail(button.dataset.marketDetail));
  });
}

export function renderPriceComparison() {
  const container = document.getElementById('priceComparisonGrid');
  if (!container) return;
  const groups = new Map();
  marketData.forEach(item => {
    const key = `${String(item.crop || '').trim()}|${String(item.unit || '').trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  const comparable = [...groups.values()].filter(rows => rows.length > 1);
  if (!comparable.length) {
    container.innerHTML = '<p style="font-size:13px;color:#52645a">More unit-matched verified observations across different markets are needed before a regional comparison can be shown.</p>';
    return;
  }
  container.innerHTML = comparable.map(rows => {
    const low = Math.min(...rows.map(r => Number(r.priceMin)));
    const high = Math.max(...rows.map(r => Number(r.priceMax)));
    const lowRow = rows.find(r => Number(r.priceMin) === low);
    const highRow = [...rows].reverse().find(r => Number(r.priceMax) === high);
    const marketCount = new Set(rows.map(r => `${r.marketName}|${r.district}`)).size;
    return `<div class="compare-card">
      <span class="region-tag">${marketCount} markets • ${rows.length} verified records</span>
      <h4>${escapeHtml(rows[0].crop)} (${escapeHtml(rows[0].unit)})</h4>
      <div class="price-spread">MWK ${money(low)} – ${money(high)}</div>
      <p style="font-size:12px;margin:6px 0;color:#405247;line-height:1.5">
        <strong>Lowest recorded:</strong> ${escapeHtml(lowRow.marketName)} • ${escapeHtml(lowRow.district)} • ${escapeHtml(lowRow.dateReported)}<br>
        <strong>Highest recorded:</strong> ${escapeHtml(highRow.marketName)} • ${escapeHtml(highRow.district)} • ${escapeHtml(highRow.dateReported)}
      </p>
      <div style="font-size:11px;color:#617368;margin-top:6px">Spread: MWK ${money(high - low)}. Compare same units only; confirm today's local price and grade before trading.</div>
    </div>`;
  }).join('');
}

function sanitizeHttpUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    return '';
  }
  return '';
}

export function openMarketDetail(id) {
  const item = marketData.find(row => String(row.id) === String(id));
  if (!item) return;
  const checkSvg = getIconSvg('check', 'pro-icon');
  const unitNote = perKgHint(item.unit, item.priceMin, item.priceMax);
  const safeSourceUrl = sanitizeHttpUrl(item.sourceUrl);
  const bodyHtml = `
    <div style="margin-bottom:14px"><span class="badge-verified" style="display:inline-flex;align-items:center;gap:4px">${checkSvg} Admin-verified reference observation</span></div>
    <div class="modal-grid" style="margin-bottom:16px">
      <div class="modal-box"><h4>Commodity &amp; unit</h4><p><strong>${escapeHtml(item.crop)}</strong> (${escapeHtml(item.category)})</p><p>Trading unit: <strong>${escapeHtml(item.unit)}</strong></p></div>
      <div class="modal-box"><h4>Market</h4><p><strong>${escapeHtml(item.marketName)}</strong></p><p>${escapeHtml(item.district)} District, ${escapeHtml(item.region)} Region, Malawi</p></div>
    </div>
    <div style="background:#f4f9f5;border:1px solid #dbeae0;border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;color:#52645a;font-weight:700">PUBLISHED REFERENCE PRICE</div>
      <div style="font-size:24px;font-weight:900;color:var(--forest);margin:4px 0">MWK ${money(item.priceMin)}${Number(item.priceMin) === Number(item.priceMax) ? '' : ' – ' + money(item.priceMax)}</div>
      <div style="font-size:12px;color:#355340">Per ${escapeHtml(item.unit)}${unitNote ? ` (${escapeHtml(unitNote)})` : ''} • Observed ${escapeHtml(item.dateReported)}</div>
    </div>
    <h3>Observation notes</h3><p>${escapeHtml(item.notes || 'No additional notes supplied.')}</p>
    <h3>Source and verification</h3>
    <p><strong>Source:</strong> ${escapeHtml(item.sourceName || item.reporter || 'Not recorded')}<br>
    <strong>Price basis:</strong> ${escapeHtml(item.priceBasis || 'Not specified')}<br>
    <strong>Record reference:</strong> ${escapeHtml(item.sourceReference || 'Not supplied')}<br>
    ${safeSourceUrl ? `<a href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer">Open source record ↗</a><br>` : ''}
    <strong>Data type:</strong> ${escapeHtml(item.sourceType || 'Published reference')}</p>
    <div class="notice"><strong>Important:</strong> This is a dated reference observation, not a live offer or guaranteed transaction price. Confirm today's price, quality grade and unit directly with the market before trading.</div>
  `;
  openModal({ title: `${item.crop} @ ${item.marketName}`, subtitle: `${item.district} District • MWK ${money(item.priceMin)} – ${money(item.priceMax)}`, bodyHtml });
}

async function loadWorldBankMarketEstimates() {
  const tbody = document.getElementById('worldBankMarketTableBody');
  const meta = document.getElementById('worldBankMarketMeta');
  if (!tbody) return;
  try {
    const response = await fetch(WB_DATA_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error('World Bank estimates file unavailable');
    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    if (!rows.length || Number(payload?.recordCount || 0) === 0) {
      if (meta) {
        meta.textContent = payload?.datasetUpdatedAt
          ? `Dataset checked (${payload.datasetUpdatedAt}): 0 modeled estimate rows currently published.`
          : 'World Bank modeled estimates currently contain 0 records. Only verified Malawi market observations are shown above.';
      }
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#52645a">No World Bank modeled estimates have been published in this repository dataset yet. Verified Malawi observations appear above.</td></tr>';
      return;
    }

    if (meta) {
      meta.textContent = `${rows.length} modeled estimate rows • Dataset updated: ${payload.datasetUpdatedAt || 'Scheduled refresh'}`;
    }
    tbody.innerHTML = rows.map(row => `
      <tr>
        <td><strong>${escapeHtml(row.crop || row.commodity || '')}</strong></td>
        <td>${escapeHtml(row.market || row.marketName || '')}</td>
        <td>${escapeHtml(row.unit || 'kg')}</td>
        <td>MWK ${money(row.priceMin || row.estimateMin || 0)}${row.priceMax && Number(row.priceMax) !== Number(row.priceMin) ? ' – ' + money(row.priceMax) : ''}</td>
        <td>${escapeHtml(row.date || row.dateObserved || '')}</td>
        <td style="font-size:12px;color:#52645a">${escapeHtml(row.note || 'Modeled price estimate')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('Could not read World Bank market estimates dataset:', err);
    if (meta) meta.textContent = 'External modeled estimates are currently unavailable. Verified Malawi market observations are shown above.';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">External modeled estimates dataset could not be loaded.</td></tr>';
  }
}

async function initFarmerSubmissionPanel() {
  const authBox = document.getElementById('farmerSubmitAuthPrompt');
  const form = document.getElementById('farmerPriceForm');
  const statusEl = document.getElementById('farmerPriceStatus');
  const myListWrap = document.getElementById('myMarketSubmissionsWrap');
  const myListBody = document.getElementById('myMarketSubmissionsBody');
  const dateInput = document.getElementById('subDateObserved');

  if (!form && !authBox) return;

  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  let currentUser = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
  } catch (err) {
    console.warn('Unable to check farmer session for market submission:', err);
  }

  if (!currentUser) {
    if (authBox) authBox.hidden = false;
    if (form) form.hidden = true;
    if (myListWrap) myListWrap.hidden = true;
    return;
  }

  if (authBox) authBox.hidden = true;
  if (form) form.hidden = false;

  const loadMySubmissions = async () => {
    if (!myListWrap || !myListBody) return;
    try {
      const { data, error } = await supabase
        .from('market_price_reports')
        .select('id,crop_name,market_name,district,unit,price_min,price_max,date_observed,status,created_at')
        .eq('reporter_user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || !data.length) {
        myListWrap.hidden = true;
        return;
      }
      myListWrap.hidden = false;
      myListBody.innerHTML = data.map(r => {
        const badgeStyle = r.status === 'verified'
          ? 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0'
          : r.status === 'rejected'
            ? 'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca'
            : 'background:#fef9c3;color:#854d0e;border:1px solid #fde047';
        const statusText = r.status === 'verified' ? 'Verified' : r.status === 'rejected' ? 'Rejected' : 'Pending Review';
        return `<tr>
          <td><strong>${escapeHtml(r.crop_name)}</strong></td>
          <td>${escapeHtml(r.market_name)} (${escapeHtml(r.district)})</td>
          <td>${escapeHtml(r.unit)}</td>
          <td>MWK ${money(r.price_min)}${Number(r.price_min) !== Number(r.price_max) ? ' – ' + money(r.price_max) : ''}</td>
          <td>${escapeHtml(r.date_observed)}</td>
          <td><span style="${badgeStyle};padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800">${statusText}</span></td>
        </tr>`;
      }).join('');
    } catch (err) {
      console.warn('Could not load farmer submission history:', err);
    }
  };

  await loadMySubmissions();

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.style.color = '#14532d';
      }

      const cropSelect = document.getElementById('subCropName');
      const cropKey = cropSelect?.value || '';
      const cropName = cropSelect?.selectedOptions?.[0]?.dataset?.cropLabel || cropSelect?.selectedOptions?.[0]?.textContent || cropKey;
      const category = cropSelect?.selectedOptions?.[0]?.dataset?.category || 'Cereals';
      const marketName = document.getElementById('subMarketName')?.value.trim();
      const district = document.getElementById('subDistrict')?.value.trim();
      const region = document.getElementById('subRegion')?.value.trim();
      const unit = document.getElementById('subUnit')?.value.trim();
      const priceMin = Number(document.getElementById('subPriceMin')?.value);
      const priceMaxInput = document.getElementById('subPriceMax')?.value;
      const priceMax = priceMaxInput ? Number(priceMaxInput) : priceMin;
      const dateObserved = document.getElementById('subDateObserved')?.value || new Date().toISOString().split('T')[0];
      const priceBasis = document.getElementById('subPriceBasis')?.value || 'Local market spot observation';
      const notes = document.getElementById('subNotes')?.value.trim();

      if (!cropName || !marketName || !district || !unit || !(priceMin > 0) || !(priceMax >= priceMin)) {
        if (statusEl) {
          statusEl.style.color = '#b91c1c';
          statusEl.textContent = 'Please complete all required fields and ensure maximum price is at least the minimum price.';
        }
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const displayName = [currentUser.user_metadata?.first_name, currentUser.user_metadata?.last_name]
          .filter(Boolean).join(' ').trim() || currentUser.email || 'Registered farmer';

        const { error } = await supabase.from('market_price_reports').insert([{
          crop_name: cropName,
          crop_key: cropKey,
          category,
          market_name: marketName,
          district,
          region,
          unit,
          price_min: priceMin,
          price_max: priceMax,
          currency: 'MWK',
          date_observed: dateObserved,
          status: 'pending',
          source_type: 'farmer',
          reporter_user_id: currentUser.id,
          reporter_name: displayName,
          source_name: 'Farmer field report (Pending verification)',
          price_basis: priceBasis,
          notes: notes || null,
          verified_by: null,
          verified_at: null
        }]);

        if (error) throw error;

        form.reset();
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        if (statusEl) {
          statusEl.style.color = '#14532d';
          statusEl.textContent = getCurrentLang() === 'ny'
            ? 'Zikomo! Mtengo wanu watumizidwa ndipo ukuyembekezera chitsimikizo cha woyang\'anira usanatuluke pamsika.'
            : 'Thank you! Your market observation was submitted as pending and will appear publicly only after administrator verification.';
        }
        showToast('Market price observation submitted for admin review.');
        await loadMySubmissions();
      } catch (err) {
        console.error('Market submission error:', err);
        if (statusEl) {
          statusEl.style.color = '#b91c1c';
          statusEl.textContent = err.message?.includes('row-level security')
            ? 'Your account could not submit a price right now. Please ensure the latest market submission database policy is active.'
            : `Unable to submit price observation: ${err.message || 'Unknown error'}`;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

export function initMarketCentre() {
  const crop = document.getElementById('marketCropFilter');
  const district = document.getElementById('marketDistrictFilter');
  const status = document.getElementById('marketStatusFilter');
  const sortOrder = document.getElementById('marketSortOrder');
  const search = document.getElementById('marketSearch');
  const reset = document.getElementById('resetMarketFilters');

  [crop, district, status, sortOrder].filter(Boolean).forEach(el => el.addEventListener('change', renderMarketTable));
  if (search) search.addEventListener('input', renderMarketTable);
  if (reset) {
    reset.addEventListener('click', () => {
      if (crop) crop.value = 'all';
      if (district) district.value = 'all';
      if (status) status.value = 'all';
      if (sortOrder) sortOrder.value = 'newest';
      if (search) search.value = '';
      renderMarketTable();
      showToast('Market filters reset');
    });
  }

  if (document.getElementById('marketTableBody')) {
    loadMarketData();
    loadWorldBankMarketEstimates();
    initFarmerSubmissionPanel();
  }
}

document.addEventListener('DOMContentLoaded', initMarketCentre);
