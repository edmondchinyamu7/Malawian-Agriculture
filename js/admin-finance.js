import { supabase } from './auth.js';

const $ = (id) => document.getElementById(id);
const money = (value) => 'MWK ' + Number(value || 0).toLocaleString('en-MW', { maximumFractionDigits: 2 });
const dateOnly = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '—';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const monthStart = (month) => month + '-01';
const nextMonth = (month) => {
  const d = new Date(month + '-01T00:00:00');
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

function setStatus(message, error = false) {
  const el = $('financeStatus');
  if (el) {
    el.textContent = message;
    el.classList.toggle('error', error);
  }
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

// Server-side administrator session verification (independent of Supabase Auth)
async function requireAdmin() {
  try {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    if (!res.ok) {
      location.replace('/login.html?redirect=' + encodeURIComponent(location.pathname) + '&admin=true');
      return null;
    }
    const data = await res.json();
    if (!data.authenticated) {
      location.replace('/login.html?redirect=' + encodeURIComponent(location.pathname) + '&admin=true');
      return null;
    }
    return { id: 'admin', username: data.user?.username || 'admin', role: 'admin' };
  } catch {
    location.replace('/login.html?redirect=' + encodeURIComponent(location.pathname) + '&admin=true');
    return null;
  }
}

async function loadDashboard() {
  const month = $('reportMonth')?.value || new Date().toISOString().slice(0, 7);
  const from = monthStart(month), to = nextMonth(month);
  setStatus('Loading verified records for ' + month + '…');

  const safe = (promise) => Promise.resolve(promise).catch(err => ({ data: [], error: err }));

  const results = await Promise.all([
    safe(supabase.from('profiles').select('id,role,created_at')),
    safe(supabase.from('app_activity_events').select('user_id,activity_date').gte('activity_date', from).lt('activity_date', to)),
    safe(supabase.from('subscriptions').select('id,user_id,plan_id,status,expires_at,created_at,updated_at,plan:subscription_plans(name,monthly_price_mwk)')),
    safe(supabase.from('revenue_entries').select('*').gte('received_at', from).lt('received_at', to).order('received_at', { ascending: false })),
    safe(supabase.from('expense_entries').select('*').gte('spent_at', from).lt('spent_at', to).order('spent_at', { ascending: false })),
    safe(supabase.from('subscription_plans').select('*').eq('active', true).order('display_order')),
    Promise.resolve({ data: [], error: null })
  ]);

  const [profiles, activity, allSubs, revenue, expenses, plans] = results.slice(0, 6).map(r => r.data || []);
  const uniqueActive = new Set(activity.map(x => x.user_id)).size;
  const activeSubs = allSubs.filter(s => s.status === 'active' && s.plan_id !== 'free' && (!s.expires_at || new Date(s.expires_at) >= new Date()));
  const paidActive = activeSubs.length;
  const farmerCount = profiles.filter(p => p.role !== 'admin').length;
  const freeProfiles = Math.max(0, farmerCount - paidActive);
  const monthSubs = allSubs.filter(s => s.created_at >= from && s.created_at < to);
  const totalRevenue = revenue.reduce((n, x) => n + Number(x.amount_mwk || 0), 0);
  const totalExpenses = expenses.reduce((n, x) => n + Number(x.amount_mwk || 0), 0);

  setText('totalUsers', farmerCount.toLocaleString());
  setText('userBreakdown', freeProfiles + ' free/other accounts • ' + paidActive + ' active paid subscriptions');
  setText('activeUsers', uniqueActive.toLocaleString());
  setText('activeSubs', paidActive.toLocaleString());

  const activeMrr = activeSubs.reduce((sum, s) => sum + Number(s.plan?.monthly_price_mwk || 0), 0);
  setText('activeMrr', money(activeMrr));

  const tiers = activeSubs.reduce((a, s) => (a[s.plan_id] = (a[s.plan_id] || 0) + 1, a), {});
  setText('tierBreakdown', plans.filter(p => p.id !== 'free').map(p => (tiers[p.id] || 0) + ' ' + p.name).join(' • ') || 'No paid plans configured');
  setText('totalRevenue', money(totalRevenue));
  setText('totalExpenses', money(totalExpenses));

  const result = totalRevenue - totalExpenses;
  setText('operatingResult', (result < 0 ? '-' : '') + money(Math.abs(result)));
  const opEl = $('operatingResult');
  if (opEl) opEl.style.color = result < 0 ? '#a52b25' : '#0b6245';

  const sources = [['Subscriptions', 'subscription'], ['Advertising', 'advertising'], ['Partnerships', 'partnership'], ['Other', 'other']];
  const rbEl = $('revenueBreakdown');
  if (rbEl) {
    rbEl.innerHTML = sources.map(([label, key]) => {
      const total = revenue.filter(x => x.source === key).reduce((n, x) => n + Number(x.amount_mwk || 0), 0);
      return '<div class="finance-breakdown-row"><span>' + label + '</span><strong>' + money(total) + '</strong></div>';
    }).join('');
  }

  const statuses = ['active', 'pending', 'cancelled', 'expired', 'past_due', 'refunded'];
  const sbEl = $('subscriptionBreakdown');
  if (sbEl) {
    sbEl.innerHTML = statuses.map(s => '<div class="finance-breakdown-row"><span>' + s.replace('_', ' ') + '</span><strong>' + allSubs.filter(x => x.status === s).length + '</strong></div>').join('') + '<div class="finance-breakdown-row"><span>New subscriptions this month</span><strong>' + monthSubs.length + '</strong></div>';
  }

  const rrEl = $('revenueRows');
  if (rrEl) {
    rrEl.innerHTML = revenue.length ? revenue.slice(0, 12).map(x => '<tr><td>' + dateOnly(x.received_at) + '</td><td>' + esc(x.source) + '</td><td>' + money(x.amount_mwk) + '</td><td>' + esc(x.reference || x.notes || '—') + '</td></tr>').join('') : '<tr><td colspan="4">No revenue entries recorded for this period.</td></tr>';
  }

  const erEl = $('expenseRows');
  if (erEl) {
    erEl.innerHTML = expenses.length ? expenses.slice(0, 12).map(x => '<tr><td>' + dateOnly(x.spent_at) + '</td><td>' + esc(x.category) + '</td><td>' + money(x.amount_mwk) + '</td><td>' + esc(x.description) + '</td></tr>').join('') : '<tr><td colspan="4">No expense entries recorded for this period.</td></tr>';
  }

  const prEl = $('planRows');
  if (prEl) {
    prEl.innerHTML = plans.map(p => '<tr><td>' + esc(p.name) + '</td><td>' + money(p.monthly_price_mwk) + '</td><td>' + (p.ads_enabled ? 'Shown' : 'Off') + '</td><td>' + (p.active ? 'Active' : 'Inactive') + '</td></tr>').join('');
  }

  setStatus('Dashboard updated. Records loaded from database for ' + month + '.');
}

async function start() {
  const rm = $('reportMonth');
  if (rm) rm.value = new Date().toISOString().slice(0, 7);

  const adminUser = await requireAdmin();
  if (!adminUser) return;

  const logoutBtn = $('financeLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (_) {}
      location.assign('/login.html?admin=true');
    });
  }

  if (rm) rm.addEventListener('change', loadDashboard);

  const rd = $('revenueDate');
  if (rd) rd.value = new Date().toISOString().slice(0, 10);
  const ed = $('expenseDate');
  if (ed) ed.value = new Date().toISOString().slice(0, 10);

  const revForm = $('revenueForm');
  if (revForm) {
    revForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const row = {
        source: $('revenueSource')?.value,
        amount_mwk: Number($('revenueAmount')?.value),
        received_at: new Date(($('revenueDate')?.value || new Date().toISOString().slice(0, 10)) + 'T12:00:00').toISOString(),
        reference: $('revenueNote')?.value?.trim() || null,
        created_by: adminUser.username || 'admin'
      };
      const { error } = await supabase.from('revenue_entries').insert(row);
      if (error) {
        setStatus('Could not save revenue: ' + error.message, true);
        return;
      }
      e.target.reset();
      if (rd) rd.value = new Date().toISOString().slice(0, 10);
      await loadDashboard();
    });
  }

  const expForm = $('expenseForm');
  if (expForm) {
    expForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const row = {
        category: $('expenseCategory')?.value,
        amount_mwk: Number($('expenseAmount')?.value),
        spent_at: $('expenseDate')?.value,
        description: $('expenseDescription')?.value?.trim(),
        created_by: adminUser.username || 'admin'
      };
      const { error } = await supabase.from('expense_entries').insert(row);
      if (error) {
        setStatus('Could not save expense: ' + error.message, true);
        return;
      }
      e.target.reset();
      if (ed) ed.value = new Date().toISOString().slice(0, 10);
      await loadDashboard();
    });
  }

  await loadDashboard();
}

start();
