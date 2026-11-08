import { supabase } from './auth.js';

const PLAN_LEVEL = { free: 0, standard: 1, professional: 2, agribusiness: 3 };
const PLAN_LABELS = {
  free: 'Free Farmer',
  standard: 'Standard Farmer',
  professional: 'Professional Farmer',
  agribusiness: 'Agribusiness Premium'
};

export async function getSubscriptionAccess() {
  const { data, error } = await supabase.rpc('get_my_subscription_access');
  if (error) {
    console.error('Subscription access check failed:', error.message);
    return { plan_id: 'free', plan_name: PLAN_LABELS.free, ads_enabled: true, expires_at: null, access_check_failed: true };
  }
  return data || { plan_id: 'free', plan_name: PLAN_LABELS.free, ads_enabled: true, expires_at: null };
}

function showPlanLock(main, requiredPlan, access) {
  const requiredName = PLAN_LABELS[requiredPlan] || 'a paid membership';
  const currentName = access.plan_name || PLAN_LABELS.free;
  const panel = document.createElement('section');
  panel.className = 'plan-access-panel';
  panel.setAttribute('role', 'status');
  panel.innerHTML = `
    <div class="plan-access-icon" aria-hidden="true">🔒</div>
    <span class="section-kicker">MEMBERSHIP FEATURE</span>
    <h2>This resource requires ${requiredName}</h2>
    <p>Your current membership is <strong>${currentName}</strong>. Upgrade your plan to unlock this resource and other included farming tools.</p>
    <a class="btn btn-primary" href="/pages/subscriptions.html">View membership plans</a>
    ${access.access_check_failed ? '<small>We could not verify your membership right now. Please try again later.</small>' : ''}
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
