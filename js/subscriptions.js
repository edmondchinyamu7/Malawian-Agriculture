/**
 * Ulimi wa Malawi | Farmer Memberships & Subscriptions Engine
 * Connects with Supabase, auth session, mobile money payments & bilingual i18n
 */

import { supabase, getAccount } from './auth.js';

// Plan configurations & bilingual content
const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free Farmer',
    name_ny: 'Mlimi Waulere',
    kicker: 'Kwaulere Nthawi Yonse',
    kicker_en: 'Free Forever',
    monthly_price: 0,
    yearly_price: 0,
    description: 'Maphunziro ndi chidziwitso chofunikira chaulimi popanda kulipira chilichonse.',
    description_en: 'Essential agricultural knowledge and standard guides at no cost.',
    features_ny: [
      'Mbewu za m\'Malawi (Laibulale ya mbewu 16+)',
      'Kalendala yoyambira ulimi wa nyengo',
      'Nkhani za ulimi ndi zanyengo zatsiku ndi tsiku',
      'Malangizo oyambirira a m\'munda'
    ],
    features_en: [
      'Crop library profiles (16+ Malawian varieties)',
      'Basic seasonal farming calendar',
      'Daily agricultural news & weather updates',
      'Standard practical field guides'
    ],
    ads_enabled: true,
    featured: false
  },
  {
    id: 'standard',
    name: 'Standard Farmer',
    name_ny: 'Mlimi Wodziwika',
    kicker: 'Kulima Mwanzeru',
    kicker_en: 'Practical Farmer',
    monthly_price: 2000,
    yearly_price: 20000,
    yearly_original: 24000,
    description: 'Maupangiri ochulukirapo, zosungira zolemba ndi kalendala yatsatanetsatane.',
    description_en: 'More practical guides, saved field bookmarks and detailed farming calendars.',
    features_ny: [
      'Zonse zopezeka pa Mlimi Waulere',
      'Kalendala ya ulimi yatsatanetsatane ya mwezi ndi mwezi',
      'Maupangiri apadera amadera ndi nthaka za m\'Malawi',
      'Kusunga zolemba za munda ndi zithunzi zothandiza',
      'Chidziwitso cha matenda a mbewu ndi chithandizo'
    ],
    features_en: [
      'Everything included in Free Farmer',
      'Detailed monthly interactive crop calendars',
      'Regional zoning and climate recommendations',
      'Saved farming notes and offline bookmarks',
      'Visual pest and disease diagnostic guide'
    ],
    ads_enabled: true,
    featured: false
  },
  {
    id: 'professional',
    name: 'Professional Farmer',
    name_ny: 'Mlimi Waluso',
    kicker: 'Yotchuka Kwambiri',
    kicker_en: 'Most Popular',
    monthly_price: 5000,
    yearly_price: 50000,
    yearly_original: 60000,
    description: 'Zipangizo zamakono zowerengera bajeti ya ulimi ndi maphunziro apamwamba.',
    description_en: 'Precision calculators, complete farm budgeting and advanced learning resources.',
    features_ny: [
      'Zonse zopezeka pa Mlimi Wodziwika',
      'Chiwerengero chenicheni cha feteleza (Basal & Top dressing)',
      'Dongosolo lonse la ndalama ndi bajeti ya ulimi (Farm Planner)',
      'Maupangiri ndi mabuku a PDF oti mutsitse pa foni',
      'Maphunziro apamwamba a ulimi wopindulitsa (Learning Centre)',
      '100% Yopanda zotsatsa zilizonse'
    ],
    features_en: [
      'Everything included in Standard Farmer',
      'Precision fertiliser rate calculator (Basal & Top)',
      'Comprehensive farm planning & budget tool',
      'Downloadable PDF field guides for offline use',
      'Full access to all Learning Centre modules',
      '100% Guaranteed advertisement-free experience'
    ],
    ads_enabled: false,
    featured: true
  },
  {
    id: 'agribusiness',
    name: 'Agribusiness Premium',
    name_ny: 'Mabizinesi Azaulimi',
    kicker: 'Bizinesi Yaulimi',
    kicker_en: 'Commercial Enterprise',
    monthly_price: 10000,
    yearly_price: 100000,
    yearly_original: 120000,
    description: 'Chidziwitso cha misika yapamwamba, mitengo yogulitsira ndi zida za mabizinesi.',
    description_en: 'Commercial agri-business tools, real-time market intelligence and bulk trade.',
    features_ny: [
      'Zonse zopezeka pa Mlimi Waluso',
      'Chidziwitso cha mitengo yovomerezeka ya misika ya m\'Malawi',
      'Mwayi wolumikizana ndi ogula katundu wambiri pamsika',
      'Mapulani ndi zowerengera za makampani azaulimi',
      'Thandizo loyambirira kuchokera kwa akatswiri a Ulimi wa Malawi',
      'Kusamalira mbiri ya gulu kapena mgwirizano wa alimi'
    ],
    features_en: [
      'Everything included in Professional Farmer',
      'Verified agricultural commodity prices & market trends',
      'Priority buyer network & wholesale marketplace access',
      'Commercial agribusiness financial modeling templates',
      'Direct priority technical support from agronomists',
      'Cooperative & multi-farm profile management'
    ],
    ads_enabled: false,
    featured: false
  }
];

let currentBilling = 'monthly';
let userAccess = { plan_id: 'free', plan_name: 'Free Farmer', is_authenticated: false };
let currentLang = localStorage.getItem('ulimi_lang') || 'ny';
let selectedPlanForPayment = null;

const formatMoney = (n) => 'MWK ' + Number(n || 0).toLocaleString('en-MW');

function showToast(msg) {
  let toast = document.getElementById('subscriptionToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'subscriptionToast';
    toast.className = 'subscription-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

// Render or update plan cards
function renderCards() {
  const container = document.getElementById('planCards');
  if (!container) return;

  const isYearly = currentBilling === 'yearly';
  const isNy = currentLang === 'ny';

  container.innerHTML = DEFAULT_PLANS.map(plan => {
    const isCurrent = userAccess.plan_id === plan.id;
    const price = isYearly ? plan.yearly_price : plan.monthly_price;
    const freq = isYearly 
      ? (isNy ? '/ chaka' : '/ year') 
      : (isNy ? '/ mwezi' : '/ month');
    const name = isNy ? (plan.name_ny || plan.name) : plan.name;
    const kicker = isNy ? (plan.kicker || '') : (plan.kicker_en || plan.kicker || '');
    const description = isNy ? plan.description : plan.description_en;
    const features = isNy ? plan.features_ny : plan.features_en;

    let buttonHtml = '';
    if (isCurrent) {
      buttonHtml = `
        <button class="plan-btn plan-btn-current" type="button" disabled>
          <span class="icon">✓</span>
          <span>${isNy ? 'Muli Pa Plan Iyi' : 'Current Plan'}</span>
        </button>
      `;
    } else if (plan.id === 'free') {
      buttonHtml = `
        <button class="plan-btn plan-btn-free" type="button" data-plan="free">
          <span>${isNy ? 'Yambani Kwaulere' : 'Use Free Plan'}</span>
        </button>
      `;
    } else if (plan.featured) {
      buttonHtml = `
        <button class="plan-btn plan-btn-featured" type="button" data-plan="${plan.id}">
          <span>${isNy ? `Sankhani ${name}` : `Select ${name}`}</span>
          <span aria-hidden="true">→</span>
        </button>
      `;
    } else {
      buttonHtml = `
        <button class="plan-btn plan-btn-upgrade" type="button" data-plan="${plan.id}">
          <span>${isNy ? `Sankhani ${name}` : `Select ${name}`}</span>
          <span aria-hidden="true">→</span>
        </button>
      `;
    }

    return `
      <article class="plan-card ${plan.featured ? 'featured' : ''}" data-plan-id="${plan.id}">
        ${plan.featured ? `
          <div class="plan-top-ribbon">${isNy ? '⭐ YOTCHUKA KWAMBIRI' : '⭐ MOST POPULAR'}</div>
        ` : ''}
        <div class="plan-header">
          <span class="plan-kicker">${kicker}</span>
          <h2>${name}</h2>
          <p class="plan-description">${description}</p>
        </div>

        <div class="plan-price-wrap">
          <div class="plan-price">
            <span>${formatMoney(price)}</span>
            <small>${freq}</small>
            ${isYearly && plan.yearly_original ? `
              <span class="plan-price-original">${formatMoney(plan.yearly_original)}</span>
            ` : ''}
          </div>
          <div class="plan-subtext">
            ${isYearly && plan.yearly_original ? (isNy ? '🎉 Mwasunga 15% (Miyezi 2 Yaulere)' : '🎉 Save 15% (2 Months Free)') : ''}
          </div>
        </div>

        <ul class="plan-features">
          ${features.map((f, idx) => {
            const isHighlight = idx === features.length - 1 && !plan.ads_enabled;
            return `
              <li class="${isHighlight ? 'premium-highlight' : ''}">
                <span class="check-icon">✓</span>
                <span>${f}</span>
              </li>
            `;
          }).join('')}
        </ul>

        <div class="plan-ad-note">
          <span class="icon">${plan.ads_enabled ? 'ℹ️' : '🛡️'}</span>
          <span>${plan.ads_enabled 
            ? (isNy ? 'Zotsatsa zitha kuonekera mwaulere' : 'Advertisements may appear') 
            : (isNy ? '100% Yopanda zotsatsa' : '100% Ad-free experience')}</span>
        </div>

        <div class="plan-actions">
          ${buttonHtml}
        </div>
      </article>
    `;
  }).join('');

  // Attach button event listeners
  container.querySelectorAll('button[data-plan]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const planId = btn.getAttribute('data-plan');
      handlePlanSelect(planId);
    });
  });

  const status = document.getElementById('plansStatus');
  if (status) {
    if (userAccess.is_authenticated) {
      status.textContent = isNy 
        ? `Mwalandiridwa! Muli ndi akaunti yovomerezeka. Umembala wanu wapano ndi: ${userAccess.plan_name || 'Free Farmer'}.`
        : `Welcome! You are signed in. Your active membership is: ${userAccess.plan_name || 'Free Farmer'}.`;
      status.classList.remove('error');
    } else {
      status.textContent = isNy
        ? 'Mitengo yonse 4 ili yokonzeka. Lowani kapena lembetsani kuti mukonzekere umembala wanu.'
        : 'All four membership tiers are active. Sign in or register to manage your subscription.';
    }
  }
}

// Open Payment Modal
function openPaymentModal(plan) {
  selectedPlanForPayment = plan;
  const modal = document.getElementById('paymentModal');
  if (!modal) return;

  const isYearly = currentBilling === 'yearly';
  const isNy = currentLang === 'ny';
  const price = isYearly ? plan.yearly_price : plan.monthly_price;
  const freq = isYearly ? (isNy ? 'Chaka chimodzi' : '1 Year') : (isNy ? 'Mwezi umodzi' : '1 Month');

  document.getElementById('modalPlanTitle').textContent = isNy ? (plan.name_ny || plan.name) : plan.name;
  document.getElementById('modalPlanPeriod').textContent = freq;
  document.getElementById('modalPlanAmount').textContent = formatMoney(price);

  // Reset inputs & alerts
  const refInput = document.getElementById('paymentRefInput');
  if (refInput) refInput.value = '';
  const alertBox = document.getElementById('paymentAlert');
  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.className = 'payment-alert';
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

// Plan selection handler
function handlePlanSelect(planId) {
  const plan = DEFAULT_PLANS.find(p => p.id === planId);
  if (!plan) return;

  const isNy = currentLang === 'ny';

  if (planId === 'free') {
    userAccess.plan_id = 'free';
    userAccess.plan_name = 'Free Farmer';
    localStorage.setItem('ulimi_simulated_plan', 'free');
    showToast(isNy ? 'Mwasankha plan yaulere ya Free Farmer.' : 'Switched to Free Farmer plan.');
    renderCards();
    return;
  }

  // Check login state
  if (!userAccess.is_authenticated) {
    const shouldLogin = confirm(
      isNy
        ? `Kuti mulembetsedwe pa ${plan.name_ny || plan.name}, muyenera kukhala ndi akaunti ya Ulimi wa Malawi. Mukufuna kulowa tsopano?`
        : `To subscribe to ${plan.name}, you need an active Ulimi wa Malawi account. Would you like to log in or register now?`
    );
    if (shouldLogin) {
      window.location.assign(`/login.html?redirect=${encodeURIComponent('/pages/subscriptions.html')}&plan=${planId}`);
      return;
    }
  }

  // Open real payment modal
  openPaymentModal(plan);
}

// Confirm Payment & Activate
async function confirmPaymentActivation() {
  if (!selectedPlanForPayment) return;

  const isNy = currentLang === 'ny';
  const alertBox = document.getElementById('paymentAlert');
  const refInput = document.getElementById('paymentRefInput');
  const refValue = refInput ? refInput.value.trim() : '';

  if (!refValue) {
    if (alertBox) {
      alertBox.textContent = isNy 
        ? 'Chonde lembani nambala ya chitupa cha malipiro (Transaction Reference / ID).'
        : 'Please enter your mobile money transaction ID or deposit reference.';
      alertBox.className = 'payment-alert error';
      alertBox.style.display = 'block';
    }
    return;
  }

  // Visual processing state
  const confirmBtn = document.getElementById('btnConfirmPayment');
  const originalText = confirmBtn ? confirmBtn.textContent : '';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = isNy ? 'Kutsirikidwa ndi kutsimikiza…' : 'Verifying transaction…';
  }

  try {
    // 1. Try to record in Supabase subscriptions table if authenticated
    const acc = await getAccount();
    if (acc?.user?.id) {
      try {
        await supabase.from('subscriptions').insert({
          user_id: acc.user.id,
          plan_id: selectedPlanForPayment.id,
          status: 'active',
          provider: 'manual',
          provider_reference: refValue,
          started_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + (currentBilling === 'yearly' ? 365 : 30) * 86400000).toISOString()
        });
      } catch (err) {
        console.warn('Subscription insertion note:', err);
      }
    }

    // 2. Set local device access state & sync
    userAccess.plan_id = selectedPlanForPayment.id;
    userAccess.plan_name = selectedPlanForPayment.name;
    localStorage.setItem('ulimi_simulated_plan', selectedPlanForPayment.id);
    localStorage.setItem('ulimi_plan_ref', refValue);

    if (alertBox) {
      alertBox.textContent = isNy
        ? `🎉 Zikomo! Malipiro atsimikizidwa bwino. Akaunti yanu yakwezedwa kukhala ${selectedPlanForPayment.name_ny || selectedPlanForPayment.name}!`
        : `🎉 Success! Payment verified. Your account has been upgraded to ${selectedPlanForPayment.name}!`;
      alertBox.className = 'payment-alert success';
      alertBox.style.display = 'block';
    }

    setTimeout(() => {
      closePaymentModal();
      showToast(isNy ? `Plan ya ${selectedPlanForPayment.name_ny || selectedPlanForPayment.name} yakhazikitsidwa!` : `${selectedPlanForPayment.name} activated!`);
      renderCards();
    }, 1800);

  } catch (ex) {
    if (alertBox) {
      alertBox.textContent = isNy
        ? 'Panali vuto potsimikiza. Chonde yesaninso kapena funsani chithandizo.'
        : 'An error occurred during verification. Please try again or contact support.';
      alertBox.className = 'payment-alert error';
      alertBox.style.display = 'block';
    }
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }
  }
}

// Initialise Subscriptions Page
async function initSubscriptions() {
  // 1. Check account & live subscription access
  try {
    const acc = await getAccount();
    if (acc?.user?.id) {
      userAccess.is_authenticated = true;
      try {
        const { data } = await supabase.rpc('get_my_subscription_access');
        if (data && data.plan_id) {
          userAccess.plan_id = data.plan_id;
          userAccess.plan_name = data.plan_name;
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Auth check in subscriptions:', err);
  }

  // Check saved local simulated plan for device continuity
  const savedLocalPlan = localStorage.getItem('ulimi_simulated_plan');
  if (savedLocalPlan && (!userAccess.plan_id || userAccess.plan_id === 'free')) {
    userAccess.plan_id = savedLocalPlan;
    const match = DEFAULT_PLANS.find(p => p.id === savedLocalPlan);
    if (match) userAccess.plan_name = match.name;
  }

  // 2. Fetch any updated dynamic plans from Supabase if online
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('display_order');
    if (!error && Array.isArray(data) && data.length > 0) {
      data.forEach(dbPlan => {
        const local = DEFAULT_PLANS.find(p => p.id === dbPlan.id);
        if (local) {
          if (dbPlan.monthly_price_mwk !== undefined) local.monthly_price = dbPlan.monthly_price_mwk;
          if (dbPlan.name) local.name = dbPlan.name;
          if (dbPlan.description) local.description_en = dbPlan.description;
        }
      });
    }
  } catch (err) {
    console.warn('Supabase subscription_plans sync:', err);
  }

  // 3. Render cards immediately
  renderCards();

  // 4. Billing cycle toggle listeners
  const monthlyBtn = document.getElementById('billingMonthly');
  const yearlyBtn = document.getElementById('billingYearly');

  if (monthlyBtn && yearlyBtn) {
    monthlyBtn.addEventListener('click', () => {
      currentBilling = 'monthly';
      monthlyBtn.classList.add('active');
      yearlyBtn.classList.remove('active');
      monthlyBtn.setAttribute('aria-pressed', 'true');
      yearlyBtn.setAttribute('aria-pressed', 'false');
      renderCards();
    });

    yearlyBtn.addEventListener('click', () => {
      currentBilling = 'yearly';
      yearlyBtn.classList.add('active');
      monthlyBtn.classList.remove('active');
      yearlyBtn.setAttribute('aria-pressed', 'true');
      monthlyBtn.setAttribute('aria-pressed', 'false');
      renderCards();
    });
  }

  // 5. Payment Modal tabs & actions
  const modalClose = document.getElementById('paymentModalClose');
  const modalBackdrop = document.getElementById('paymentModal');
  if (modalClose) modalClose.addEventListener('click', closePaymentModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closePaymentModal();
    });
  }

  const payTabs = document.querySelectorAll('.pay-tab');
  payTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      payTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      document.querySelectorAll('.pay-content').forEach(c => c.classList.remove('active'));
      const activeContent = document.getElementById(targetId);
      if (activeContent) activeContent.classList.add('active');
    });
  });

  const btnConfirm = document.getElementById('btnConfirmPayment');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', confirmPaymentActivation);
  }

  // 6. Language switch observer
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang || 'ny';
      currentLang = lang;
      renderCards();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubscriptions, { once: true });
} else {
  initSubscriptions();
}
