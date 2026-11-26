/**
 * Ulimi wa Malawi | Administration Portal
 * Coordinates server admin cookie + Supabase admin_access RLS verification,
 * market price moderation, and pending subscription approvals.
 */
import { escapeHtml, showToast } from './main.js';
import { supabase } from './auth.js';
import { getIconSvg } from './icons.js';
import {
  computeMarketPriceStats,
  filterMarketPriceRows,
  formatCategoryLabel
} from './admin-utils.js';

export { computeMarketPriceStats, filterMarketPriceRows };

let rows = [];
let pendingSubs = [];
let adminUser = null; // Supabase auth user in admin_access (if signed in)
let serverAdminSession = null;
let pendingDeleteId = null;
let overviewPlatformStats = {};
let registeredFarmers = [];
const busyPriceIds = new Set();
const busySubIds = new Set();

const toUi = row => ({
  id: row.id,
  crop: row.crop_name,
  category: row.category || 'Other',
  marketName: row.market_name,
  district: row.district,
  region: row.region || '',
  unit: row.unit,
  priceMin: Number(row.price_min),
  priceMax: Number(row.price_max),
  currency: row.currency || 'MWK',
  status: row.status,
  dateReported: row.date_observed,
  sourceType: row.source_type || 'admin',
  reporter: row.reporter_name || row.source_name || 'Admin',
  notes: row.notes || ''
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
    overviewSubscriptionTotal: overviewPlatformStats.subscriptions === undefined ? counts.subscriptions : (overviewPlatformStats.subscriptions ?? 'Unavailable'),
    overviewSubscriptionActive: overviewPlatformStats.activeSubscriptions === undefined ? counts.active : (overviewPlatformStats.activeSubscriptions ?? 'Unavailable'),
    overviewRegisteredFarmers: overviewPlatformStats.farmers ?? '—',
    overviewActiveFarmers: overviewPlatformStats.activeFarmers ?? '—',
    overviewSuggestionsTotal: overviewPlatformStats.suggestions ?? '—',
    overviewSuggestionsOpen: overviewPlatformStats.openSuggestions ?? '—'
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = typeof value === 'number' ? money(value) : String(value);
  });
  const updated = document.getElementById('adminSummaryUpdated');
  if (updated) updated.textContent = 'Updated ' + new Intl.DateTimeFormat('en-MW', {
    dateStyle: 'medium', timeStyle: 'short'
  }).format(new Date());
  renderOverviewVisuals();
}

async function loadCropLibraryCount() {
  const node = document.getElementById('overviewCropLibraryTotal');
  if (!node) return;
  try {
    const res = await fetch('../data/crops.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.crops) ? data.crops : []);
    node.textContent = money(list.length);
  } catch {
    node.textContent = 'Unavailable';
  }
}

function renderRecentSuggestionsActivity(items, error) {
  const container = document.getElementById('adminRecentSuggestionsActivity');
  if (!container) return;
  if (error) {
    container.innerHTML = '<p class="admin-empty-state">Unable to load recent farmer suggestions. Check database permissions and admin_access.</p>';
    return;
  }
  const latest = Array.isArray(items) ? items : [];
  if (!latest.length) {
    container.innerHTML = '<p class="admin-empty-state">No farmer suggestions have been submitted yet.</p>';
    return;
  }
  container.innerHTML = latest.map(item => {
    const rawStatus = String(item.status || 'new');
    const pillClass = rawStatus === 'responded' || rawStatus === 'closed'
      ? 'is-verified'
      : rawStatus === 'reviewing'
        ? 'is-pending'
        : '';
    const category = escapeHtml(formatCategoryLabel(item.category));
    const subject = escapeHtml(item.subject || 'Untitled suggestion');
    const date = escapeHtml(item.created_at ? String(item.created_at).slice(0, 10) : 'Date unknown');
    return '<div class="admin-recent-row">' +
      '<span class="admin-recent-icon">✎</span>' +
      '<div class="admin-recent-copy"><strong>' + subject + '</strong><small>' + category + ' · ' + date + '</small></div>' +
      '<span class="admin-status-pill ' + pillClass + '">' + escapeHtml(rawStatus.replace(/_/g, ' ')) + '</span>' +
      '</div>';
  }).join('');
}

async function loadOverviewPlatformStats() {
  const setValue = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value === null || value === undefined ? 'Unavailable' : money(value);
  };

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)).toISOString().slice(0, 10);

  const [results] = await Promise.all([
    Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).or('role.is.null,role.neq.admin'),
      supabase.from('app_activity_events').select('user_id,activity_date').gte('activity_date', monthStart).lt('activity_date', nextMonth),
      supabase.from('farmer_suggestions').select('id', { count: 'exact', head: true }),
      supabase.from('farmer_suggestions').select('id', { count: 'exact', head: true }).in('status', ['new', 'reviewing']),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('farmer_suggestions').select('id,category,subject,status,created_at').order('created_at', { ascending: false }).limit(5)
    ]),
    loadCropLibraryCount()
  ]);

  const [profiles, activity, suggestions, openSuggestions, subscriptions, activeSubscriptions, pendingSubscriptions, recentSuggestions] = results;
  overviewPlatformStats.farmers = profiles.error ? null : (profiles.count ?? 0);
  overviewPlatformStats.activeFarmers = activity.error ? null : new Set((activity.data || []).map(item => item.user_id).filter(Boolean)).size;
  overviewPlatformStats.suggestions = suggestions.error ? null : (suggestions.count ?? 0);
  overviewPlatformStats.openSuggestions = openSuggestions.error ? null : (openSuggestions.count ?? 0);
  overviewPlatformStats.subscriptions = subscriptions.error ? null : (subscriptions.count ?? 0);
  overviewPlatformStats.activeSubscriptions = activeSubscriptions.error ? null : (activeSubscriptions.count ?? 0);
  overviewPlatformStats.pendingSubscriptions = pendingSubscriptions.error ? null : (pendingSubscriptions.count ?? 0);

  setValue('overviewRegisteredFarmers', overviewPlatformStats.farmers);
  setValue('overviewActiveFarmers', overviewPlatformStats.activeFarmers);
  setValue('overviewSuggestionsTotal', overviewPlatformStats.suggestions);
  setValue('overviewSuggestionsOpen', overviewPlatformStats.openSuggestions);
  setValue('overviewSubscriptionTotal', overviewPlatformStats.subscriptions);
  setValue('overviewSubscriptionActive', overviewPlatformStats.activeSubscriptions);
  setValue('overviewSubscriptionTotalVisual', overviewPlatformStats.subscriptions);
  setValue('overviewSubscriptionActiveVisual', overviewPlatformStats.activeSubscriptions);
  setValue('overviewSubscriptionPendingVisual', overviewPlatformStats.pendingSubscriptions);
  renderRecentSuggestionsActivity(recentSuggestions.data, recentSuggestions.error);

  const updated = document.getElementById('adminSummaryUpdated');
  if (updated) updated.textContent = 'Updated ' + new Intl.DateTimeFormat('en-MW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  const errors = results.filter(result => result.error);
  const note = document.getElementById('adminOverviewDataNote');
  if (note) {
    note.textContent = errors.length
      ? 'Some figures are unavailable because the current admin account cannot read one or more reporting tables. Check database permissions and RLS.'
      : 'Figures are live database totals. Active farmers are unique accounts with recorded activity this calendar month.';
    note.classList.toggle('is-warning', errors.length > 0);
  }
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
    overviewSubscriptionTotalVisual: overviewPlatformStats.subscriptions === undefined ? subscriptionCounts.total : (overviewPlatformStats.subscriptions ?? 'Unavailable'),
    overviewSubscriptionActiveVisual: overviewPlatformStats.activeSubscriptions === undefined ? subscriptionCounts.active : (overviewPlatformStats.activeSubscriptions ?? 'Unavailable'),
    overviewSubscriptionPendingVisual: overviewPlatformStats.pendingSubscriptions === undefined ? subscriptionCounts.pending : (overviewPlatformStats.pendingSubscriptions ?? 'Unavailable')
  };
  Object.entries(visualValues).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = typeof value === 'number' ? money(value) : String(value);
  });
}

function initAdminSidebarNavigation() {
  const links = [...document.querySelectorAll('.admin-side-nav a[href^="#"]')];
  if (!links.length) return;
  const activate = link => {
    links.forEach(item => {
      const active = item === link;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  };
  links.forEach(link => link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    activate(link);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', link.getAttribute('href'));
  }));
  const initial = links.find(link => link.getAttribute('href') === window.location.hash) || links[0];
  activate(initial);
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
        'Authorization': `Bearer ${session.access_token}`,
        'X-Requested-With': 'fetch'
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
  renderAdminSettings();

  if (!serverAdminSession) {
    window.location.replace('../login.html?redirect=' + encodeURIComponent(window.location.pathname) + '&admin=true');
    return false;
  }

  if (serverAdminSession.authMethod === 'supabase' && !adminUser) {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' }
      });
    } catch (_) {}
    window.location.replace('../login.html?redirect=' + encodeURIComponent('/pages/admin.html') + '&admin=true');
    return false;
  }

  renderSupabaseAdminLinkNotice();
  return true;
}

function renderAdminSettings() {
  const email = adminUser?.email || serverAdminSession?.email || serverAdminSession?.username || 'Administrator account';
  const account = document.getElementById('adminAccountEmail');
  const method = document.getElementById('adminAccountMethod');
  const session = document.getElementById('adminSessionState');
  if (account) account.textContent = email;
  if (method) method.textContent = adminUser ? 'Supabase Auth account linked to admin_access' : 'Server administrator session';
  if (session) session.textContent = serverAdminSession ? 'Active and verified' : 'Not verified';
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
  const { data, error } = await supabase
    .from('market_price_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  rows = data || [];
  renderAdminTable();
  renderFarmerSubmissions();
  updateOverviewSummary();
}

function renderRegisteredFarmers() {
  const body = document.getElementById('registeredFarmerTableBody');
  if (!body) return;
  const search = (document.getElementById('farmerDirectorySearch')?.value || '').trim().toLowerCase();
  const roleFilter = document.getElementById('farmerDirectoryRole')?.value || '';
  const filtered = registeredFarmers.filter(profile => {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').toLowerCase();
    const role = String(profile.role || 'unspecified');
    const id = String(profile.id || '').toLowerCase();
    return (!search || name.includes(search) || role.toLowerCase().includes(search) || id.includes(search))
      && (!roleFilter || role === roleFilter);
  });

  const total = document.getElementById('registeredProfileCount');
  const farmers = document.getElementById('registeredFarmerCount');
  const resultCount = document.getElementById('farmerDirectoryResultCount');
  if (total) total.textContent = money(registeredFarmers.length);
  if (farmers) farmers.textContent = money(registeredFarmers.filter(profile => profile.role === 'farmer').length);
  if (resultCount) resultCount.textContent = 'Showing ' + money(filtered.length) + ' of ' + money(registeredFarmers.length) + ' profiles';

  const roleSelect = document.getElementById('farmerDirectoryRole');
  if (roleSelect) {
    const selected = roleSelect.value;
    const roles = [...new Set(registeredFarmers.map(profile => String(profile.role || 'unspecified')))].sort();
    roleSelect.innerHTML = '<option value="">All roles</option>' + roles.map(role =>
      '<option value="' + escapeHtml(role) + '">' + escapeHtml(role.replace(/_/g, ' ')) + '</option>'
    ).join('');
    if (roles.includes(selected)) roleSelect.value = selected;
  }

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="4" class="admin-empty-cell">' +
      (registeredFarmers.length ? 'No profiles match your search or role filter. Try changing or clearing the filters.' : 'No registered profiles were returned.') +
      '</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(profile => {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Name not provided';
    const role = String(profile.role || 'unspecified');
    const joinedDate = profile.created_at ? new Date(profile.created_at) : null;
    const joined = joinedDate && !Number.isNaN(joinedDate.getTime())
      ? new Intl.DateTimeFormat('en-MW', { dateStyle: 'medium' }).format(joinedDate)
      : '—';
    return '<tr><td><strong>' + escapeHtml(name) + '</strong></td>' +
      '<td><span class="admin-status-pill">' + escapeHtml(role.replace(/_/g, ' ')) + '</span></td>' +
      '<td>' + escapeHtml(joined) + '</td>' +
      '<td><code>' + escapeHtml(String(profile.id).slice(0, 8)) + '…</code></td></tr>';
  }).join('');
}

async function loadRegisteredFarmers() {
  const body = document.getElementById('registeredFarmerTableBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="4" class="admin-empty-cell">Loading registered profiles…</td></tr>';
  const { data, error } = await supabase
    .from('profiles')
    .select('id,first_name,last_name,role,created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    body.innerHTML = '<tr><td colspan="4" class="admin-empty-cell">Unable to load profiles. Confirm that the signed-in admin account has Supabase admin access and that the profiles SELECT policy is active.</td></tr>';
    const total = document.getElementById('registeredProfileCount');
    const farmers = document.getElementById('registeredFarmerCount');
    if (total) total.textContent = 'Unavailable';
    if (farmers) farmers.textContent = 'Unavailable';
    console.error('Unable to load registered farmer profiles:', error);
    return;
  }
  registeredFarmers = data || [];
  renderRegisteredFarmers();
}

function renderFarmerSubmissions() {
  const body = document.getElementById('adminFarmerTableBody');
  if (!body) return;
  const reports = rows.filter(row => row.source_type === 'farmer');
  const contributors = new Set(reports.map(row => row.reporter_user_id).filter(Boolean));
  const pending = reports.filter(row => row.status === 'pending').length;
  const count = document.getElementById('farmerReportCount');
  const people = document.getElementById('farmerContributorCount');
  const pendingCount = document.getElementById('farmerPendingCount');
  if (count) count.textContent = money(reports.length);
  if (people) people.textContent = money(contributors.size);
  if (pendingCount) pendingCount.textContent = money(pending);

  const search = (document.getElementById('farmerSubmissionSearch')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('farmerSubmissionStatus')?.value || '';
  const filtered = reports.filter(row => {
    const searchable = [row.reporter_name, row.crop_name, row.market_name, row.district, row.status]
      .filter(Boolean).join(' ').toLowerCase();
    return (!search || searchable.includes(search)) && (!statusFilter || row.status === statusFilter);
  });
  const resultCount = document.getElementById('farmerSubmissionResultCount');
  if (resultCount) resultCount.textContent = 'Showing ' + money(filtered.length) + ' of ' + money(reports.length) + ' submissions';

  if (!filtered.length) {
    const message = reports.length
      ? 'No submissions match your search or status filter. Try changing or clearing the filters.'
      : 'No farmer-submitted market reports are available yet. Farmer records will appear here when submitted through the platform.';
    body.innerHTML = '<tr><td colspan="6" class="admin-empty-cell">' + message + '</td></tr>';
    return;
  }
  body.innerHTML = filtered.map(row => {
    const status = row.status === 'verified' ? 'Verified' : row.status === 'rejected' ? 'Rejected' : 'Pending review';
    const statusClass = row.status === 'verified' ? 'is-verified' : row.status === 'rejected' ? 'is-rejected' : 'is-pending';
    return `<tr>
      <td><strong>${escapeHtml(row.reporter_name || 'Farmer contributor')}</strong><small class="admin-table-subtext">${escapeHtml(row.reporter_user_id ? 'Account-linked submission' : 'Unlinked report')}</small></td>
      <td>${escapeHtml(row.crop_name || '—')}</td>
      <td>${escapeHtml(row.market_name || '—')}<small class="admin-table-subtext">${escapeHtml(row.district || '—')}</small></td>
      <td>MWK ${money(row.price_min)} – ${money(row.price_max)}</td>
      <td>${escapeHtml(row.date_observed || '—')}</td>
      <td><span class="admin-status-pill ${statusClass}">${escapeHtml(status)}</span></td>
    </tr>`;
  }).join('');
}

function renderMarketPriceStats() {
  const stats = computeMarketPriceStats(rows);
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = money(val);
  };
  set('priceStatTotal', stats.total);
  set('priceStatVerified', stats.verified);
  set('priceStatPending', stats.pending);
  set('priceStatRejected', stats.rejected);
}

function renderAdminTable() {
  renderMarketPriceStats();
  const body = document.getElementById('adminPriceTableBody');
  if (!body) return;

  const filtered = filterMarketPriceRows(rows, {
    search: document.getElementById('priceSearchInput')?.value || '',
    status: document.getElementById('priceStatusFilter')?.value || 'all',
    source: document.getElementById('priceSourceFilter')?.value || 'all'
  });

  const resultCount = document.getElementById('priceResultCount');
  if (resultCount) {
    resultCount.textContent = rows.length
      ? 'Showing ' + money(filtered.length) + ' of ' + money(rows.length) + ' market records'
      : 'No market price records yet';
  }

  if (!filtered.length) {
    const emptyMessage = rows.length
      ? 'No market price records match the active search or filter criteria.'
      : 'No market price records found.';
    body.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">' + escapeHtml(emptyMessage) + '</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(raw => {
    const item = toUi(raw);
    const statusLabel = item.status === 'verified'
      ? '✓ Verified'
      : item.status === 'rejected'
        ? 'Rejected'
        : 'Pending review';
    const statusClass = item.status === 'verified'
      ? 'badge-verified'
      : 'badge-unverified';
    const confirming = pendingDeleteId === String(item.id);
    const isBusy = busyPriceIds.has(String(item.id));
    const locationMeta = [item.district, item.region].filter(Boolean).join(' · ');
    return `<tr>
      <td><strong>${escapeHtml(item.crop)}</strong><small class="admin-table-subtext">${escapeHtml(item.category)} · ${escapeHtml(item.sourceType === 'farmer' ? 'Farmer report' : 'Admin desk')}</small></td>
      <td>${escapeHtml(item.marketName)}${locationMeta ? `<small class="admin-table-subtext">${escapeHtml(locationMeta)}</small>` : ''}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td>MWK ${money(item.priceMin)} – ${money(item.priceMax)}</td>
      <td><span class="${statusClass}">${escapeHtml(statusLabel)}</span></td>
      <td style="font-size:11px;color:#617268">${escapeHtml(item.dateReported)}<br>${escapeHtml(item.reporter)}</td>
      <td class="admin-price-row-actions">
        ${item.status !== 'verified'
          ? `<button class="action-btn action-verify" type="button" data-verify="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Approve</button>`
          : `<button class="action-btn" type="button" data-pend="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Unpublish</button>`}
        ${item.status === 'pending'
          ? `<button class="action-btn" type="button" data-reject-price="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Reject</button>`
          : ''}
        ${confirming
          ? `<button class="action-btn action-delete" type="button" data-confirm-delete="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Confirm Delete</button>
             <button class="action-btn" type="button" data-cancel-delete="1" ${isBusy ? 'disabled' : ''}>Cancel</button>`
          : `<button class="action-btn action-delete" type="button" data-ask-delete="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Delete</button>`}
      </td>
    </tr>`;
  }).join('');

  body.querySelectorAll('[data-verify]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.verify, 'verified', btn)));
  body.querySelectorAll('[data-pend]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.pend, 'pending', btn)));
  body.querySelectorAll('[data-reject-price]').forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.rejectPrice, 'rejected', btn)));
  body.querySelectorAll('[data-ask-delete]').forEach(btn => btn.addEventListener('click', () => {
    pendingDeleteId = btn.dataset.askDelete;
    renderAdminTable();
  }));
  body.querySelectorAll('[data-cancel-delete]').forEach(btn => btn.addEventListener('click', () => {
    pendingDeleteId = null;
    renderAdminTable();
  }));
  body.querySelectorAll('[data-confirm-delete]').forEach(btn => btn.addEventListener('click', () => deleteRow(btn.dataset.confirmDelete, btn)));
}

async function updateStatus(id, status, triggerBtn) {
  if (!adminUser) {
    showToast('Connect your Supabase admin account in the banner above to update records.');
    return;
  }
  const key = String(id);
  if (busyPriceIds.has(key)) return;
  busyPriceIds.add(key);
  if (triggerBtn) triggerBtn.disabled = true;
  renderAdminTable();
  try {
    const patch = {
      status,
      verified_by: status === 'verified' ? adminUser.id : null,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('market_price_reports')
      .update(patch)
      .eq('id', id)
      .select('id');
    if (error || !Array.isArray(data) || data.length === 0) {
      showToast('Could not update the market record: ' + (error?.message || 'Permission denied or record missing.'));
      return;
    }
    await loadRows();
    showToast(status === 'verified' ? 'Price approved and published.' : status === 'rejected' ? 'Price report rejected.' : 'Price unpublished.');
  } finally {
    busyPriceIds.delete(key);
    renderAdminTable();
  }
}

async function deleteRow(id, triggerBtn) {
  if (!adminUser) {
    showToast('Connect your Supabase admin account in the banner above to delete records.');
    return;
  }
  const key = String(id);
  if (busyPriceIds.has(key)) return;
  busyPriceIds.add(key);
  if (triggerBtn) triggerBtn.disabled = true;
  renderAdminTable();
  try {
    const { data, error } = await supabase
      .from('market_price_reports')
      .delete()
      .eq('id', id)
      .select('id');
    pendingDeleteId = null;
    if (error || !Array.isArray(data) || data.length === 0) {
      showToast('Could not delete this record: ' + (error?.message || 'Permission denied or record missing.'));
      return;
    }
    await loadRows();
    showToast('Market price record deleted.');
  } finally {
    busyPriceIds.delete(key);
    renderAdminTable();
  }
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
    btn.addEventListener('click', () => handleSubscriptionReview(btn.dataset.subApprove, 'active', btn.dataset.subPeriod, btn));
  });
  tbody.querySelectorAll('[data-sub-reject]').forEach(btn => {
    btn.addEventListener('click', () => handleSubscriptionReview(btn.dataset.subReject, 'cancelled', 'monthly', btn));
  });
}

async function handleSubscriptionReview(subId, nextStatus, billingPeriod, triggerBtn) {
  if (!adminUser) {
    showToast('Connect your Supabase admin account above to verify payments.');
    return;
  }
  const key = String(subId);
  if (busySubIds.has(key)) return;
  busySubIds.add(key);
  if (triggerBtn) triggerBtn.disabled = true;
  try {
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
    const { data, error } = await supabase
      .from('subscriptions')
      .update(patch)
      .eq('id', subId)
      .select('id');
    if (error || !Array.isArray(data) || data.length === 0) {
      showToast('Could not update subscription: ' + (error?.message || 'Permission denied or record missing.'));
      if (triggerBtn) triggerBtn.disabled = false;
      return;
    }
    showToast(nextStatus === 'active' ? 'Subscription payment verified and activated.' : 'Subscription payment request rejected.');
    await loadPendingSubscriptions();
  } finally {
    busySubIds.delete(key);
  }
}

function initForm() {
  const form = document.getElementById('addPriceForm');
  if (!form) return;
  const submitBtn = document.getElementById('saveMarketPriceBtn') || form.querySelector('button[type="submit"]');
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
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
    }
    try {
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
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Market Record';
      }
    }
  });
}

export async function initAdminPriceManagement() {
  const allowed = await requireAdmin();
  if (!allowed) return;

  const body = document.getElementById('adminPriceTableBody');
  const logout = async (button) => {
    if (button) button.disabled = true;
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' }
      });
    } catch (_) {}
    try { await supabase.auth.signOut(); } catch (_) {}
    window.location.assign('../login.html?admin=true');
  };
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout(logoutBtn));
  const settingsLogout = document.getElementById('adminSettingsLogout');
  if (settingsLogout) settingsLogout.addEventListener('click', () => logout(settingsLogout));
  const resetBtn = document.getElementById('resetDefaultPricesBtn');
  if (resetBtn) resetBtn.hidden = true;

  const needsMarketRows = Boolean(
    body ||
    document.getElementById('adminFarmerTableBody') ||
    document.getElementById('overviewPriceTotal')
  );
  const needsSubscriptions = Boolean(
    document.getElementById('adminSubscriptionsTableBody') ||
    document.getElementById('overviewSubscriptionTotal') ||
    body
  );
  if (document.getElementById('addPriceForm')) initForm();

  const priceSearch = document.getElementById('priceSearchInput');
  const priceStatus = document.getElementById('priceStatusFilter');
  const priceSource = document.getElementById('priceSourceFilter');
  const clearPriceFilters = document.getElementById('clearPriceFiltersBtn');
  const refreshPrices = document.getElementById('refreshPricesBtn');
  if (priceSearch) priceSearch.addEventListener('input', renderAdminTable);
  if (priceStatus) priceStatus.addEventListener('change', renderAdminTable);
  if (priceSource) priceSource.addEventListener('change', renderAdminTable);
  if (clearPriceFilters) clearPriceFilters.addEventListener('click', () => {
    if (priceSearch) priceSearch.value = '';
    if (priceStatus) priceStatus.value = 'all';
    if (priceSource) priceSource.value = 'all';
    renderAdminTable();
  });
  if (refreshPrices) refreshPrices.addEventListener('click', async () => {
    refreshPrices.disabled = true;
    refreshPrices.textContent = 'Refreshing…';
    try {
      await loadRows();
      showToast('Market price directory refreshed.');
    } catch (err) {
      showToast('Unable to refresh market records: ' + (err?.message || 'Error'));
    } finally {
      refreshPrices.disabled = false;
      refreshPrices.textContent = '↻ Refresh';
    }
  });

  const directorySearch = document.getElementById('farmerDirectorySearch');
  const directoryRole = document.getElementById('farmerDirectoryRole');
  if (directorySearch) directorySearch.addEventListener('input', renderRegisteredFarmers);
  if (directoryRole) directoryRole.addEventListener('change', renderRegisteredFarmers);
  const refreshDirectory = document.getElementById('refreshFarmerDirectory');
  if (refreshDirectory) refreshDirectory.addEventListener('click', async () => {
    refreshDirectory.disabled = true;
    refreshDirectory.textContent = 'Refreshing…';
    try { await loadRegisteredFarmers(); }
    finally { refreshDirectory.disabled = false; refreshDirectory.textContent = 'Refresh'; }
  });
  const submissionSearch = document.getElementById('farmerSubmissionSearch');
  const submissionStatus = document.getElementById('farmerSubmissionStatus');
  if (submissionSearch) submissionSearch.addEventListener('input', renderFarmerSubmissions);
  if (submissionStatus) submissionStatus.addEventListener('change', renderFarmerSubmissions);
  try {
    const tasks = [];
    if (needsMarketRows) tasks.push(loadRows());
    if (needsSubscriptions) tasks.push(loadPendingSubscriptions());
    if (document.getElementById('overviewRegisteredFarmers')) tasks.push(loadOverviewPlatformStats());
    if (document.getElementById('registeredFarmerTableBody')) tasks.push(loadRegisteredFarmers());
    await Promise.all(tasks);
  } catch (error) {
    console.error('Unable to load admin records:', error);
    if (body) body.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">Unable to load shared market records. Please refresh or contact the administrator.</td></tr>';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initAdminSidebarNavigation();
    initResponsiveAdminMenu();
    initAdminPriceManagement();
  });
}


/* Responsive admin navigation: mobile menu button + slide-in sidebar */
function initResponsiveAdminMenu() {
  const shell = document.querySelector('.admin-shell');
  const sidebar = shell?.querySelector('.admin-sidebar');
  const topbar = shell?.querySelector('.topbar');
  const actions = topbar?.querySelector('.top-actions');
  if (!shell || !sidebar || !topbar || !actions) return;
  if (topbar.querySelector('.admin-menu-toggle')) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'admin-menu-toggle';
  toggle.setAttribute('aria-label', 'Open administration menu');
  toggle.setAttribute('aria-controls', 'adminNavigationSidebar');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  sidebar.id = 'adminNavigationSidebar';

  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.className = 'admin-sidebar-overlay';
  overlay.setAttribute('aria-label', 'Close administration menu');
  overlay.tabIndex = -1;

  const setOpen = open => {
    shell.classList.toggle('admin-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close administration menu' : 'Open administration menu');
    document.body.classList.toggle('admin-menu-lock', open && window.matchMedia('(max-width: 900px)').matches);
  };

  toggle.addEventListener('click', () => {
    setOpen(!shell.classList.contains('admin-menu-open'));
  });
  overlay.addEventListener('click', () => setOpen(false));
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 900px)').matches) setOpen(false);
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && shell.classList.contains('admin-menu-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 900px)').matches) setOpen(false);
  });

  actions.prepend(toggle);
  shell.append(overlay);
}
