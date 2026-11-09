/**
 * Ulimi wa Malawi | Admin Management System (V5 Price Management)
 */
import { escapeHtml, showToast } from './main.js';
import { getMarketData, saveMarketData, loadMarketData } from './market-centre.js';

export function initAdminPriceManagement() {
  const form = document.getElementById('addPriceForm');
  const tableBody = document.getElementById('adminPriceTableBody');
  const resetBtn = document.getElementById('resetDefaultPricesBtn');

  if (!tableBody) return;

  // Verify server-side administrator session
  fetch('/api/admin/session', { credentials: 'same-origin' })
    .then(r => {
      if (!r.ok) {
        window.location.assign('/login.html?redirect=' + encodeURIComponent(window.location.pathname) + '&admin=true');
      }
    })
    .catch(() => {});

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) {}
    window.location.assign('/login.html?admin=true');
  });

  function renderAdminTable() {
    const data = getMarketData();
    if (!data.length) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">No price records found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = data.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.crop)}</strong></td>
        <td>${escapeHtml(item.marketName)} (${escapeHtml(item.district)})</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>${item.currency} ${Number(item.priceMin).toLocaleString()} – ${Number(item.priceMax).toLocaleString()}</td>
        <td>
          <button class="action-btn ${item.status === 'verified' ? 'action-verify' : ''}" style="${item.status === 'unverified' ? 'background:#fff3d6;color:#8f5300' : ''}" onclick="window.togglePriceVerification('${item.id}')">
            ${item.status === 'verified' ? '✓ Verified' : '⏳ Mark Verified'}
          </button>
        </td>
        <td style="font-size:11px;color:#617268">${escapeHtml(item.dateReported)}</td>
        <td>
          <button class="action-btn action-delete" onclick="window.deletePriceRecord('${item.id}')">
            Delete
          </button>
        </td>
      </tr>
    `).join('');
  }

  // Handle form submission
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const crop = document.getElementById('adminCropName')?.value.trim();
      const category = document.getElementById('adminCropCategory')?.value;
      const marketName = document.getElementById('adminMarketName')?.value.trim();
      const district = document.getElementById('adminDistrict')?.value;
      const region = document.getElementById('adminRegion')?.value;
      const unit = document.getElementById('adminUnit')?.value.trim();
      const priceMin = Number(document.getElementById('adminPriceMin')?.value);
      const priceMax = Number(document.getElementById('adminPriceMax')?.value);
      const status = document.getElementById('adminStatus')?.value || 'unverified';
      const reporter = document.getElementById('adminReporter')?.value.trim();
      const notes = document.getElementById('adminNotes')?.value.trim();

      if (!crop || !marketName || !unit || isNaN(priceMin) || isNaN(priceMax) || priceMin <= 0 || priceMax < priceMin) {
        showToast('Please provide valid crop, market, and price values (Max >= Min).');
        return;
      }

      const newEntry = {
        id: `mkt-custom-${Date.now()}`,
        crop,
        cropKey: crop.toLowerCase().split(' ')[0],
        category,
        marketName,
        district,
        region,
        unit,
        priceMin,
        priceMax,
        currency: 'MWK',
        dateReported: new Date().toISOString().split('T')[0],
        status,
        reporter: reporter || 'Admin submission',
        notes: notes || 'Submitted through administrative portal.'
      };

      const current = getMarketData();
      saveMarketData([newEntry, ...current]);
      form.reset();
      renderAdminTable();
      showToast('New market price entry saved successfully.');
    });
  }

  // Global actions for inline buttons
  window.togglePriceVerification = function(id) {
    const current = getMarketData();
    const updated = current.map(item => {
      if (item.id === id) {
        const nextStatus = item.status === 'verified' ? 'unverified' : 'verified';
        return { ...item, status: nextStatus };
      }
      return item;
    });
    saveMarketData(updated);
    renderAdminTable();
    showToast('Verification label updated.');
  };

  window.deletePriceRecord = function(id) {
    if (!confirm('Are you sure you want to delete this price record?')) return;
    const current = getMarketData();
    const updated = current.filter(item => item.id !== id);
    saveMarketData(updated);
    renderAdminTable();
    showToast('Price record deleted.');
  };

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset market data back to official baseline records? Custom entries will be cleared.')) return;
      localStorage.removeItem('ulimi_markets_v5');
      await loadMarketData();
      renderAdminTable();
      showToast('Market records reset to baseline.');
    });
  }

  // Initial load
  loadMarketData().then(renderAdminTable);
}

document.addEventListener('DOMContentLoaded', initAdminPriceManagement);
