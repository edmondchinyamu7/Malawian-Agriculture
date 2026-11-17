/**
 * Ulimi wa Malawi | Crop Library Controller
 * Rich Bilingual (Chichewa default / English) Cards with SVG Iconography
 */
import { escapeHtml, openModal } from './main.js';
import { getCurrentLang } from './i18n.js';
import { getIconSvg, pickCropIconName } from './icons.js';

let cropData = [];
let activeCropGroup = 'All crops';

const groupMeta = [
  { id: 'All crops', ny: 'Mbewu zonse', en: 'All crops' },
  { id: 'Cereals', ny: 'Chimanga & Tirigu', en: 'Cereals' },
  { id: 'Legumes', ny: 'Mtedza & Nyemba', en: 'Legumes' },
  { id: 'Root crops', ny: 'Mbewu za mizu', en: 'Root crops' },
  { id: 'Vegetables', ny: 'Masamba', en: 'Vegetables' },
  { id: 'Cash crops', ny: 'Mbewu za malonda', en: 'Cash crops' }
];

const chichewaSummaries = {
  maize: "Mbewu yaikulu ya chakudya ku Malawi, yolimidwa ndi alimi oposa 90% m'dziko lonselo.",
  groundnut: "Mbewu yofunika ya mtundu wa nyemba yopatsa chuma, mafuta odyera, komanso yothira nayitrojeni m'nthaka.",
  soybean: "Mbewu yodzaza ndi mapuloteni, yopangira mafuta odyera, chakudya cha ziweto ndi kudyetsa mabanja.",
  rice: "Mbewu yaikulu ya chakudya ndi malonda yolimidwa m'madambo, m'mbali mwa nyanja ndi m'minda yothirira.",
  cassava: "Mbewu yopirira chilala yoteteza ku njala, yosavuta kulima komanso yosunga chakudya m'nthaka.",
  sweetpotato: "Mbewu yabwino yopatsa mphamvu, yoyenda mwachangu komanso yosafuna feteleza wambiri.",
  pigeonpea: "Mbewu ya nyemba yopirira chilala kwambiri, yokonza nthaka ndi kupatsa alimi phindu ku chigawo cha kumwera.",
  tomato: "Masamba amakono opatsa ndalama mwachangu pamsika koma ofunika kasamalidwe kabwino ka mankhwala.",
  beans: "Mbewu ya nyemba yodyera ndi nsima, yofunika kwambiri m'maboma otentha pang'ono ndi m'mapiri.",
  sorghum: "Mbewu zakale zolimba zopirira dzuwa ndi kulephera kwa mvula m'chigwa cha Shire ndi m'madera ouma.",
  millet: "Mchewere ndi mawere ndi mbewu zolimba zopirira chilala zomwe zimasunga thanzi ndi chakudya kwa nthawi yayitali.",
  sunflower: "Mbewu yopatsa mafuta odyera abwino kwambiri komanso ndalama zambiri pamsika.",
  irishpotato: "Mbewu ya ndalama zambiri yolimidwa m'maboma ozizira monga Dedza, Ntcheu ndi Nyika.",
  cotton: "Mbewu yaikulu ya malonda ya m'madera otentha opatsa alimi ndalama zakunja.",
  tobacco: "Mbewu yakale yopatsa chuma ndi ndalama za m'Malawi, yofuna luso la kusamala ndi kuyanika.",
  tea: "Mbewu ya malonda ya m'mapiri a mvula yambiri ku Mulanje, Thyolo ndi Nkhata Bay.",
  coffee: "Khofi wa Arabica wolimidwa m'mapiri ataliatali monga Misuku Hills ndi Viphya.",
  vegetables: "Masamba amsanga obweretsa chakudya chatsiku ndi tsiku komanso ndalama mwachangu pamsika."
};

export async function loadCropData() {
  const grid = document.getElementById('cropGrid');
  try {
    const basePath = window.location.pathname.includes('/pages/') ? '../data/' : 'data/';
    const response = await fetch(`${basePath}crops.json`);
    if (!response.ok) throw new Error('Failed to load crop data');
    cropData = await response.json();
    renderCropFilters();
    renderCrops();
  } catch (err) {
    console.error('Error loading crop data:', err);
    if (grid) {
      grid.innerHTML = `<div class="empty">Unable to load the crop library right now. Please refresh the page or check your connection.</div>`;
    }
  }
}

export function renderCropFilters() {
  const container = document.getElementById('cropFilters');
  if (!container) return;

  const lang = getCurrentLang();

  container.innerHTML = groupMeta.map(grp => {
    const label = lang === 'ny' ? grp.ny : grp.en;
    const isActive = grp.id === activeCropGroup;
    return `
      <button class="filter ${isActive ? 'active' : ''}" type="button" data-crop-group="${escapeHtml(grp.id)}">
        ${escapeHtml(label)}
      </button>
    `;
  }).join('');
}

export function renderCrops() {
  const grid = document.getElementById('cropGrid');
  const searchInput = document.getElementById('cropSearch');
  const countEl = document.getElementById('cropCount');

  if (!grid) return;

  const lang = getCurrentLang();
  const query = (searchInput?.value || '').trim().toLowerCase();

  const filtered = cropData.filter(crop => {
    const matchGroup = activeCropGroup === 'All crops' || crop.group === activeCropGroup;
    const matchQuery = !query || [
      crop.ch,
      crop.en,
      crop.group,
      crop.summary,
      chichewaSummaries[crop.id] || '',
      crop.ecologicalSuitability || '',
      ...(crop.uses || [])
    ].join(' ').toLowerCase().includes(query);
    return matchGroup && matchQuery;
  });

  if (countEl) {
    countEl.textContent = lang === 'ny'
      ? `Mbewu ${filtered.length}`
      : `${filtered.length} ${filtered.length === 1 ? 'crop' : 'crops'}`;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty">
        ${lang === 'ny'
          ? `Palibe mbewu yofananizidwa ndi mawu oti "${escapeHtml(query)}". Yesani kufufuza dzina lina kapena sankhani gulu lonse la mbewu.`
          : `No crops found matching "${escapeHtml(query)}". Try another search keyword or switch crop group.`}
      </div>
    `;
    return;
  }

  const pinSvg = getIconSvg('mapPin', 'pro-icon');
  const calSvg = getIconSvg('calendar', 'pro-icon');
  const wheatSvg = getIconSvg('wheat', 'pro-icon');

  grid.innerHTML = filtered.map(c => {
    const grp = groupMeta.find(g => g.id === c.group);
    const groupLabel = lang === 'ny' ? (grp?.ny || c.group) : c.group;
    const title = lang === 'ny' ? c.ch : c.en;
    const subtitle = lang === 'ny' ? `${c.en} · ${groupLabel}` : `${c.ch} · ${groupLabel}`;
    const summary = lang === 'ny' ? (chichewaSummaries[c.id] || c.summary) : c.summary;
    const buttonText = lang === 'ny' ? 'Werengani malangizo a mbewu →' : 'Explore crop guide →';
    const plantLabel = lang === 'ny' ? 'Kubzala:' : 'Planting:';
    const harvestLabel = lang === 'ny' ? 'Kukolola:' : 'Harvest:';
    const cropSvg = getIconSvg(pickCropIconName(c.group, c.id), 'pro-icon');

    return `
      <article class="crop-card" data-crop-card-id="${escapeHtml(c.id)}" tabindex="0" role="button" aria-label="${escapeHtml(title)} guide">
        <div class="crop-card-head">
          <div class="crop-emoji">${cropSvg}</div>
          <span class="crop-group-pill">${escapeHtml(groupLabel)}</span>
        </div>
        <h3>${escapeHtml(title)}</h3>
        <div class="crop-en">${escapeHtml(subtitle)}</div>
        <p class="crop-summary">${escapeHtml(summary)}</p>

        <div class="crop-chips">
          <div class="crop-chip">
            <span>${pinSvg}</span>
            <span>${escapeHtml(c.ecologicalSuitability || (lang === 'ny' ? 'Madera onse a Malawi' : 'Malawi-wide'))}</span>
          </div>
          <div class="crop-chip">
            <span>${calSvg}</span>
            <span><strong>${plantLabel}</strong> ${escapeHtml(c.plantingWindow || 'Nov – Dec')}</span>
          </div>
          <div class="crop-chip">
            <span>${wheatSvg}</span>
            <span><strong>${harvestLabel}</strong> ${escapeHtml(c.harvestWindow || 'Apr – May')}</span>
          </div>
        </div>

        <button type="button" data-crop-id="${escapeHtml(c.id)}">
          ${escapeHtml(buttonText)}
        </button>
      </article>
    `;
  }).join('');
}

export function openCropGuide(id) {
  const c = cropData.find(x => x.id === id);
  if (!c) return;

  const lang = getCurrentLang();
  const grp = groupMeta.find(g => g.id === c.group);
  const groupLabel = lang === 'ny' ? (grp?.ny || c.group) : c.group;
  const title = lang === 'ny' ? c.ch : c.en;
  const subtitle = lang === 'ny' ? `${c.en} • ${groupLabel} • Malangizo a Kalimidwe ka m'Malawi` : `${c.ch} • ${groupLabel} • Malawi Agronomic Profile`;
  const summary = lang === 'ny' ? (chichewaSummaries[c.id] || c.summary) : c.summary;
  const pestsText = (c.pestsAndDiseases || []).map(p => escapeHtml(p)).join(' • ');
  const warnIcon = getIconSvg('alertTriangle', 'pro-icon');

  const bodyHtml = lang === 'ny' ? `
    <p><strong>Chidule cha Mbewu:</strong> ${escapeHtml(summary)}</p>

    <div class="modal-grid" style="margin:16px 0">
      <div class="modal-box">
        <h4>Nthawi za Nyengo</h4>
        <p style="font-size:12px;margin:3px 0"><strong>Kubzala:</strong> ${escapeHtml(c.plantingWindow || 'Novembala – Disembala')}</p>
        <p style="font-size:12px;margin:3px 0"><strong>Kukolola:</strong> ${escapeHtml(c.harvestWindow || 'Epulo – Meyi')}</p>
      </div>
      <div class="modal-box">
        <h4>Madera Oyenera ku Malawi</h4>
        <p style="font-size:12px;margin:3px 0">${escapeHtml(c.ecologicalSuitability || 'Oyenera m’madera ambiri a m’dziko la Malawi')}</p>
      </div>
    </div>

    <h3>Mtundu wa Nthaka Yoyenera</h3>
    <p>${escapeHtml(c.soilRequirements || 'Nthaka yachonde, yozama komanso yosunga madzi popanda kudzala madzi.')}</p>

    <h3>Feteleza Woyenera Kugwiritsa Ntchito</h3>
    <p>${escapeHtml(c.fertiliserRecommendations || 'Gwiritsani ntchito feteleza wa pansi ndi wa pamwamba molingana ndi malangizo a m’dera lanu.')}</p>

    <h3>Tizilombo ndi Matenda Oyenera Kusamala Nao</h3>
    <p><strong>Zowononga mbewu:</strong> ${pestsText}</p>
    <p style="font-size:12px;color:#78350f;background:#fffbeb;padding:8px 12px;border-radius:10px;border:1px solid #fde68a;margin-top:6px;display:flex;gap:8px;align-items:flex-start">
      <span>${warnIcon}</span>
      <span><strong>Chenjezo:</strong> ${escapeHtml(c.watch)}</span>
    </p>

    <h3>Zoyenera Kutsatira m'Munda (Field Checklist)</h3>
    <ol>
      ${(c.field || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}
    </ol>

    <h3>Kagwiritsidwe Ntchito m'Banja ndi pa Msika</h3>
    <ul>
      ${(c.uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('')}
    </ul>

    <div class="notice" style="margin-top:18px">
      <strong>Malangizo a Akatswiri:</strong> Kusankha mtundu wa mbewu, nthawi yobzala, mipata ya mizere, ndi feteleza zimatengera boma, nthaka ndi mvula. Tsimikizirani malangizowa ndi mlangizi wazaulimi wa m'dera lanu (AEDO).
    </div>
  ` : `
    <p><strong>Overview:</strong> ${escapeHtml(c.summary)}</p>

    <div class="modal-grid" style="margin:16px 0">
      <div class="modal-box">
        <h4>Seasonal Windows</h4>
        <p style="font-size:12px;margin:3px 0"><strong>Planting:</strong> ${escapeHtml(c.plantingWindow || 'November – December')}</p>
        <p style="font-size:12px;margin:3px 0"><strong>Harvest:</strong> ${escapeHtml(c.harvestWindow || 'April – May')}</p>
      </div>
      <div class="modal-box">
        <h4>Ecological Suitability</h4>
        <p style="font-size:12px;margin:3px 0">${escapeHtml(c.ecologicalSuitability || 'Suitable across major Malawi agro-ecological zones')}</p>
      </div>
    </div>

    <h3>Soil &amp; Land Requirements</h3>
    <p>${escapeHtml(c.soilRequirements || 'Well-drained fertile loam with good organic matter.')}</p>

    <h3>Recommended Fertiliser Schedule</h3>
    <p>${escapeHtml(c.fertiliserRecommendations || 'Apply recommended basal and top-dressing according to local ADD advice.')}</p>

    <h3>Key Pests &amp; Disease Risks</h3>
    <p><strong>Common threats:</strong> ${pestsText}</p>
    <p style="font-size:12px;color:#78350f;background:#fffbeb;padding:8px 12px;border-radius:10px;border:1px solid #fde68a;margin-top:6px;display:flex;gap:8px;align-items:flex-start">
      <span>${warnIcon}</span>
      <span><strong>Field Alert:</strong> ${escapeHtml(c.watch)}</span>
    </p>

    <h3>Field-learning checklist / Zoyenera kutsatira m'munda</h3>
    <ol>
      ${(c.field || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}
    </ol>

    <h3>Common uses / Kagwiritsidwe ntchito</h3>
    <ul>
      ${(c.uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('')}
    </ul>

    <div class="notice" style="margin-top:18px">
      <strong>Local guidance matters:</strong> Variety choice, seed rates, and fertilizer amounts vary by district and soil type. Confirm recommendations with your local Agricultural Extension Development Officer (AEDO).
    </div>
  `;

  openModal({
    title,
    subtitle,
    bodyHtml
  });
}

export function initCrops() {
  const filterWrap = document.getElementById('cropFilters');
  const searchInput = document.getElementById('cropSearch');
  const grid = document.getElementById('cropGrid');

  if (filterWrap) {
    filterWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-crop-group]');
      if (!btn) return;
      activeCropGroup = btn.dataset.cropGroup;
      renderCropFilters();
      renderCrops();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderCrops);
  }

  if (grid) {
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-crop-card-id]');
      const btn = e.target.closest('[data-crop-id]');
      const cropId = btn ? btn.dataset.cropId : (card ? card.dataset.cropCardId : null);
      if (cropId) {
        openCropGuide(cropId);
      }
    });

    grid.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-crop-card-id]')) {
        e.preventDefault();
        openCropGuide(e.target.dataset.cropCardId);
      }
    });

    loadCropData();
  }

  window.addEventListener('languageChanged', () => {
    renderCropFilters();
    renderCrops();
  });
}

document.addEventListener('DOMContentLoaded', initCrops);
