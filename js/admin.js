/**
 * Ulimi wa Malawi | Administration Portal
 * Coordinates server admin cookie + Supabase admin_access RLS verification,
 * market price moderation, and pending subscription approvals.
 */
import { escapeHtml, showToast } from './main.js';
import { supabase } from './auth.js';
import { getIconSvg } from './icons.js';

let rows = [];
let pendingSubs = [];
let adminUser = null; // Supabase auth user in admin_access (if signed in)
let serverAdminSession = null;
let pendingDeleteId = null;

const toUi = row => ({
  id: row.id,
  crop: row.crop_name,
  marketName: row.market_name,
  district: row.district,
  unit: row.unit,
  priceMin: Number(row.price_min),
  priceMax: Number(row.price_max),
  currency: row.currency || 'MWK',
  status: row.status,
  dateReported: row.date_observed,
  sourceType: row.source_type || 'admin',
  reporter: row.reporter_name || row.source_name || 'Admin'
});

function money(value) {
  return new Intl.NumberFormat('en-MW', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function updateOverviewSummary() {
  const counts = {
    total: rows.length,
    verified: rows.filter(row => row.status === 'verified').length,
    pending: rows.filter(row => row.status === 'pending').length,
    rejected: rows.filter(row => row.status === 'rejected').length,
    subscriptions: pendingSubs.length,
    active: pendingSubs.filter(sub => sub.status === 'active').length
  };
  const values = {
    overviewPriceTotal: counts.total,
    overviewPriceVerified: counts.verified,
    overviewPricePending: counts.pending,
    overviewPriceRejected: counts.rejected,
    overviewSubscriptionTotal: counts.subscriptions,
    overviewSubscriptionActive: counts.active
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = money(value);
  });
  const updated = document.getElementById('adminSummaryUpdated');
  if (updated) updated.textContent = 'Updated ' + new Intl.DateTimeFormat('en-MW', {
    dateStyle: 'medium', timeStyle: 'short'
  }).format(new Date());
  renderOverviewVisuals();
}

function renderOverviewVisuals() {
  const trend = document.getElementById('adminPriceTrend');
  if (trend) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const label = date.toLocaleDateString('en-MW', { month: 'short' });
      const count = rows.filter(row => String(row.date_observed || row.created_at || '').slice(0, 7) === key).length;
      return { key, label, count };
    });
    const max = Math.max(1, ...months.map(item => item.count));
    trend.innerHTML = months.map(item => {
      const height = Math.max(5, Math.round((item.count / max) * 100));
      return '<div class="admin-trend-column" title="' + escapeHtml(item.label + ': ' + item.count + ' records') + '">' +
        '<span class="admin-trend-value">' + money(item.count) + '</span>' +
        '<div class="admin-trend-bar-track"><span style="height:' + height + '%"></span></div>' +
        '<span class="admin-trend-label">' + escapeHtml(item.label) + '</span></div>';
    }).join('');
  }

  const distribution = document.getElementById('adminStatusDistribution');
  if (distribution) {
    const statuses = [
      { key: 'verified', label: 'Verified', color: '#35c78a' },
      { key: 'pending', label: 'Pending review', color: '#f4b44e' },
      { key: 'rejected', label: 'Rejected', color: '#f06b76' },
      { key: 'other', label: 'Other', color: '#7886a8' }
    ];
    const total = rows.length;
    let cursor = 0;
    const segments = statuses.map(item => {
      const count = item.key === 'other'
        ? rows.filter(row => !['verified', 'pending', 'rejected'].includes(row.status)).length
        : rows.filter(row => row.status === item.key).length;
      const start = cursor;
      cursor += total ? count / total * 100 : 0;
      return { ...item, count, start, end: cursor };
    });
    const gradient = total
      ? 'conic-gradient(' + segments.map(item => item.color + ' ' + item.start + '% ' + item.end + '%').join(',') + ')'
      : 'conic-gradient(#34415f 0% 100%)';
    distribution.innerHTML = '<div class="admin-donut" style="--admin-donut:' + gradient + '"><div><strong>' + money(total) + '</strong><span>Records</span></div></div>' +
      '<div class="admin-donut-legend">' + segments.map(item =>
        '<div><i style="--legend-color:' + item.color + '"></i><span>' + item.label + '</span><strong>' + money(item.count) + '</strong></div>'
      ).join('') + '</div>';
  }

  const recent = document.getElementById('adminRecentMarketActivity');
  if (recent) {
    const latest = [...rows].sort((a, b) =>
      String(b.created_at || b.date_observed || '').localeCompare(String(a.created_at || a.date_observed || ''))
    ).slice(0, 5);
    recent.innerHTML = latest.length ? latest.map(row => {
      const status = row.status || 'unknown';
      const crop = escapeHtml(row.crop_name || 'Unnamed crop');
      const market = escapeHtml([row.market_name, row.district].filter(Boolean).join(', ') || 'Market not specified');
      const date = escapeHtml(row.date_observed || 'Date not recorded');
      return '<div class="admin-recent-row"><span class="admin-recent-icon">' + getIconSvg('wheat') + '</span><div class="admin-recent-copy"><strong>' + crop + '</strong><small>' + market + ' · ' + date + '</small></div><span class="admin-status-pill is-' + escapeHtml(status) + '">' + escapeHtml(status.replace('_', ' ')) + '</span></div>';
    }).join('') : '<p class="admin-empty-state">No market price records are available yet.</p>';
  }

  const subscriptionCounts = {
    total: pendingSubs.length,
    active: pendingSubs.filter(item => item.status === 'active').length,
    pending: pendingSubs.filter(item => item.status === 'pending').length
  };
  const visualValues = {
    overviewSubscriptionTotalVisual: subscriptionCounts.total,
    overviewSubscriptionActiveVisual: subscriptionCounts.active,
    overviewSubscriptionPendingVisual: subscriptionCounts.pending
  };
  Object.entries(visualValues).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = money(value);
  });
}

function showAdminView(view) {
  const sections = [...document.querySelectorAll('[data-admin-view-section]')];
  sections.forEach(section => {
    section.hidden = section.dataset.adminViewSection !== view;
  });
  const links = [...document.querySelectorAll('[data-admin-view]')];
  links.forEach(link => {
    const active = link.dataset.adminView === view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const target = document.querySelector('[data-admin-view-section="' + view + '"]');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (view === 'farmers') loadFarmersView();
  if (view === 'settings') renderAdminSettings();
}

function initAdminSidebarNavigation() {
  const links = [...document.querySelectorAll('[data-admin-view]')];
  if (!links.length) return;
  const hashToView = {
    '#adminOverview': 'overview',
    '#farmersView': 'farmers',
    '#priceManagement': 'prices',
    '#marketPriceDirectory': 'prices',
    '#websiteContentView': 'content',
    '#botKnowledgeView': 'knowledge',
    '#messagesView': 'messages',
    '#settingsView': 'settings',
    '#subscriptionApprovals': 'approvals',
    '#financeDashboard': 'finance'
  };
  links.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const view = link.dataset.adminView;
    showAdminView(view);
    history.replaceState(null, '', link.getAttribute('href'));
  }));
  const initialView = hashToView[window.location.hash] || 'overview';
  showAdminView(initialView);
}

let farmerProfiles = [];
let farmersLoaded = false;

const safeField = (record, names) => {
  for (const name of names) {
    const value = record?.[name];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
};

function renderFarmersTable() {
  const tbody = document.getElementById('farmersTableBody');
  if (!tbody) return;
  const query = (document.getElementById('farmersSearch')?.value || '').trim().toLowerCase();
  const districtFilter = document.getElementById('farmersDistrictFilter')?.value || '';
  const filtered = farmerProfiles.filter(profile => {
    const name = safeField(profile, ['full_name', 'name', 'display_name', 'first_name']);
    const email = safeField(profile, ['email']);
    const phone = safeField(profile, ['phone', 'phone_number', 'mobile']);
    const district = safeField(profile, ['district', 'home_district', 'location']);
    const matchesQuery = !query || [name, email, phone, district, profile.id, profile.role].join(' ').toLowerCase().includes(query);
    return matchesQuery && (!districtFilter || district === districtFilter);
  });
  tbody.innerHTML = filtered.length ? filtered.map(profile => {
    const name = safeField(profile, ['full_name', 'name', 'display_name']) || 'Farmer account';
    const contact = safeField(profile, ['email', 'phone', 'phone_number', 'mobile']) || 'Not provided in profile';
    const district = safeField(profile, ['district', 'home_district', 'location']) || 'Not provided';
    const role = safeField(profile, ['role']) || 'farmer';
    const created = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-MW') : 'Not recorded';
    return '<tr><td><strong>' + escapeHtml(name) + '</strong><div class="admin-table-subtext">' + escapeHtml(String(profile.id || '').slice(0, 12)) + '</div></td><td>' + escapeHtml(contact) + '</td><td>' + escapeHtml(district) + '</td><td>' + escapeHtml(role) + '</td><td>' + escapeHtml(created) + '</td></tr>';
  }).join('') : '<tr><td colspan="5">No matching farmer profile records.</td></tr>';
  const displayed = document.getElementById('farmersDisplayed');
  if (displayed) displayed.textContent = filtered.length.toLocaleString('en-MW');
}

async function loadFarmersView(force = false) {
  const tbody = document.getElementById('farmersTableBody');
  if (!tbody || (farmersLoaded && !force)) return;
  tbody.innerHTML = '<tr><td colspan="5">Loading farmer records…</td></tr>';
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('role', 'admin')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    tbody.innerHTML = '<tr><td colspan="5">Unable to load farmer profiles: ' + escapeHtml(error.message) + '</td></tr>';
    const note = document.getElementById('farmersDataNote');
    if (note) note.textContent = 'The profile query failed. Check Supabase table access and Row Level Security policies.';
    return;
  }
  farmerProfiles = data || [];
  farmersLoaded = true;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = farmerProfiles.filter(profile => profile.created_at && new Date(profile.created_at).getTime() >= weekAgo).length;
  const total = document.getElementById('farmersTotal');
  const fresh = document.getElementById('farmersNewWeek');
  if (total) total.textContent = farmerProfiles.length.toLocaleString('en-MW') + (farmerProfiles.length === 100 ? '+' : '');
  if (fresh) fresh.textContent = newThisWeek.toLocaleString('en-MW');
  const districts = [...new Set(farmerProfiles.map(profile => safeField(profile, ['district', 'home_district', 'location'])).filter(Boolean))].sort();
  const select = document.getElementById('farmersDistrictFilter');
  if (select) select.innerHTML = '<option value="">All districts</option>' + districts.map(d => '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + '</option>').join('');
  const note = document.getElementById('farmersDataNote');
  if (note) note.textContent = farmerProfiles.length === 100
    ? 'Showing the latest 100 non-admin profiles. The full profile count is not inferred from this limited list.'
    : 'Showing all non-admin profile records returned by Supabase. Missing profile fields are not invented.';
  renderFarmersTable();
}

function renderAdminSettings() {
  const email = document.getElementById('settingsAdminEmail');
  const session = document.getElementById('settingsSessionStatus');
  const database = document.getElementById('settingsDatabaseStatus');
  if (email) email.textContent = adminUser?.email || serverAdminSession?.username || 'Verified admin session';
  if (session) session.textContent = serverAdminSession ? 'Active' : 'Not verified';
  if (database) database.textContent = adminUser ? 'Supabase admin access verified' : 'Supabase admin link required for database changes';
}

function initAdminViewControls() {
  document.getElementById('farmersSearch')?.addEventListener('input', renderFarmersTable);
  document.getElementById('farmersDistrictFilter')?.addEventListener('change', renderFarmersTable);
  document.getElementById('farmersRefreshBtn')?.addEventListener('click', () => loadFarmersView(true));
  const logout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    await supabase.auth.signOut();
    window.location.assign('../login.html?admin=true');
  };
  document.getElementById('settingsLogoutBtn')?.addEventListener('click', logout);
}

async function checkServerAdminSession() {
  try {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user : null;
  } catch {
    return null;
  }
}

async function syncServerAdminSessionFromSupabase() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ accessToken: session.access_token })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user : null;
  } catch {
    return null;
  }
}

async function checkSupabaseAdmin() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data, error: aaErr } = await supabase
      .from('admin_access')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (aaErr || !data) return null;
    return user;
  } catch {
    return null;
  }
}

async function requireAdmin() {
  let [srvSession, sbAdmin] = await Promise.all([
    checkServerAdminSession(),
    checkSupabaseAdmin()
  ]);

  if (!srvSession && sbAdmin) {
    srvSession = await syncServerAdminSessionFromSupabase();
  }

  serverAdminSession = srvSession;
  adminUser = sbAdmin;

  if (!serverAdminSession) {
    window.location.replace('../login.html?redirect=' + encodeURIComponent('/pages/admin.html') + '&admin=true');
    return false;
  }

  if (serverAdminSession.authMethod === 'supabase' && !adminUser) {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    window.location.replace('../login.html?redirect=' + encodeURIComponent('/pages/admin.html') + '&admin=true');
    return false;
  }

  renderSupabaseAdminLinkNotice();
  return true;
}

function renderSupabaseAdminLinkNotice() {
  const banner = document.getElementById('adminRlsBanner');
  if (!banner) return;

  if (adminUser) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;
  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">
      <div>
        <strong>${getIconSvg('shield')} Server Admin Session Active (${escapeHtml(serverAdminSession?.username || 'admin')})</strong>
        <p style="margin:4px 0 0;font-size:13px;color:#4e5f55">
          Writing market prices or approving subscriptions in Supabase requires an active Supabase Auth user listed in <code>admin_access</code> under Row-Level Security (RLS). Sign in below to enable database writes in this session:
        </p>
      </div>
      <form id="inlineSupabaseAdminForm" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="inlineSbEmail" type="email" placeholder="Admin Supabase email" required style="padding:8px 10px;border:1px solid #cbd9cf;border-radius:8px;font-size:13px">
        <input id="inlineSbPassword" type="password" placeholder="Password" required style="padding:8px 10px;border:1px solid #cbd9cf;border-radius:8px;font-size:13px">
        <button type="submit" class="btn btn-primary" style="padding:8px 14px;font-size:13px">Connect Supabase Admin</button>
      </form>
    </div>
  `;

  const inlineForm = document.getElementById('inlineSupabaseAdminForm');
  if (inlineForm) {
    inlineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('inlineSbEmail')?.value?.trim();
      const password = document.getElementById('inlineSbPassword')?.value;
      if (!email || !password) return;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showToast('Supabase sign-in failed: ' + error.message);
        return;
      }
      adminUser = await checkSupabaseAdmin();
      if (!adminUser) {
        await supabase.auth.signOut();
        showToast('Signed in, but this user is not listed in public.admin_access.');
        return;
      }
      const synced = await syncServerAdminSessionFromSupabase();
      if (synced) serverAdminSession = synced;
      showToast('Supabase admin RLS access connected.');
      renderSupabaseAdminLinkNotice();
      await Promise.all([loadRows(), loadPendingSubscriptions()]);
    });
  }
}

async function loadRows() {
  const body = document.getElementById('adminPriceTableBody');
  if (!body) return;
  const { data, error } = await supabase
    .from('market_price_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  rows = data || [];
  renderAdminTable();
  updateOverviewSummary();
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
    const statusLabel = item.status === 'verified'
      ? '✓ Verified'
      : item.status === 'rejected'
        ? 'Rejected'
        : 'Pending review';
    const confirming = pendingDeleteId === String(item.id);
    return `<tr>
      <td><strong>${escapeHtml(item.crop)}</strong><div style="font-size:11px;color:#617268">${escapeHtml(item.sourceType === 'farmer' ? 'Farmer report' : 'Admin desk')}</div></td>
      <td>${escapeHtml(item.marketName)} (${escapeHtml(item.district)})</td>
      <td>${escapeHtml(item.unit)}</td>
      <td>MWK ${money(item.priceMin)} – ${money(item.priceMax)}</td>
      <td><span class="${item.status === 'verified' ? 'badge-verified' : 'badge-unverified'}">${escapeHtml(statusLabel)}</span></td>
      <td style="font-size:11px;color:#617268">${escapeHtml(item.dateReported)}<br>${escapeHtml(item.reporter)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${item.status !== 'verified'
          ? `<button class="action-btn action-verify" type="button" data-verify="${escapeHtml(item.id)}">Approve</button>`
          : `<button class="action-btn" type="button" data-pend="${escapeHtml(item.id)}">Unpublish</button>`}
        ${item.status === 'pending'
          ? `<button class="action-btn" type="button" data-reject-price="${escapeHtml(item.id)}">Reject</button>`
          : ''}
        ${confirming
          ? `<button class="action-btn action-delete" type="button" data-confirm-delete="${escapeHtml(item.id)}">Confirm Delete</button>
             <button class="action-btn" type="button" data-cancel-delete="1">Cancel</button>`
          : `<button class="action-btn action-delete" type="button" data-ask-delete="${escapeHtml(item.id)}">Delete</button>`}
      </td>
    </tr>`;
  }).join('');

  body.querySelectorAll('[data-verify]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.verify, 'verified')));
  body.querySelectorAll('[data-pend]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.pend, 'pending')));
  body.querySelectorAll('[data-reject-price]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.rejectPrice, 'rejected')));
  body.querySelectorAll('[data-ask-delete]').forEach(btn => btn.addEventListener('click', () => {
    pendingDeleteId = btn.dataset.askDelete;
    renderAdminTable();
  }));
  body.querySelectorAll('[data-cancel-delete]').forEach(btn => btn.addEventListener('click', () => {
    pendingDeleteId = null;
    renderAdminTable();
  }));
  body.querySelectorAll('[data-confirm-delete]').forEach(btn => btn.addEventListener('click', () => deleteRow(btn.dataset.confirmDelete)));
}

async function updateStatus(id, status) {
  if (!adminUser) {
    showToast('Connect your Supabase admin account in the banner above to update records.');
    return;
  }
  const patch = {
    status,
    verified_by: status === 'verified' ? adminUser.id : null,
    verified_at: status === 'verified' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('market_price_reports').update(patch).eq('id', id);
  if (error) {
    showToast('Could not update the market record: ' + error.message);
    return;
  }
  await loadRows();
  showToast(status === 'verified' ? 'Price approved and published.' : status === 'rejected' ? 'Price report rejected.' : 'Price unpublished.');
}

async function deleteRow(id) {
  if (!adminUser) {
    showToast('Connect your Supabase admin account in the banner above to delete records.');
    return;
  }
  const { error } = await supabase.from('market_price_reports').delete().eq('id', id);
  pendingDeleteId = null;
  if (error) {
    showToast('Could not delete this record: ' + error.message);
    return;
  }
  await loadRows();
  showToast('Market price record deleted.');
}

async function loadPendingSubscriptions() {
  const tbody = document.getElementById('adminSubscriptionsTableBody');
  if (!tbody) return;
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id,user_id,plan_id,status,provider_reference,billing_period,amount_mwk,created_at,expires_at')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    pendingSubs = data || [];
    renderSubscriptionsTable();
    updateOverviewSummary();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:18px;color:#617268">${escapeHtml(adminUser ? ('Unable to load subscription requests: ' + err.message) : 'Connect a Supabase admin account above to inspect and approve pending membership payments.')}</td></tr>`;
  }
}

function renderSubscriptionsTable() {
  const tbody = document.getElementById('adminSubscriptionsTableBody');
  if (!tbody) return;
  if (!pendingSubs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:18px;color:#617268">No subscription payment requests found.</td></tr>';
    return;
  }
  tbody.innerHTML = pendingSubs.map(sub => {
    const isPending = sub.status === 'pending';
    return `
      <tr>
        <td style="font-family:monospace;font-size:11.5px">${escapeHtml(String(sub.user_id).slice(0, 12))}…</td>
        <td><strong>${escapeHtml(sub.plan_id)}</strong><div style="font-size:11px;color:#617268">${escapeHtml(sub.billing_period || 'monthly')}</div></td>
        <td>MWK ${money(sub.amount_mwk || 0)}</td>
        <td><code>${escapeHtml(sub.provider_reference || '—')}</code></td>
        <td><span class="${sub.status === 'active' ? 'badge-verified' : 'badge-unverified'}">${escapeHtml(sub.status)}</span></td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          ${isPending ? `
            <button type="button" class="action-btn action-verify" data-sub-approve="${escapeHtml(sub.id)}" data-sub-period="${escapeHtml(sub.billing_period || 'monthly')}">Verify &amp; Activate</button>
            <button type="button" class="action-btn action-delete" data-sub-reject="${escapeHtml(sub.id)}">Reject</button>
          ` : `<span style="font-size:11px;color:#617268">${sub.expires_at ? 'Exp: ' + escapeHtml(String(sub.expires_at).slice(0, 10)) : 'Reviewed'}</span>`}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-sub-approve]').forEach(btn => {
    btn.addEventListener('click', () => handleSubscriptionReview(btn.dataset.subApprove, 'active', btn.dataset.subPeriod));
  });
  tbody.querySelectorAll('[data-sub-reject]').forEach(btn => {
    btn.addEventListener('click', () => handleSubscriptionReview(btn.dataset.subReject, 'cancelled', 'monthly'));
  });
}

async function handleSubscriptionReview(subId, nextStatus, billingPeriod) {
  if (!adminUser) {
    showToast('Connect your Supabase admin account above to verify payments.');
    return;
  }
  const now = new Date();
  const patch = {
    status: nextStatus,
    updated_at: now.toISOString()
  };
  if (nextStatus === 'active') {
    const days = billingPeriod === 'yearly' ? 365 : 30;
    const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    patch.started_at = now.toISOString();
    patch.expires_at = expires.toISOString();
  }
  const { error } = await supabase.from('subscriptions').update(patch).eq('id', subId);
  if (error) {
    showToast('Could not update subscription: ' + error.message);
    return;
  }
  showToast(nextStatus === 'active' ? 'Subscription payment verified and activated.' : 'Subscription payment request rejected.');
  await loadPendingSubscriptions();
}

function initForm() {
  const form = document.getElementById('addPriceForm');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!adminUser) {
      showToast('Connect your Supabase admin account in the banner above to publish records.');
      return;
    }
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
      date_observed: new Date().toISOString().slice(0, 10),
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
    if (error) {
      showToast('Price could not be saved: ' + error.message);
      return;
    }
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
  initAdminViewControls();
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    await supabase.auth.signOut();
    window.location.assign('../login.html?admin=true');
  });
  const resetBtn = document.getElementById('resetDefaultPricesBtn');
  if (resetBtn) resetBtn.hidden = true;
  try {
    await Promise.all([loadRows(), loadPendingSubscriptions()]);
  } catch (error) {
    console.error('Unable to load market price admin records:', error);
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">Unable to load shared market records. Connect Supabase admin credentials above if needed.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {\n  initAdminSidebarNavigation();\n  initAdminPriceManagement();\n});
