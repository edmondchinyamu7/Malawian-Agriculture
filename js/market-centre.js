/**
 * Ulimi wa Malawi | V5 Agricultural Market Information Centre
 */
import { escapeHtml, openModal, showToast } from './main.js';

let marketData = [];
const STORAGE_KEY = 'ulimi_markets_v5';

export async function loadMarketData() {
  try {
    // Check localStorage first for any local entries/updates
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      marketData = JSON.parse(stored);
    } else {
      const basePath = window.location.pathname.includes('/pages/') ? '../data/' : 'data/';
      const response = await fetch(`${basePath}markets.json`);
      if (!response.ok) throw new Error('Failed to load market data');
      marketData = await response.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(marketData));
    }
    renderMarketStats();
    renderMarketTable();
    renderPriceComparison();
  } catch (err) {
    console.error('Error loading market data:', err);
  }
}

export function saveMarketData(data) {
  marketData = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderMarketStats();
  renderMarketTable();
  renderPriceComparison();
}

export function getMarketData() {
  return marketData;
}

export function renderMarketStats() {
  const container = document.getElementById('marketStatsRow');
  if (!container) return;

  const totalEntries = marketData.length;
  const verifiedEntries = marketData.filter(m => m.status === 'verified').length;
  const uniqueCrops = new Set(marketData.map(m => m.crop)).size;
  const uniqueDistricts = new Set(marketData.map(m => m.district)).size;

  container.innerHTML = `
    <div class="market-stat-card">
      <small>Monitored Crops</small>
      <strong>${uniqueCrops}</strong>
      <span>Key agricultural commodities</span>
    </div>
    <div class="market-stat-card">
      <small>Active Markets</small>
      <strong>${uniqueDistricts} Districts</strong>
      <span>Trading centres across Malawi</span>
    </div>
    <div class="market-stat-card">
      <small>Price Reports</small>
      <strong>${totalEntries} Listings</strong>
      <span>Regular field updates</span>
    </div>
    <div class="market-stat-card">
      <small>Data Quality</small>
      <strong>${Math.round((verifiedEntries / totalEntries) * 100)}% Verified</strong>
      <span>${verifiedEntries} verified by extension boards</span>
    </div>
  `;
}

export function renderMarketTable() {
  const tbody = document.getElementById('marketTableBody');
  const cropSelect = document.getElementById('marketCropFilter');
  const districtSelect = document.getElementById('marketDistrictFilter');
  const statusSelect = document.getElementById('marketStatusFilter');
  const searchInput = document.getElementById('marketSearch');
  const countEl = document.getElementById('marketRecordCount');

  if (!tbody) return;

  const selectedCrop = cropSelect?.value || 'all';
  const selectedDistrict = districtSelect?.value || 'all';
  const selectedStatus = statusSelect?.value || 'all';
  const query = (searchInput?.value || '').trim().toLowerCase();

  const filtered = marketData.filter(item => {
    const matchCrop = selectedCrop === 'all' || item.cropKey === selectedCrop || item.crop.toLowerCase().includes(selectedCrop.toLowerCase());
    const matchDistrict = selectedDistrict === 'all' || item.district === selectedDistrict;
    const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;
    const matchQuery = !query || [
      item.crop,
      item.marketName,
      item.district,
      item.region,
      item.notes || '',
      item.reporter || ''
    ].join(' ').toLowerCase().includes(query);
    return matchCrop && matchDistrict && matchStatus && matchQuery;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} of ${marketData.length} records`;
  }

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:36px;color:#718078;">
          No matching market records found. Try adjusting your filters or search keywords.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const isVerified = item.status === 'verified';
    const statusBadge = isVerified
      ? `<span class="badge-verified" title="Verified by official trade monitoring or ADD desk">✓ Verified</span>`
      : `<span class="badge-unverified" title="Submitted by local traders; awaiting official cross-check">⏳ Unverified</span>`;

    return `
      <tr>
        <td class="crop-col">
          <strong>${escapeHtml(item.crop)}</strong>
          <div style="font-size:11px;color:#617368">${escapeHtml(item.category)}</div>
        </td>
        <td>
          <strong>${escapeHtml(item.marketName)}</strong>
          <div style="font-size:11px;color:#617368">${escapeHtml(item.district)} (${escapeHtml(item.region)})</div>
        </td>
        <td>${escapeHtml(item.unit)}</td>
        <td class="price-val">
          ${item.currency} ${Number(item.priceMin).toLocaleString()} – ${Number(item.priceMax).toLocaleString()}
        </td>
        <td>${statusBadge}</td>
        <td style="font-size:12px;color:#52645a">
          ${escapeHtml(item.dateReported)}
          <div style="font-size:10px;color:#809488">${escapeHtml(item.reporter || 'Field survey')}</div>
        </td>
        <td>
          <button class="btn" style="padding:6px 10px;font-size:11px;background:#edf5ef;color:var(--forest)" onclick="window.viewMarketDetail('${item.id}')">
            Details
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

export function renderPriceComparison() {
  const container = document.getElementById('priceComparisonGrid');
  if (!container) return;

  // Group by crop to show price spread between districts
  const crops = ['maize', 'groundnut', 'rice'];
  const cropLabels = {
    maize: 'Chimanga (Maize, 50kg bag)',
    groundnut: 'Mtedza (Groundnuts, 1kg shelled)',
    rice: 'Mpunga (Kilombero Rice, 1kg milled)'
  };

  container.innerHTML = crops.map(key => {
    const records = marketData.filter(m => m.cropKey === key);
    if (!records.length) return '';

    const pricesMin = records.map(r => r.priceMin);
    const pricesMax = records.map(r => r.priceMax);
    const lowest = Math.min(...pricesMin);
    const highest = Math.max(...pricesMax);
    const lowestRecord = records.find(r => r.priceMin === lowest);
    const highestRecord = records.find(r => r.priceMax === highest);

    return `
      <div class="compare-card">
        <span class="region-tag">Spread Analysis</span>
        <h4>${escapeHtml(cropLabels[key] || key)}</h4>
        <div class="price-spread">
          MWK ${lowest.toLocaleString()} – ${highest.toLocaleString()}
        </div>
        <p style="font-size:12px;margin:6px 0;color:#405247;line-height:1.5">
          <strong>Lowest:</strong> MWK ${lowest.toLocaleString()} in ${escapeHtml(lowestRecord?.marketName || '')} (${escapeHtml(lowestRecord?.district || '')})<br>
          <strong>Highest:</strong> MWK ${highest.toLocaleString()} in ${escapeHtml(highestRecord?.marketName || '')} (${escapeHtml(highestRecord?.district || '')})
        </p>
        <div style="font-size:11px;color:#617368;margin-top:6px">
          Spread: MWK ${(highest - lowest).toLocaleString()} between surplus & consumer markets.
        </div>
      </div>
    `;
  }).join('');
}

export function openMarketDetail(id) {
  const item = marketData.find(m => m.id === id);
  if (!item) return;

  const isVerified = item.status === 'verified';
  const statusHtml = isVerified
    ? `<span class="badge-verified">✓ Official Verified Market Report</span>`
    : `<span class="badge-unverified">⏳ Unverified Community Report (Verification in Progress)</span>`;

  const bodyHtml = `
    <div style="margin-bottom:14px">${statusHtml}</div>
    <div class="modal-grid" style="margin-bottom:16px">
      <div class="modal-box">
        <h4>Commodity & Unit</h4>
        <p><strong>${escapeHtml(item.crop)}</strong> (${escapeHtml(item.category)})</p>
        <p>Trading Unit: <strong>${escapeHtml(item.unit)}</strong></p>
      </div>
      <div class="modal-box">
        <h4>Market & District</h4>
        <p><strong>${escapeHtml(item.marketName)}</strong></p>
        <p>${escapeHtml(item.district)} District, ${escapeHtml(item.region)} Malawi</p>
      </div>
    </div>
    <div style="background:#f4f9f5;border:1px solid #dbeae0;border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;color:#52645a;font-weight:700">REPORTED TRADING RANGE</div>
      <div style="font-size:24px;font-weight:900;color:var(--forest);margin:4px 0">
        ${item.currency} ${Number(item.priceMin).toLocaleString()} – ${Number(item.priceMax).toLocaleString()}
      </div>
      <div style="font-size:12px;color:#355340">Unit: ${escapeHtml(item.unit)}</div>
    </div>
    <h3>Market Observation & Quality Notes</h3>
    <p>${escapeHtml(item.notes || 'Normal market trading conditions.')}</p>
    <h3>Source & Verification Audit</h3>
    <p>
      <strong>Reporting Source:</strong> ${escapeHtml(item.reporter || 'Field trade surveyor')}<br>
      <strong>Date of Observation:</strong> ${escapeHtml(item.dateReported)}<br>
      <strong>Verification Status:</strong> ${item.status.toUpperCase()}
    </p>
    <div class="notice">
      <strong>Important Market Notice:</strong> Prices reflect spot trading observations at specific times and can fluctuate daily based on transport costs, moisture grade, sorting, and wholesale volumes. Never make speculative decisions without direct local confirmation.
    </div>
  `;

  openModal({
    title: `${item.crop} @ ${item.marketName}`,
    subtitle: `${item.district} District • ${item.currency} ${item.priceMin.toLocaleString()} – ${item.priceMax.toLocaleString()}`,
    bodyHtml
  });
}

// Global hook for inline table buttons
window.viewMarketDetail = openMarketDetail;

export function initMarketCentre() {
  const cropSelect = document.getElementById('marketCropFilter');
  const districtSelect = document.getElementById('marketDistrictFilter');
  const statusSelect = document.getElementById('marketStatusFilter');
  const searchInput = document.getElementById('marketSearch');
  const resetBtn = document.getElementById('resetMarketFilters');

  if (cropSelect) cropSelect.addEventListener('change', renderMarketTable);
  if (districtSelect) districtSelect.addEventListener('change', renderMarketTable);
  if (statusSelect) statusSelect.addEventListener('change', renderMarketTable);
  if (searchInput) searchInput.addEventListener('input', renderMarketTable);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (cropSelect) cropSelect.value = 'all';
      if (districtSelect) districtSelect.value = 'all';
      if (statusSelect) statusSelect.value = 'all';
      if (searchInput) searchInput.value = '';
      renderMarketTable();
      showToast('Market filters reset');
    });
  }

  // Load data if market elements exist on this page
  if (document.getElementById('marketTableBody')) {
    loadMarketData();
  }
}

document.addEventListener('DOMContentLoaded', initMarketCentre);
