import { supabase } from './auth.js';

const PLAN_LEVEL = { free: 0, standard: 1, professional: 2, agribusiness: 3 };
const PLAN_LABELS = {
  free: 'Free Farmer',
  standard: 'Standard Farmer',
  professional: 'Professional Farmer',
  agribusiness: 'Agribusiness Premium'
};

export async function getSubscriptionAccess() {
  let access = { plan_id: 'free', plan_name: PLAN_LABELS.free, ads_enabled: true, expires_at: null };
  try {
    const { data, error } = await supabase.rpc('get_my_subscription_access');
    if (!error && data && data.plan_id) {
      access = data;
    }
  } catch (err) {
    console.warn('Subscription RPC notice:', err?.message || err);
  }

  // Fail closed: browser storage is never proof of a paid subscription.

  return access;
}

function showPlanLock(main, requiredPlan, access) {
  const requiredName = PLAN_LABELS[requiredPlan] || 'a paid membership';
  const currentName = access.plan_name || PLAN_LABELS.free;
  const isNy = (localStorage.getItem('ulimi_lang') || 'ny') === 'ny';

  const panel = document.createElement('section');
  panel.className = 'plan-access-panel';
  panel.setAttribute('role', 'status');
  panel.innerHTML = `
    <div class="plan-access-icon" aria-hidden="true">🔒</div>
    <span class="section-kicker">${isNy ? 'CHOCHITIKA CHA UMEMBALA' : 'MEMBERSHIP FEATURE'}</span>
    <h2>${isNy ? `Gawo ili likusowa umembala wa ${requiredName}` : `This resource requires ${requiredName}`}</h2>
    <p>${isNy 
      ? `Umembala wanu wapano ndi <strong>${currentName}</strong>. Kwezani plan yanu kuti mutsegule chida ichi ndi zida zina zapamwamba za ulimi ku Malawi.` 
      : `Your current membership is <strong>${currentName}</strong>. Upgrade your plan to unlock this resource and other advanced Malawian farming tools.`}</p>
    <a class="btn btn-primary" href="/pages/subscriptions.html">${isNy ? 'Onani Mapulani a Umembala ↗' : 'View Membership Plans ↗'}</a>
  `;
  main.querySelectorAll(':scope > *').forEach(node => {
    node.hidden = true;
    node.setAttribute('aria-hidden', 'true');
  });
  main.prepend(panel);
  main.classList.add('plan-locked');
}

async function initialiseFeatureAccess() {
  const main = document.querySelector('[data-requires-plan]');
  if (!main) return;
  const requiredPlan = main.dataset.requiresPlan;
  if (!(requiredPlan in PLAN_LEVEL)) return;

  const access = await getSubscriptionAccess();
  const currentLevel = PLAN_LEVEL[access.plan_id] ?? 0;
  const requiredLevel = PLAN_LEVEL[requiredPlan];

  if (currentLevel < requiredLevel) {
    showPlanLock(main, requiredPlan, access);
    return;
  }

  main.dataset.accessGranted = 'true';
  main.dataset.currentPlan = access.plan_id;
  document.dispatchEvent(new CustomEvent('ulimi:subscription-access', { detail: access }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseFeatureAccess, { once: true });
} else {
  initialiseFeatureAccess();
}
