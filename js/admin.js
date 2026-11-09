/**
 * Ulimi wa Malawi | Market Price Administration V6
 * Admin writes are stored centrally in Supabase and protected by admin_access RLS.
 */
import { escapeHtml, showToast } from './main.js';
import { supabase } from './auth.js';

let rows = [];
let adminUser = null;

const toUi = row => ({
  id: row.id, crop: row.crop_name, marketName: row.market_name, district: row.district,
  unit: row.unit, priceMin: Number(row.price_min), priceMax: Number(row.price_max),
  currency: row.currency || 'MWK', status: row.status, dateReported: row.date_observed,
  reporter: row.reporter_name || row.source_name || 'Admin'
});

function money(value) {
  return new Intl.NumberFormat('en-MW', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

async function requireAdmin() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    window.location.assign('../login.html?redirect=' + encodeURIComponent('/pages/admin.html') + '&admin=true');
    return false;
  }
  const { data, error } = await supabase.from('admin_access').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) {
    showToast('Administrator access is required.');
    window.location.assign('../index.html');
    return false;
  }
  adminUser = user;
  return true;
}

async function loadRows() {
  const { data, error } = await supabase.from('market_price_reports')
    .select('*').order('created_at', { ascending: false });
  if (error) throw error;
  rows = data || [];
  renderAdminTable();
}

function renderAdminTable() {
  const body = document.getElementById('adminPriceTableBody');
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">No market price records found.</td></tr>';
    return;
  }
  body.innerHTML = rows.map(raw => {
    const item = toUi(raw);
    const statusLabel = item.status === 'verified' ? '✓ Verified' : item.status === 'rejected' ? 'Rejected' : '⏳ Pending review';
    return `<tr>
      <td><strong>${escapeHtml(item.crop)}</strong></td>
      <td>${escapeHtml(item.marketName)} (${escapeHtml(item.district)})</td>
      <td>${escapeHtml(item.unit)}</td>
      <td>MWK ${money(item.priceMin)} – ${money(item.priceMax)}</td>
      <td><span class="${item.status === 'verified' ? 'badge-verified' : 'badge-unverified'}">${statusLabel}</span></td>
      <td style="font-size:11px;color:#617268">${escapeHtml(item.dateReported)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${item.status !== 'verified' ? `<button class="action-btn action-verify" data-verify="${escapeHtml(item.id)}">Approve</button>` : `<button class="action-btn" data-pend="${escapeHtml(item.id)}">Unpublish</button>`}
        <button class="action-btn action-delete" data-delete="${escapeHtml(item.id)}">Delete</button>
      </td>
    </tr>`;
  }).join('');

  body.querySelectorAll('[data-verify]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.verify, 'verified')));
  body.querySelectorAll('[data-pend]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.pend, 'pending')));
  body.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteRow(btn.dataset.delete)));
}

async function updateStatus(id, status) {
  const patch = {
    status,
    verified_by: status === 'verified' ? adminUser.id : null,
    verified_at: status === 'verified' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('market_price_reports').update(patch).eq('id', id);
  if (error) { showToast('Could not update the market record.'); console.error(error); return; }
  await loadRows();
  showToast(status === 'verified' ? 'Price approved and published.' : 'Price unpublished.');
}

async function deleteRow(id) {
  if (!confirm('Delete this market price report permanently?')) return;
  const { error } = await supabase.from('market_price_reports').delete().eq('id', id);
  if (error) { showToast('Could not delete this record.'); console.error(error); return; }
  await loadRows();
  showToast('Market price record deleted.');
}

function initForm() {
  const form = document.getElementById('addPriceForm');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const value = id => document.getElementById(id)?.value?.trim() || '';
    const crop = value('adminCropName');
    const market = value('adminMarketName');
    const unit = value('adminUnit');
    const min = Number(value('adminPriceMin'));
    const max = Number(value('adminPriceMax'));
    if (!crop || !market || !unit || !Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
      showToast('Enter a crop, market, unit and valid price range (maximum must be at least minimum).');
      return;
    }
    const requestedStatus = value('adminStatus');
    const status = requestedStatus === 'verified' ? 'verified' : 'pending';
    const { error } = await supabase.from('market_price_reports').insert({
      crop_name: crop,
      crop_key: crop.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: value('adminCropCategory') || 'Other',
      market_name: market,
      district: value('adminDistrict'),
      region: value('adminRegion'),
      unit,
      price_min: min,
      price_max: max,
      currency: 'MWK',
      date_observed: new Date().toISOString().slice(0,10),
      status,
      source_type: 'admin',
      source_name: 'Ulimi wa Malawi Admin Desk',
      price_basis: 'Admin-entered market observation',
      reporter_name: value('adminReporter') || 'Ulimi market team',
      notes: value('adminNotes') || null,
      reporter_user_id: adminUser.id,
      verified_by: status === 'verified' ? adminUser.id : null,
      verified_at: status === 'verified' ? new Date().toISOString() : null
    });
    if (error) { showToast('Price could not be saved. Check the fields and try again.'); console.error(error); return; }
    form.reset();
    await loadRows();
    showToast(status === 'verified' ? 'Price saved and published.' : 'Price saved for review.');
  });
}

export async function initAdminPriceManagement() {
  const body = document.getElementById('adminPriceTableBody');
  if (!body) return;
  const allowed = await requireAdmin();
  if (!allowed) return;
  initForm();
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    await supabase.auth.signOut();
    window.location.assign('../login.html?admin=true');
  });
  const resetBtn = document.getElementById('resetDefaultPricesBtn');
  if (resetBtn) resetBtn.hidden = true; // shared records must never be wiped by a local reset button
  try {
    await loadRows();
  } catch (error) {
    console.error('Unable to load market price admin records:', error);
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">Unable to load shared market records. Please refresh.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', initAdminPriceManagement);
