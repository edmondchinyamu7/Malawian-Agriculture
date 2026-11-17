/**
 * Ulimi wa Malawi | Agricultural Calculators & Interactive Farm Planner
 * Pure exported calculation helpers + DOM wiring for Fertiliser, Seed, Area & Seasonal Planning.
 */
import { escapeHtml, showToast } from './main.js';
import { getIconSvg } from './icons.js';

const ACRE_TO_HA = 0.404686;
const HA_TO_ACRE = 2.471054;
const HA_TO_SQM = 10000;

const CROP_AGRONOMY_DATA = {
  maize: {
    label: 'Chimanga (Maize)',
    seedRatePerHa: 25,
    spacingCm: [75, 25],
    seedsPerStation: 1,
    spacingText: '75 cm ridges, 25 cm between stations, 1 seed per station (53,333 plants/ha).',
    basalBagsPerHa: 4,
    topBagsPerHa: 4,
    basalName: '23:10:5+6S (Basal fertiliser)',
    topName: 'Urea (46% Nitrogen)',
    timingAdvice: 'Apply basal 23:10:5+6S at planting or within 7 days of emergence. Top-dress with Urea at knee-height (21–28 days after planting) on moist soil.',
    yieldMinKgPerHa: 4000,
    yieldMaxKgPerHa: 6500,
    daysToMaturity: [110, 135]
  },
  rice: {
    label: 'Mpunga (Rice)',
    seedRatePerHa: 50,
    spacingCm: [20, 20],
    seedsPerStation: 2,
    spacingText: '20 cm x 20 cm in puddled paddy fields (2 seedlings per hill).',
    basalBagsPerHa: 3,
    topBagsPerHa: 3,
    basalName: '23:10:5+6S (Basal)',
    topName: 'Urea (46% Nitrogen)',
    timingAdvice: 'Apply basal fertiliser during transplanting or puddling. Top-dress Urea in two splits at early tillering and panicle initiation.',
    yieldMinKgPerHa: 3000,
    yieldMaxKgPerHa: 4500,
    daysToMaturity: [120, 150]
  },
  groundnut: {
    label: 'Mtedza (Groundnuts)',
    seedRatePerHa: 85,
    spacingCm: [37.5, 15],
    seedsPerStation: 1,
    spacingText: '75 cm ridges, double rows per ridge, 15 cm between stations, 1 seed per hole.',
    basalBagsPerHa: 2,
    topBagsPerHa: 0,
    basalName: 'Single Super Phosphate (SSP) or Agricultural Gypsum',
    topName: 'Not required (Legumes fix atmospheric nitrogen)',
    timingAdvice: 'Apply gypsum at flowering (200 kg/ha) to assist pod filling and prevent empty shells ("pops"). Avoid high nitrogen fertilisers.',
    yieldMinKgPerHa: 1500,
    yieldMaxKgPerHa: 2500,
    daysToMaturity: [110, 140]
  },
  soybean: {
    label: 'Soya (Soybean)',
    seedRatePerHa: 65,
    spacingCm: [37.5, 5],
    seedsPerStation: 1,
    spacingText: '75 cm ridges, double rows per ridge, 5–7 cm continuous drill + Rhizobium inoculant.',
    basalBagsPerHa: 2,
    topBagsPerHa: 0,
    basalName: 'D-Compound or Single Super Phosphate (SSP)',
    topName: 'Not required (Use Rhizobium bio-fertiliser inoculant)',
    timingAdvice: 'Inoculate seed with Rhizobium slurry in shade immediately before planting; apply moderate basal phosphorus where soils are depleted.',
    yieldMinKgPerHa: 1800,
    yieldMaxKgPerHa: 2800,
    daysToMaturity: [105, 125]
  },
  beans: {
    label: 'Nyemba (Common Beans)',
    seedRatePerHa: 60,
    spacingCm: [37.5, 10],
    seedsPerStation: 1,
    spacingText: '75 cm ridges, double rows at 10 cm spacing (bush beans) or 20 cm staked (climbing beans).',
    basalBagsPerHa: 2,
    topBagsPerHa: 0,
    basalName: '23:10:5+6S or Single Super Phosphate',
    topName: 'Limited nitrogen needed (top-dress lightly only on very poor soils)',
    timingAdvice: 'Incorporate basal phosphate at planting alongside composted manure. Avoid field operations when leaves are wet to deter bacterial blights.',
    yieldMinKgPerHa: 1200,
    yieldMaxKgPerHa: 2000,
    daysToMaturity: [70, 90]
  },
  sorghum: {
    label: 'Mapira (Sorghum)',
    seedRatePerHa: 10,
    spacingCm: [75, 25],
    seedsPerStation: 2,
    spacingText: '75 cm ridges, 25–30 cm between stations, thinned to 2 plants per station.',
    basalBagsPerHa: 2,
    topBagsPerHa: 1.5,
    basalName: '23:10:5+6S or well-rotted farmyard manure',
    topName: 'Urea (only in districts with reliable moisture)',
    timingAdvice: 'Apply modest basal compound or manure at planting. Top-dress lightly at 3–4 weeks after emergence when soil moisture is present.',
    yieldMinKgPerHa: 1800,
    yieldMaxKgPerHa: 3200,
    daysToMaturity: [110, 130]
  },
  millet: {
    label: 'Mchewere / Mawere (Millet)',
    seedRatePerHa: 8,
    spacingCm: [60, 15],
    seedsPerStation: 2,
    spacingText: 'Shallow sowing (1.5–2 cm deep) in rows 60–75 cm apart; thin to 15–20 cm.',
    basalBagsPerHa: 1.5,
    topBagsPerHa: 1,
    basalName: 'Decomposed compost / moderate 23:10:5+6S',
    topName: 'CAN or Urea (light split where rainfall is adequate)',
    timingAdvice: 'Millet excels in low-input soils. Incorporate compost before planting and keep seedbed weed-free during the first 3 weeks.',
    yieldMinKgPerHa: 1200,
    yieldMaxKgPerHa: 2400,
    daysToMaturity: [95, 120]
  },
  cassava: {
    label: 'Chinangwa (Cassava)',
    seedRatePerHa: 0,
    spacingCm: [100, 100],
    seedsPerStation: 1,
    spacingText: '10,000 disease-free stem cuttings/ha (25–30 cm long) planted at 1 m x 1 m on ridges.',
    basalBagsPerHa: 2,
    topBagsPerHa: 1,
    basalName: 'Organic compost & potassium-rich wood ash or Compound D',
    topName: 'Optional moderate 23:10:5 at month 2 for commercial bulking',
    timingAdvice: 'Prioritise disease-free cuttings and timely weeding for the first 3–4 months until canopy closes.',
    yieldMinKgPerHa: 15000,
    yieldMaxKgPerHa: 25000,
    daysToMaturity: [270, 365]
  },
  tomato: {
    label: 'Tomato',
    seedRatePerHa: 0.3,
    spacingCm: [60, 50],
    seedsPerStation: 1,
    spacingText: 'Raise seedlings in nursery beds (300 g seed/ha); transplant at 60 cm x 50 cm and stake.',
    basalBagsPerHa: 5,
    topBagsPerHa: 3,
    basalName: 'Compound D or 23:10:5+6S + decomposed compost',
    topName: 'CAN (Calcium Ammonium Nitrate) in split side-dressings',
    timingAdvice: 'Apply basal fertiliser per planting station at transplanting. Side-dress CAN every 2–3 weeks starting at first fruit set.',
    yieldMinKgPerHa: 18000,
    yieldMaxKgPerHa: 35000,
    daysToMaturity: [75, 95]
  },
  cabbage: {
    label: 'Kabichi / Brassicas',
    seedRatePerHa: 0.4,
    spacingCm: [50, 45],
    seedsPerStation: 1,
    spacingText: 'Raise seedlings for 4 weeks; transplant onto raised beds at 50 cm x 45 cm.',
    basalBagsPerHa: 4,
    topBagsPerHa: 3,
    basalName: 'Compound D or 23:10:5+6S + organic manure',
    topName: 'CAN split at week 2 and week 5 after transplanting',
    timingAdvice: 'Maintain steady soil moisture and side-dress CAN away from leaves to avoid scorch.',
    yieldMinKgPerHa: 20000,
    yieldMaxKgPerHa: 35000,
    daysToMaturity: [75, 100]
  },
  tobacco: {
    label: 'Fodya (Burley Tobacco)',
    seedRatePerHa: 0.02,
    spacingCm: [105, 55],
    seedsPerStation: 1,
    spacingText: '90–105 cm ridges, 55–60 cm between transplanted seedlings (~17,000 plants/ha).',
    basalBagsPerHa: 7,
    topBagsPerHa: 3,
    basalName: 'Compound C (6:15:12 ARET Tobacco blend)',
    topName: 'CAN (avoid muriate of potash / high chloride)',
    timingAdvice: 'Apply Compound C in bands at transplanting. Side-dress CAN 2–3 weeks after transplanting; confirm exact rates with ARET.',
    yieldMinKgPerHa: 1800,
    yieldMaxKgPerHa: 2600,
    daysToMaturity: [90, 120]
  }
};

export function toHectares(areaValue, areaUnit = 'hectares') {
  const val = Number(areaValue) || 0;
  if (val <= 0) return 0;
  if (areaUnit === 'acres' || areaUnit === 'acre') return val * ACRE_TO_HA;
  if (areaUnit === 'sqm' || areaUnit === 'm2') return val / HA_TO_SQM;
  return val;
}

export function convertLandArea(value, unit = 'acres') {
  const hectares = toHectares(value, unit);
  return {
    hectares: Number(hectares.toFixed(3)),
    acres: Number((hectares * HA_TO_ACRE).toFixed(3)),
    sqm: Math.round(hectares * HA_TO_SQM)
  };
}

export function calculateFertiliser({ crop, areaValue, areaUnit }) {
  const hectares = toHectares(areaValue, areaUnit);
  const spec = CROP_AGRONOMY_DATA[crop] || CROP_AGRONOMY_DATA.maize;

  const basalBags = hectares * spec.basalBagsPerHa;
  const topBags = hectares * spec.topBagsPerHa;

  return {
    cropLabel: spec.label,
    hectares: hectares.toFixed(2),
    acres: (hectares * HA_TO_ACRE).toFixed(2),
    basalBags: Math.ceil(basalBags),
    topBags: Math.ceil(topBags),
    basalKg: Math.round(basalBags * 50),
    topKg: Math.round(topBags * 50),
    basalName: spec.basalName,
    topName: spec.topName,
    timingAdvice: spec.timingAdvice
  };
}

export function calculateSeedRequirement({ crop, areaValue, areaUnit }) {
  const hectares = toHectares(areaValue, areaUnit);
  const spec = CROP_AGRONOMY_DATA[crop] || CROP_AGRONOMY_DATA.maize;
  const totalKg = spec.seedRatePerHa >= 1
    ? Math.round(spec.seedRatePerHa * hectares)
    : Number((spec.seedRatePerHa * hectares).toFixed(2));
  const cuttings = crop === 'cassava' ? Math.round(10000 * hectares) : null;

  return {
    cropLabel: spec.label,
    totalKg,
    cuttings,
    spacing: spec.spacingText,
    hectares: hectares.toFixed(2),
    acres: (hectares * HA_TO_ACRE).toFixed(2)
  };
}

export function calculatePlantPopulation({ rowSpacingCm, stationSpacingCm, seedsPerStation = 1, areaValue = 1, areaUnit = 'hectares' }) {
  const r = Number(rowSpacingCm);
  const s = Number(stationSpacingCm);
  const n = Math.max(1, Number(seedsPerStation) || 1);
  const hectares = toHectares(areaValue, areaUnit);
  if (!(r > 0) || !(s > 0) || !(hectares > 0)) {
    return { plantsPerHa: 0, totalStations: 0, totalPlants: 0, hectares: '0.00' };
  }
  const areaSqM = hectares * HA_TO_SQM;
  const stationAreaSqM = (r / 100) * (s / 100);
  const totalStations = Math.round(areaSqM / stationAreaSqM);
  const totalPlants = totalStations * n;
  const plantsPerHa = Math.round((HA_TO_SQM / stationAreaSqM) * n);
  return {
    plantsPerHa,
    totalStations,
    totalPlants,
    hectares: hectares.toFixed(2)
  };
}

export function buildFarmPlan({ crop, areaValue, areaUnit, plantingDate, seedCost = 0, fertiliserCost = 0, labourCost = 0 }) {
  const spec = CROP_AGRONOMY_DATA[crop] || CROP_AGRONOMY_DATA.maize;
  const hectares = toHectares(areaValue, areaUnit);
  const yieldMinKg = Math.round(spec.yieldMinKgPerHa * hectares);
  const yieldMaxKg = Math.round(spec.yieldMaxKgPerHa * hectares);
  const bagsMin = Math.round(yieldMinKg / 50);
  const bagsMax = Math.round(yieldMaxKg / 50);
  const totalBudget = Math.max(0, Number(seedCost) || 0) + Math.max(0, Number(fertiliserCost) || 0) + Math.max(0, Number(labourCost) || 0);
  const costPerHa = hectares > 0 ? Math.round(totalBudget / hectares) : 0;
  const avgYield = (yieldMinKg + yieldMaxKg) / 2;
  const breakEvenPerKg = avgYield > 0 && totalBudget > 0 ? Math.round(totalBudget / avgYield) : 0;

  let harvestEstimateText = 'Confirm planting date to project harvest week';
  if (plantingDate) {
    const start = new Date(`${plantingDate}T12:00:00`);
    if (!Number.isNaN(start.getTime())) {
      const earlyHarvest = new Date(start.getTime() + spec.daysToMaturity[0] * 86400000);
      const lateHarvest = new Date(start.getTime() + spec.daysToMaturity[1] * 86400000);
      const fmt = { day: 'numeric', month: 'short', year: 'numeric' };
      harvestEstimateText = `${earlyHarvest.toLocaleDateString('en-MW', fmt)} – ${lateHarvest.toLocaleDateString('en-MW', fmt)}`;
    }
  }

  return {
    cropKey: crop,
    cropName: spec.label,
    area: Number(areaValue),
    unit: areaUnit,
    hectares: hectares.toFixed(2),
    plantingDate: plantingDate || 'Not set',
    harvestEstimateText,
    yieldMinKg,
    yieldMaxKg,
    expectedYield: `${yieldMinKg.toLocaleString('en-MW')} – ${yieldMaxKg.toLocaleString('en-MW')}`,
    bagsRange: `${bagsMin} – ${bagsMax} bags (50 kg)`,
    estimatedBudget: totalBudget.toLocaleString('en-MW'),
    totalBudgetNum: totalBudget,
    costPerHa: costPerHa.toLocaleString('en-MW'),
    breakEvenPerKg: breakEvenPerKg.toLocaleString('en-MW'),
    fertSummary: calculateFertiliser({ crop, areaValue, areaUnit }),
    seedSummary: calculateSeedRequirement({ crop, areaValue, areaUnit })
  };
}

export function initCalculators() {
  const fertForm = document.getElementById('fertCalcForm');
  const seedForm = document.getElementById('seedCalcForm');
  const areaForm = document.getElementById('areaConvertForm');
  const popForm = document.getElementById('populationCalcForm');
  const planForm = document.getElementById('farmPlanForm');

  if (fertForm) {
    fertForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const crop = document.getElementById('fertCrop')?.value;
      const areaValue = Number(document.getElementById('fertArea')?.value);
      const areaUnit = document.getElementById('fertUnit')?.value;

      if (!(areaValue > 0)) {
        showToast('Please enter a valid land area greater than 0.');
        return;
      }

      const res = calculateFertiliser({ crop, areaValue, areaUnit });
      const resultsDiv = document.getElementById('fertResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div style="background:#f2f7f3;border:1px solid #cce3d4;border-radius:16px;padding:20px;margin-top:20px">
            <h4 style="font-size:16px;font-weight:900;color:var(--forest);margin:0 0 10px">
              ${escapeHtml(res.cropLabel)} — Fertiliser Estimate for ${escapeHtml(res.hectares)} Ha (${escapeHtml(res.acres)} Acres)
            </h4>
            <div class="modal-grid" style="margin-bottom:14px">
              <div class="modal-box">
                <h4>Basal Requirement</h4>
                <div style="font-size:20px;font-weight:900;color:var(--green)">${res.basalBags} Bags (50 kg) • ${res.basalKg} kg</div>
                <div style="font-size:12px;color:#52665a">${escapeHtml(res.basalName)}</div>
              </div>
              <div class="modal-box">
                <h4>Top-Dressing Requirement</h4>
                <div style="font-size:20px;font-weight:900;color:var(--forest)">${res.topBags} Bags (50 kg) • ${res.topKg} kg</div>
                <div style="font-size:12px;color:#52665a">${escapeHtml(res.topName)}</div>
              </div>
            </div>
            <p style="font-size:13px;line-height:1.6;color:#355241;margin:0">
              <strong>Application Schedule:</strong> ${escapeHtml(res.timingAdvice)}
            </p>
          </div>
        `;
        resultsDiv.hidden = false;
      }
    });
  }

  if (areaForm) {
    areaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = Number(document.getElementById('convAreaValue')?.value);
      const unit = document.getElementById('convAreaUnit')?.value;
      const out = document.getElementById('areaConvertResults');
      if (!(val > 0)) {
        showToast('Enter a positive land measurement to convert.');
        return;
      }
      const res = convertLandArea(val, unit);
      if (out) {
        out.innerHTML = `
          <div style="background:#f2f7f3;border:1px solid #cce3d4;border-radius:14px;padding:16px;margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
            <div class="modal-box"><h4>Hectares</h4><strong style="font-size:20px;color:var(--forest)">${res.hectares} ha</strong></div>
            <div class="modal-box"><h4>Acres</h4><strong style="font-size:20px;color:var(--green)">${res.acres} acres</strong></div>
            <div class="modal-box"><h4>Square Metres</h4><strong style="font-size:20px;color:var(--forest)">${res.sqm.toLocaleString('en-MW')} m²</strong></div>
          </div>
        `;
        out.hidden = false;
      }
    });
  }

  if (popForm) {
    popForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rowSpacingCm = Number(document.getElementById('popRowCm')?.value);
      const stationSpacingCm = Number(document.getElementById('popStationCm')?.value);
      const seedsPerStation = Number(document.getElementById('popSeedsPerStation')?.value || 1);
      const areaValue = Number(document.getElementById('popAreaValue')?.value);
      const areaUnit = document.getElementById('popAreaUnit')?.value;
      const out = document.getElementById('populationResults');
      if (!(rowSpacingCm > 0) || !(stationSpacingCm > 0) || !(areaValue > 0)) {
        showToast('Enter positive ridge spacing, station spacing, and field area.');
        return;
      }
      const res = calculatePlantPopulation({ rowSpacingCm, stationSpacingCm, seedsPerStation, areaValue, areaUnit });
      if (out) {
        out.innerHTML = `
          <div style="background:#f2f7f3;border:1px solid #cce3d4;border-radius:14px;padding:16px;margin-top:16px">
            <div style="font-size:20px;font-weight:900;color:var(--forest)">${res.totalPlants.toLocaleString('en-MW')} target plants (${res.totalStations.toLocaleString('en-MW')} planting stations)</div>
            <p style="font-size:13px;color:#355241;margin:6px 0 0">Equivalent stand density: <strong>${res.plantsPerHa.toLocaleString('en-MW')} plants/hectare</strong> across ${escapeHtml(res.hectares)} ha.</p>
          </div>
        `;
        out.hidden = false;
      }
    });
  }

  if (seedForm) {
    seedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const crop = document.getElementById('seedCrop')?.value;
      const areaValue = Number(document.getElementById('seedArea')?.value);
      const areaUnit = document.getElementById('seedUnit')?.value;

      if (!(areaValue > 0)) {
        showToast('Please enter a valid land area greater than 0.');
        return;
      }

      const res = calculateSeedRequirement({ crop, areaValue, areaUnit });
      const resultsDiv = document.getElementById('seedResults');
      if (resultsDiv) {
        const amountDisplay = res.cuttings
          ? `Approx. ${res.cuttings.toLocaleString('en-MW')} disease-free stem cuttings`
          : `Approx. ${res.totalKg} kg certified seed`;
        resultsDiv.innerHTML = `
          <div style="background:#f2f7f3;border:1px solid #cce3d4;border-radius:16px;padding:20px;margin-top:20px">
            <h4 style="font-size:16px;font-weight:900;color:var(--forest);margin:0 0 10px">
              ${escapeHtml(res.cropLabel)} — Requirement for ${escapeHtml(res.hectares)} Ha (${escapeHtml(res.acres)} Acres)
            </h4>
            <div style="font-size:24px;font-weight:900;color:var(--green);margin:4px 0">
              ${escapeHtml(amountDisplay)}
            </div>
            <p style="font-size:13px;color:#355241;margin:6px 0 0">
              <strong>Recommended field spacing:</strong> ${escapeHtml(res.spacing)}
            </p>
          </div>
        `;
        resultsDiv.hidden = false;
      }
    });
  }

  if (planForm) {
    // Hydrate saved farm plan if available
    const savedRaw = localStorage.getItem('ulimiFarmPlan');
    if (savedRaw) {
      try {
        const saved = JSON.parse(savedRaw);
        if (saved?.cropKey && document.getElementById('planCrop')) {
          document.getElementById('planCrop').value = saved.cropKey;
        }
        if (saved?.area && document.getElementById('planArea')) {
          document.getElementById('planArea').value = saved.area;
        }
        if (saved?.unit && document.getElementById('planUnit')) {
          document.getElementById('planUnit').value = saved.unit;
        }
        if (saved?.plantingDate && saved.plantingDate !== 'Not set' && document.getElementById('planPlantDate')) {
          document.getElementById('planPlantDate').value = saved.plantingDate;
        }
      } catch (_) {}
    }

    const renderPlanOutput = (plan) => {
      const out = document.getElementById('farmPlanResults');
      if (!out || !plan) return;
      const checkSvg = getIconSvg('check', 'pro-icon');
      out.innerHTML = `
        <div style="background:#f2f7f3;border:1px solid #cce3d4;border-radius:16px;padding:20px;margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            <h4 style="font-size:17px;font-weight:900;color:var(--forest);margin:0">${escapeHtml(plan.cropName)} — Seasonal Farm Plan (${escapeHtml(String(plan.area))} ${escapeHtml(plan.unit)} / ${escapeHtml(plan.hectares)} ha)</h4>
            <span class="badge-verified" style="display:inline-flex;align-items:center;gap:4px">${checkSvg} Saved to Dashboard</span>
          </div>
          <div class="modal-grid" style="margin-bottom:12px">
            <div class="modal-box">
              <h4>Expected GAP Yield</h4>
              <strong style="font-size:18px;color:var(--green)">${escapeHtml(plan.expectedYield)} kg</strong>
              <div style="font-size:12px;color:#52665a">${escapeHtml(plan.bagsRange)}</div>
            </div>
            <div class="modal-box">
              <h4>Projected Harvest Window</h4>
              <strong style="font-size:15px;color:var(--forest)">${escapeHtml(plan.harvestEstimateText)}</strong>
              <div style="font-size:12px;color:#52665a">Planting target: ${escapeHtml(plan.plantingDate)}</div>
            </div>
            <div class="modal-box">
              <h4>Input Budget Summary</h4>
              <strong style="font-size:18px;color:var(--forest)">MWK ${escapeHtml(plan.estimatedBudget)}</strong>
              <div style="font-size:12px;color:#52665a">${plan.totalBudgetNum > 0 ? `MWK ${escapeHtml(plan.costPerHa)}/ha • Break-even ~MWK ${escapeHtml(plan.breakEvenPerKg)}/kg` : 'Enter seed, fertiliser & labour costs above for break-even analysis'}</div>
            </div>
            <div class="modal-box">
              <h4>Recommended Inputs</h4>
              <div style="font-size:12px;color:#355241;line-height:1.5">
                Seed: <strong>${plan.seedSummary.cuttings ? `${plan.seedSummary.cuttings.toLocaleString('en-MW')} cuttings` : `${plan.seedSummary.totalKg} kg`}</strong><br>
                Basal: <strong>${plan.fertSummary.basalBags} bags (50 kg)</strong> • Top: <strong>${plan.fertSummary.topBags} bags</strong>
              </div>
            </div>
          </div>
          <p style="font-size:12px;color:#405247;margin:0">Your plan has been saved in this browser so it appears on your <a href="../profile.html" style="color:var(--green);font-weight:800;text-decoration:underline">Farmer Dashboard</a>.</p>
        </div>
      `;
      out.hidden = false;
    };

    planForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const crop = document.getElementById('planCrop')?.value;
      const areaValue = Number(document.getElementById('planArea')?.value);
      const areaUnit = document.getElementById('planUnit')?.value;
      const plantingDate = document.getElementById('planPlantDate')?.value;
      const seedCost = Number(document.getElementById('planSeedCost')?.value || 0);
      const fertiliserCost = Number(document.getElementById('planFertCost')?.value || 0);
      const labourCost = Number(document.getElementById('planLabourCost')?.value || 0);

      if (!(areaValue > 0)) {
        showToast('Please enter a cultivated area greater than 0.');
        return;
      }

      const plan = buildFarmPlan({ crop, areaValue, areaUnit, plantingDate, seedCost, fertiliserCost, labourCost });
      localStorage.setItem('ulimiFarmPlan', JSON.stringify(plan));
      renderPlanOutput(plan);
      showToast('Seasonal farm plan saved to your dashboard.');
    });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initCalculators);
}
