/**
 * Ulimi wa Malawi | Market Intelligence V6
 * Supabase is the shared source of truth. The bundled JSON is a read-only
 * fallback for outages; browser localStorage is never treated as canonical.
 */
import { escapeHtml, openModal, showToast } from './main.js';
import { supabase } from './auth.js';

let marketData = [];
let dataOrigin = 'database';
const DATA_PATH = '../data/markets.json';

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

function setLoadMessage(message, isError = false) {
  const count = document.getElementById('marketRecordCount');
  const body = document.getElementById('marketTableBody');
  if (count) count.textContent = message;
  if (body && isError) body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px">Market prices could not be loaded. Please refresh or try again later.</td></tr>';
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

// Kept for older modules; database writes are handled by the admin module.
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
    <div class="market-stat-card"><small>Published observations</small><strong>${total}</strong><span>Verified reference records</span></div>
    <div class="market-stat-card"><small>Latest observation</small><strong style="font-size:18px">${latest || '—'}</strong><span>${dataOrigin === 'database' ? 'Shared market database' : 'Offline reference data'}</span></div>
  `;
}

export function renderMarketTable() {
  const tbody = document.getElementById('marketTableBody');
  if (!tbody) return;
  const crop = document.getElementById('marketCropFilter')?.value || 'all';
  const district = document.getElementById('marketDistrictFilter')?.value || 'all';
  const status = document.getElementById('marketStatusFilter')?.value || 'all';
  const query = (document.getElementById('marketSearch')?.value || '').trim().toLowerCase();

  const filtered = marketData.filter(item => {
    const cropMatch = crop === 'all' || item.cropKey === crop || item.crop.toLowerCase().includes(crop.toLowerCase());
    const districtMatch = district === 'all' || item.district === district;
    const statusMatch = status === 'all' || item.status === status || (status === 'verified' && item.status === 'verified');
    const textMatch = !query || [item.crop,item.marketName,item.district,item.region,item.notes,item.reporter,item.unit].join(' ').toLowerCase().includes(query);
    return cropMatch && districtMatch && statusMatch && textMatch;
  }).sort((a,b) => String(b.dateReported).localeCompare(String(a.dateReported)));

  const count = document.getElementById('marketRecordCount');
  if (count) count.textContent = `${filtered.length} published records • ${dataOrigin === 'database' ? 'shared data' : 'offline reference'}`;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:36px;color:#718078">No published prices match these filters. Try another crop or district.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td class="crop-col"><strong>${escapeHtml(item.crop)}</strong><div style="font-size:11px;color:#617368">${escapeHtml(item.category)}</div></td>
      <td><strong>${escapeHtml(item.marketName)}</strong><div style="font-size:11px;color:#617368">${escapeHtml(item.district)} (${escapeHtml(item.region)})</div></td>
      <td>${escapeHtml(item.unit)}</td>
      <td class="price-val">MWK ${money(item.priceMin)}${Number(item.priceMin) === Number(item.priceMax) ? '' : ' – ' + money(item.priceMax)}</td>
      <td><span class="badge-verified">✓ Published</span></td>
      <td style="font-size:12px;color:#52645a">${escapeHtml(item.dateReported)}<div style="font-size:10px;color:#809488">${escapeHtml(item.reporter || 'Source not recorded')}</div></td>
      <td><button class="btn" style="padding:6px 10px;font-size:11px;background:#edf5ef;color:var(--forest)" data-market-detail="${escapeHtml(item.id)}">Details</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-market-detail]').forEach(button => {
    button.addEventListener('click', () => openMarketDetail(button.dataset.marketDetail));
  });
}

export function renderPriceComparison() {
  const container = document.getElementById('priceComparisonGrid');
  if (!container) return;
  const groups = new Map();
  marketData.forEach(item => {
    const key = `${item.crop}| ${item.unit}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  const comparable = [...groups.values()].filter(rows => rows.length > 1);
  if (!comparable.length) {
    container.innerHTML = '<p>More matching observations are needed before a regional comparison can be shown.</p>';
    return;
  }
  container.innerHTML = comparable.map(rows => {
    const low = Math.min(...rows.map(r => Number(r.priceMin)));
    const high = Math.max(...rows.map(r => Number(r.priceMax)));
    const lowRow = rows.find(r => Number(r.priceMin) === low);
    const highRow = [...rows].reverse().find(r => Number(r.priceMax) === high);
    return `<div class="compare-card">
      <span class="region-tag">Published observations</span>
      <h4>${escapeHtml(rows[0].crop)} (${escapeHtml(rows[0].unit)})</h4>
      <div class="price-spread">MWK ${money(low)} – ${money(high)}</div>
      <p style="font-size:12px;margin:6px 0;color:#405247;line-height:1.5">
        <strong>Lowest recorded:</strong> ${escapeHtml(lowRow.marketName)} • ${escapeHtml(lowRow.district)} • ${escapeHtml(lowRow.dateReported)}<br>
        <strong>Highest recorded:</strong> ${escapeHtml(highRow.marketName)} • ${escapeHtml(highRow.district)} • ${escapeHtml(highRow.dateReported)}
      </p>
      <div style="font-size:11px;color:#617368;margin-top:6px">Spread: MWK ${money(high-low)}. Observation dates may differ; confirm today's local price before trading.</div>
    </div>`;
  }).join('');
}

export function openMarketDetail(id) {
  const item = marketData.find(row => String(row.id) === String(id));
  if (!item) return;
  const bodyHtml = `
    <div style="margin-bottom:14px"><span class="badge-verified">✓ Published reference observation</span></div>
    <div class="modal-grid" style="margin-bottom:16px">
      <div class="modal-box"><h4>Commodity & unit</h4><p><strong>${escapeHtml(item.crop)}</strong> (${escapeHtml(item.category)})</p><p>Trading unit: <strong>${escapeHtml(item.unit)}</strong></p></div>
      <div class="modal-box"><h4>Market</h4><p><strong>${escapeHtml(item.marketName)}</strong></p><p>${escapeHtml(item.district)} District, ${escapeHtml(item.region)} Region, Malawi</p></div>
    </div>
    <div style="background:#f4f9f5;border:1px solid #dbeae0;border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;color:#52645a;font-weight:700">PUBLISHED REFERENCE PRICE</div>
      <div style="font-size:24px;font-weight:900;color:var(--forest);margin:4px 0">MWK ${money(item.priceMin)}${Number(item.priceMin) === Number(item.priceMax) ? '' : ' – ' + money(item.priceMax)}</div>
      <div style="font-size:12px;color:#355340">Per ${escapeHtml(item.unit)} • Observed ${escapeHtml(item.dateReported)}</div>
    </div>
    <h3>Observation notes</h3><p>${escapeHtml(item.notes || 'No additional notes supplied.')}</p>
    <h3>Source and verification</h3>
    <p><strong>Source:</strong> ${escapeHtml(item.sourceName || item.reporter || 'Not recorded')}<br>
    <strong>Price basis:</strong> ${escapeHtml(item.priceBasis || 'Not specified')}<br>
    <strong>Record reference:</strong> ${escapeHtml(item.sourceReference || 'Not supplied')}<br>
    ${item.sourceUrl ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source record</a><br>` : ''}
    <strong>Data type:</strong> ${escapeHtml(item.sourceType || 'Published reference')}</p>
    <div class="notice"><strong>Important:</strong> This is a dated reference observation, not a live offer or guaranteed transaction price. Confirm today's price, quality grade and unit directly with the market before trading.</div>
  `;
  openModal({ title: `${item.crop} @ ${item.marketName}`, subtitle: `${item.district} District • MWK ${money(item.priceMin)} – ${money(item.priceMax)}`, bodyHtml });
}

async function loadWorldBankMarketEstimates() {
  const tbody = document.getElementById('worldBankMarketTableBody');
  const meta = document.getElementById('worldBankMarketMeta');
  if (!tbody) return;
  if (meta) meta.textContent = 'External modeled estimates are not connected yet. Published market observations are shown above.';
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">No verified estimate feed is connected. This section will be enabled when a reliable dataset refresh is configured.</td></tr>';
}

export function initMarketCentre() {
  const crop = document.getElementById('marketCropFilter');
  const district = document.getElementById('marketDistrictFilter');
  const status = document.getElementById('marketStatusFilter');
  const search = document.getElementById('marketSearch');
  const reset = document.getElementById('resetMarketFilters');
  [crop,district,status].filter(Boolean).forEach(el => el.addEventListener('change', renderMarketTable));
  if (search) search.addEventListener('input', renderMarketTable);
  if (reset) reset.addEventListener('click', () => {
    if (crop) crop.value = 'all';
    if (district) district.value = 'all';
    if (status) status.value = 'all';
    if (search) search.value = '';
    renderMarketTable();
    showToast('Market filters reset');
  });
  if (document.getElementById('marketTableBody')) {
    loadMarketData();
    loadWorldBankMarketEstimates();
  }
}

document.addEventListener('DOMContentLoaded', initMarketCentre);
