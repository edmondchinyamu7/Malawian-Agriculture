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

// Submit a payment reference for administrator review. This does NOT activate access.
async function submitPaymentRequest() {
  if (!selectedPlanForPayment) return;

  const isNy = currentLang === 'ny';
  const alertBox = document.getElementById('paymentAlert');
  const refInput = document.getElementById('paymentRefInput');
  const refValue = refInput ? refInput.value.trim() : '';
  const confirmBtn = document.getElementById('btnConfirmPayment');

  const showAlert = (message, type = 'error') => {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = 'payment-alert ' + type;
    alertBox.style.display = 'block';
  };

  if (!refValue) {
    showAlert(isNy
      ? 'Chonde lembani nambala ya chitupa cha malipiro.'
      : 'Please enter your transaction reference.');
    return;
  }

  const acc = await getAccount().catch(() => null);
  if (!acc?.user?.id) {
    showAlert(isNy
      ? 'Chonde lowani mu akaunti yanu musanatumize malipiro.'
      : 'Please sign in before submitting a payment reference.');
    return;
  }

  const originalText = confirmBtn ? confirmBtn.textContent : '';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = isNy ? 'Zikutumizidwa…' : 'Submitting for review…';
  }

  try {
    const amount = currentBilling === 'yearly'
      ? selectedPlanForPayment.yearly_price
      : selectedPlanForPayment.monthly_price;

    const { error } = await supabase.from('subscriptions').insert({
      user_id: acc.user.id,
      plan_id: selectedPlanForPayment.id,
      status: 'pending',
      provider: 'manual',
      provider_reference: refValue,
      billing_period: currentBilling,
      amount_mwk: amount,
      started_at: null,
      expires_at: null,
      auto_renewing: false
    });

    if (error) throw error;

    showAlert(isNy
      ? 'Zikomo. Pempho lanu la malipiro latumizidwa kuti liyang’anidwe. Umembala udzatsegulidwa pambuyo potsimikizira malipiro.'
      : 'Payment reference submitted for review. Your paid membership will remain locked until payment is verified.', 'success');

    setTimeout(() => {
      closePaymentModal();
      showToast(isNy
        ? 'Pempho latumizidwa; likuyembekezera kutsimikizidwa.'
        : 'Payment submitted; awaiting verification.');
      renderCards();
    }, 2200);
  } catch (error) {
    console.error('Payment submission failed:', error);
    showAlert(isNy
      ? 'Sitinathe kutumiza pempho lanu. Chonde yesaninso kapena funsani thandizo.'
      : 'We could not submit your request. Please try again or contact support.');
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

  // Remove legacy browser-only upgrades. Paid access must come from verified database state.
  localStorage.removeItem('ulimi_simulated_plan');
  localStorage.removeItem('ulimi_plan_ref');


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

  const confirmPaymentBtn = document.getElementById('btnConfirmPayment');
  if (confirmPaymentBtn) confirmPaymentBtn.addEventListener('click', submitPaymentRequest);

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

  // 7. Manuals Download & Reading Handler (Professional & Agribusiness)
  const manuals = {
    maize: {
      title: "Buku la Ulimi wa Chimanga ku Malawi",
      title_en: "Malawi Maize Production Field Guide",
      subtitle: "Njira Zabwino Zokwezera Zokolola za Chimanga (2026)",
      content: `
        <div style="font-size:13px;line-height:1.7;color:#284234;">
          <h4 style="color:#092d22;margin:12px 0 6px;">1. Kukonzekera Munda ndi Kubzala</h4>
          <p>Konzani mizere ya 75cm. Dzalanani mbewu imodzi pa dzenje lililonse pa mtunda wa 25cm. Izi zimapereka mbewu zokwana 53,333 pa hekitala imodzi (pafupifupi 21,500 pa ekala).</p>
          
          <h4 style="color:#092d22;margin:12px 0 6px;">2. Kuthira Feteleza Woyambira (Basal Dressing)</h4>
          <p>Gwiritsani ntchito feteleza wa <strong>23:10:5 + 6S + 1Zn</strong>. Thirani feteleza pobzala kapena pasanathe masiku 7 mbewu zitamera. Mlingo: Chivundikiro chimodzi cha botolo la mowa kapena kwasakwasa (chigubu) pambali pa dzenje la mbewu, pafupifupi 5cm kuchokera pa mtengo.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">3. Feteleza wa Pamwamba (Top Dressing - Urea)</h4>
          <p>Thirani <strong>Urea (46% N)</strong> pamene chimanga chafika m'mawondo (masabata 3 mpaka 4 mutabzala). Feteleza aziyikidwa pa nthaka yonyowa ndipo muphimbe nthawi yomweyo kuti mpweya wa nayitrojeni usapite m'mwamba.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">4. Kuthana ndi Mbozi ya Kasikisi (Fall Armyworm)</h4>
          <p>Fufuzani m'munda kawiri pa sabata. Ngati mwaona mbozi pa mitengo 10 pa 100 iliyonse, tsirani mankhwala ovomerezeka monga Emamectin Benzoate (Proclaim) m'mawa kwambiri kapena madzulo. Mutha kuthiranso phulusa kapena mchenga m'mitima ya chimanga.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">5. Kukolola ndi Kusunga Zokolola</h4>
          <p>Kololani chimanga chikauma bwino pa chinyezi chosapitirira 12.5%. Gwiritsani ntchito matumba a <strong>PICS (Purdue Improved Crop Storage)</strong> amene alibe mpweya kuti muteteze zokolola popanda mankhwala owopsa a kachasu kapena fumbi.</p>
        </div>
      `
    },
    legumes: {
      title: "Maupangiri a Ulimi wa Mtedza ndi Soya",
      title_en: "Groundnut & Soybean Yield Handbook",
      subtitle: "Kusamalira Mitundu Yovomerezeka ku Malawi",
      content: `
        <div style="font-size:13px;line-height:1.7;color:#284234;">
          <h4 style="color:#092d22;margin:12px 0 6px;">1. Mitundu ya Mtedza Yovomerezeka</h4>
          <p><strong>CG7:</strong> Mtundu wabwino wopatsa mafuta ambiri komanso wogulitsidwa pamitengo yabwino. <strong>Nsinjiro & Chitala:</strong> Zosachedwa kucha komanso zopirira chilala m'maboma a m'mbali mwa nyanja ndi m'zigwa.</p>
          
          <h4 style="color:#092d22;margin:12px 0 6px;">2. Makulidwe a Mizere ndi Kubzala</h4>
          <p>Dzalanani mtedza mizere iwiri pa mzere umodzi wa 75cm, pa mtunda wa 15cm pakati pa mbewu. Izi zimateteza mtedza ku matenda a Chikasu (Groundnut Rosette Virus) chifukwa kafadala sangathe kulowa mosavuta pa munda wophimbidwa.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">3. Ulimi wa Soya ndi Inoculant</h4>
          <p>Mukadzala soya, sakanizani mbewu ndi mankhwala opatsa tizilombo tachilengedwe ta <em>Rhizobium Inoculant</em>. Izi zimathandiza kuti mtedza ndi soya zizidzitengera zokha nayitrojeni m'mpweya popanda kufunika feteleza wambiri wogula.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">4. Kupewa Chenzi la Aflatoxin</h4>
          <p>Osasiya mtedza pansi pamtunda utakolola. Yanikani mtedza pa machira kapena zikwa pamtunda kuti uume mwamsanga komanso kupewa bowa wowopsa wa aflatoxin umene ungakanidwe pamsika wa kunja.</p>
        </div>
      `
    },
    mbeya: {
      title: "Kupanga ndi Kugwiritsa Ntchito Feteleza wa Mbeya",
      title_en: "Mbeya Organic Fertiliser Guide",
      subtitle: "Njira Yaulimi Wotsika Mtengo Pogwiritsa Ntchito Zipangizo za m'Khola",
      content: `
        <div style="font-size:13px;line-height:1.7;color:#284234;">
          <h4 style="color:#092d22;margin:12px 0 6px;">1. Zipangizo Zofunika</h4>
          <ul>
            <li>Manyowa a ng'ombe, mbuzi kapena nkhuku: <strong>Makilogalamu 20</strong></li>
            <li>Madeya a chimanga kapena mpunga: <strong>Makilogalamu 20</strong></li>
            <li>Phulusa loyera lophika: <strong>Makilogalamu 10</strong></li>
            <li>Feteleza wa m'fakitale (23:10:5 kapena CAN): <strong>Makilogalamu 5 okha</strong></li>
            <li>Madzi abwino aukhondo: <strong>Malita 20</strong></li>
          </ul>
          
          <h4 style="color:#092d22;margin:12px 0 6px;">2. Kusakaniza ndi Kuwundika</h4>
          <p>Thirani manyowa, madeya, phulusa ndi feteleza wa makilogalamu 5 pa malo amthunzi. Sakanizani bwinobwino pamene mukuwaza madzi pang'onopang'ono. Kani nthaka ndi dzanja lanu: madzi sayenera kudontha koma azingokhala onyowa chabe.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">3. Nthawi ya Kuwundika (Masiku 21)</h4>
          <p>Phimbani hepiyo ndi pulasitiki yakuda mwamphamvu kuti mpweya usalowe. Tembenuzani fetelezayo sabata iliyonse. Pakatha masiku 21, fetelezayo amakhala wozizira, wakuda ndipo wokonzeka kugwiritsidwa ntchito m'munda.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">4. Mlingo m'Munda</h4>
          <p>Thirani dzanja limodzi modzaza pa dzenje lililonse la chimanga pobzala. Feteleza wa Mbeya amakhalitsa m'nthaka zaka ziwiri mpaka zitatu ndipo amasunga chinyezi.</p>
        </div>
      `
    },
    soil: {
      title: "Kusamalira Nthaka ndi Madzi m'Munda",
      title_en: "Soil & Water Conservation Field Guide",
      subtitle: "Kupanga Mipanda ndi Kusunga Chinyezi m'Madambo ndi m'Mapiri",
      content: `
        <div style="font-size:13px;line-height:1.7;color:#284234;">
          <h4 style="color:#092d22;margin:12px 0 6px;">1. Kupanga Mipanda ya Nthaka ndi A-Frame</h4>
          <p>Gwiritsani ntchito chipangizo cha A-frame kuti mupeze mzere wolunjika pa mapiri. Pangani mipanda yotchinga madzi (contour ridges) kuti madzi a mvula asakokolole dothi lonona.</p>
          
          <h4 style="color:#092d22;margin:12px 0 6px;">2. Kubzala Msipu wa Vetiver</h4>
          <p>Bzalani msipu wakuya wa Vetiver pambali pa mipanda. Muzu wa vetiver umalowa pansi kwambiri (mpaka mamita 3) ndipo umalimbitsa nthaka kuti madzi asagwetse mizere panthawi ya mphepo ndi mikunzo.</p>

          <h4 style="color:#092d22;margin:12px 0 6px;">3. Manyowa Obisa (Mulching)</h4>
          <p>Phimbani munda ndi udzu wouma, masamba kapena zotsala za chimanga. Izi zimachepetsa kutentha kwa nthaka ndi kupewa kuti madzi asamweke ndi dzuwa panthawi ya chilala.</p>
        </div>
      `
    }
  };

  document.querySelectorAll('.manual-download-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const manualKey = btn.getAttribute('data-manual');
      const manual = manuals[manualKey];
      if (!manual) return;

      const isNy = currentLang === 'ny';
      const hasProAccess = userAccess.plan_id === 'professional' || userAccess.plan_id === 'agribusiness';

      if (!hasProAccess) {
        const proceedUpgrade = confirm(
          isNy
            ? `Buku ili ("${manual.title}") likupezeka pa umembala wa Professional Farmer kapena Agribusiness Premium. Mukufuna kukweza plan yanu kuti mutsegule mabuku onse a m'munda?`
            : `This field guide ("${manual.title_en}") requires Professional Farmer or Agribusiness Premium. Would you like to upgrade your membership to unlock all downloadable guides?`
        );
        if (proceedUpgrade) {
          const proPlan = DEFAULT_PLANS.find(p => p.id === 'professional');
          if (proPlan) openPaymentModal(proPlan);
        }
        return;
      }

      // Open formatted manual modal for reading & printing
      const modal = document.getElementById('manualModal');
      const titleEl = document.getElementById('manualModalTitle');
      const subtitleEl = document.getElementById('manualModalSubtitle');
      const bodyEl = document.getElementById('manualModalBody');

      if (modal && bodyEl) {
        titleEl.textContent = isNy ? manual.title : manual.title_en;
        subtitleEl.textContent = manual.subtitle;
        bodyEl.innerHTML = `
          <div style="background:#f4f9f6;border:1px solid #d8e8dd;border-radius:12px;padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span style="font-size:12px;font-weight:700;color:#134b34;">📄 Ulimi wa Malawi • Buku Lotsimikizika la Alimi</span>
            <button id="btnPrintManual" type="button" class="btn btn-primary" style="padding:7px 14px;font-size:12px;">🖨️ Sindikizani / Print PDF</button>
          </div>
          ${manual.content}
        `;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');

        const printBtn = document.getElementById('btnPrintManual');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            window.print();
          });
        }
      }
    });
  });

  const manualClose = document.getElementById('manualModalClose');
  const manualModal = document.getElementById('manualModal');
  if (manualClose) manualClose.addEventListener('click', () => manualModal.classList.remove('open'));
  if (manualModal) {
    manualModal.addEventListener('click', (e) => {
      if (e.target === manualModal) manualModal.classList.remove('open');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubscriptions, { once: true });
} else {
  initSubscriptions();
}

