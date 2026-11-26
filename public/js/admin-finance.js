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

let activeSupabaseAdmin = null;

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

// Unified admin check: requires server admin session (auto-synced from verified Supabase admin_access if needed)
async function requireAdmin() {
  let serverAdmin = null;
  try {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) serverAdmin = data.user;
    }
  } catch (_) {}

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: aa } = await supabase.from('admin_access').select('user_id').eq('user_id', user.id).maybeSingle();
      if (aa) activeSupabaseAdmin = user;
    }
  } catch (_) {}

  if (!serverAdmin && activeSupabaseAdmin) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
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
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) serverAdmin = data.user;
        }
      }
    } catch (_) {}
  }

  if (!serverAdmin || (serverAdmin.authMethod === 'supabase' && !activeSupabaseAdmin)) {
    location.replace('/login.html?redirect=' + encodeURIComponent(location.pathname) + '&admin=true');
    return null;
  }

  return {
    id: activeSupabaseAdmin ? activeSupabaseAdmin.id : null,
    username: serverAdmin?.username || activeSupabaseAdmin?.email || 'admin',
    role: 'admin'
  };
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
    safe(supabase.from('subscription_plans').select('*').eq('active', true).order('display_order'))
  ]);

  const [profiles, activity, allSubs, revenue, expenses, plans] = results.map(r => r.data || []);
  const failedTables = results.filter(r => r?.error).length;
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
      return '<div class="finance-breakdown-row"><span>' + esc(label) + '</span><strong>' + esc(money(total)) + '</strong></div>';
    }).join('');
  }

  const statuses = ['active', 'pending', 'cancelled', 'expired', 'past_due', 'refunded'];
  const sbEl = $('subscriptionBreakdown');
  if (sbEl) {
    sbEl.innerHTML = statuses.map(s => '<div class="finance-breakdown-row"><span>' + esc(s.replace('_', ' ')) + '</span><strong>' + allSubs.filter(x => x.status === s).length + '</strong></div>').join('') + '<div class="finance-breakdown-row"><span>New subscriptions this month</span><strong>' + monthSubs.length + '</strong></div>';
  }

  const rrEl = $('revenueRows');
  if (rrEl) {
    rrEl.innerHTML = revenue.length ? revenue.slice(0, 12).map(x => '<tr><td>' + esc(dateOnly(x.received_at)) + '</td><td>' + esc(x.source) + '</td><td>' + esc(money(x.amount_mwk)) + '</td><td>' + esc(x.reference || x.notes || '—') + '</td></tr>').join('') : '<tr><td colspan="4">No revenue entries recorded for this period.</td></tr>';
  }

  const erEl = $('expenseRows');
  if (erEl) {
    erEl.innerHTML = expenses.length ? expenses.slice(0, 12).map(x => '<tr><td>' + esc(dateOnly(x.spent_at)) + '</td><td>' + esc(x.category) + '</td><td>' + esc(money(x.amount_mwk)) + '</td><td>' + esc(x.description) + '</td></tr>').join('') : '<tr><td colspan="4">No expense entries recorded for this period.</td></tr>';
  }

  const prEl = $('planRows');
  if (prEl) {
    prEl.innerHTML = plans.map(p => '<tr><td>' + esc(p.name) + '</td><td>' + esc(money(p.monthly_price_mwk)) + '</td><td>' + (p.ads_enabled ? 'Shown' : 'Off') + '</td><td>' + (p.active ? 'Active' : 'Inactive') + '</td></tr>').join('');
  }

  if (failedTables > 0) {
    setStatus('Some reporting tables (' + failedTables + ') could not be loaded for ' + month + '. Confirm Supabase admin_access permissions.', true);
  } else if (!activeSupabaseAdmin) {
    setStatus('Server admin session active (' + month + '). Sign in to a Supabase admin_access account in Admin Overview to record database entries.');
  } else {
    setStatus('Dashboard updated. Records loaded from database for ' + month + '.');
  }
}

async function start() {
  const rm = $('reportMonth');
  if (rm) rm.value = new Date().toISOString().slice(0, 7);

  const adminSession = await requireAdmin();
  if (!adminSession) return;

  const logoutBtn = $('financeLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'fetch' }
        });
      } catch (_) {}
      try { await supabase.auth.signOut(); } catch (_) {}
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
    const revBtn = revForm.querySelector('button[type="submit"]');
    revForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeSupabaseAdmin?.id) {
        setStatus('Connect a Supabase admin_access account above before recording revenue entries.', true);
        return;
      }
      if (revBtn) { revBtn.disabled = true; revBtn.textContent = 'Saving…'; }
      try {
        const row = {
          source: $('revenueSource')?.value,
          amount_mwk: Number($('revenueAmount')?.value),
          received_at: new Date(($('revenueDate')?.value || new Date().toISOString().slice(0, 10)) + 'T12:00:00').toISOString(),
          reference: $('revenueNote')?.value?.trim() || null,
          created_by: activeSupabaseAdmin.id
        };
        const { error } = await supabase.from('revenue_entries').insert(row);
        if (error) {
          setStatus('Could not save revenue: ' + error.message, true);
          return;
        }
        e.target.reset();
        if (rd) rd.value = new Date().toISOString().slice(0, 10);
        await loadDashboard();
      } finally {
        if (revBtn) { revBtn.disabled = false; revBtn.textContent = 'Save revenue'; }
      }
    });
  }

  const expForm = $('expenseForm');
  if (expForm) {
    const expBtn = expForm.querySelector('button[type="submit"]');
    expForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeSupabaseAdmin?.id) {
        setStatus('Connect a Supabase admin_access account above before recording expense entries.', true);
        return;
      }
      if (expBtn) { expBtn.disabled = true; expBtn.textContent = 'Saving…'; }
      try {
        const row = {
          category: $('expenseCategory')?.value,
          amount_mwk: Number($('expenseAmount')?.value),
          spent_at: $('expenseDate')?.value,
          description: $('expenseDescription')?.value?.trim(),
          created_by: activeSupabaseAdmin.id
        };
        const { error } = await supabase.from('expense_entries').insert(row);
        if (error) {
          setStatus('Could not save expense: ' + error.message, true);
          return;
        }
        e.target.reset();
        if (ed) ed.value = new Date().toISOString().slice(0, 10);
        await loadDashboard();
      } finally {
        if (expBtn) { expBtn.disabled = false; expBtn.textContent = 'Save expense'; }
      }
    });
  }

  await loadDashboard();
}

start();
