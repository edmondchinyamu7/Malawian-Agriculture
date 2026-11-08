import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
  'https://pwoyfialzlwxamhawfyy.supabase.co',
  'sb_publishable_KBnv1nmCc_iKGcTro_Z-aQ_uhW8Qv5J',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

window.ulimiSupabase = supabase;

const initials = (a, b, fallback = 'U') => {
  const first = (String(a || '')[0] || '').toUpperCase();
  const last = (String(b || '')[0] || '').toUpperCase();
  return (first + last) || fallback;
};

export async function getAccount() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    let profile = {
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      role: 'farmer'
    };

    try {
      const { data, error } = await supabase.from('profiles').select('first_name,last_name,role').eq('id', user.id).maybeSingle();
      if (!error && data) {
        profile = { ...profile, ...data };
      }
    } catch (_) {}

    return { user, profile };
  } catch (err) {
    console.warn('Unable to get user account:', err?.message || err);
    return null;
  }
}

export async function logoutUser() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_) {}
  window.location.assign('/login.html');
}

export async function initAuth() {
  const login = document.getElementById('accountLoginLink');
  const menu = document.getElementById('profileMenu');
  const button = document.getElementById('profileMenuButton');
  const drop = document.getElementById('profileDropdown');

  try {
    const a = await getAccount();
    if (a?.user?.id) {
      const { error: activityError } = await supabase.from('app_activity_events').insert({ user_id: a.user.id, event_name: 'app_open' });
      if (activityError && activityError.code !== '23505') console.warn('Activity tracking notice:', activityError.message);
    }
    if (login) login.hidden = !!a;
    if (menu) menu.hidden = !a;

    if (a && button) {
      const fn = a.profile?.first_name || '';
      const ln = a.profile?.last_name || '';
      const emailInitial = a.user?.email ? a.user.email[0].toUpperCase() : 'U';
      button.textContent = initials(fn, ln, emailInitial);
      const fullName = [fn, ln].filter(Boolean).join(' ') || a.user.email;
      button.title = `${fullName} (${a.profile?.role === 'admin' ? 'Admin' : 'Farmer'})`;
    }
  } catch (e) {
    console.warn('Auth init check notice:', e?.message || e);
  }

  if (button && drop && !button.dataset.bound) {
    button.dataset.bound = 'true';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = drop.hidden;
      drop.hidden = !isHidden;
      button.setAttribute('aria-expanded', String(isHidden));
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#profileMenu')) {
        drop.hidden = true;
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const logout = document.getElementById('accountLogoutButton');
  if (logout && !logout.dataset.bound) {
    logout.dataset.bound = 'true';
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth, { once: true });
} else {
  initAuth();
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    const l = document.getElementById('accountLoginLink');
    const m = document.getElementById('profileMenu');
    if (l) l.hidden = false;
    if (m) m.hidden = true;
  } else if (session) {
    setTimeout(initAuth, 10);
  }
});
