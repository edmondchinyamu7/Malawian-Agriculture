/**
 * Ulimi wa Malawi | Agricultural Calculators (Fertiliser, Land Size & Seed Rates)
 */
import { showToast } from './main.js';

// Fertiliser Recommendation Engine (Malawi Ministry of Agriculture Standards)
export function calculateFertiliser({ crop, areaValue, areaUnit }) {
  // Convert area to Hectares (1 Acre = 0.4047 Hectare; 1 Hectare = 2.471 Acres)
  let hectares = areaValue;
  if (areaUnit === 'acres') {
    hectares = areaValue * 0.404686;
  }

  // Standards per hectare (50kg bags)
  // Maize: ~4 bags 23:10:5+6S (Basal) + ~4 bags Urea (Top-dressing) = 200kg basal + 200kg urea
  // Rice: ~3 bags 23:10:5 + ~3 bags Urea
  // Soya/Groundnuts: ~1-2 bags D-Compound/SSP or Inoculant (Bio-fertilizer)
  let basalBags = 0;
  let topBags = 0;
  let basalName = '23:10:5+6S (Basal fertiliser)';
  let topName = 'Urea (46% Nitrogen)';
  let timingAdvice = '';

  switch (crop) {
    case 'maize':
      basalBags = hectares * 4;
      topBags = hectares * 4;
      timingAdvice = 'Apply basal 23:10:5+6S at planting or within 7 days of emergence. Apply Urea top-dressing at knee-height (21-28 days after planting) on moist soil.';
      break;
    case 'rice':
      basalBags = hectares * 3;
      topBags = hectares * 3;
      timingAdvice = 'Apply basal fertiliser during transplanting or land pudding. Top dress with Urea at tillering and panicle initiation.';
      break;
    case 'groundnut':
      basalBags = hectares * 1.5;
      topBags = 0;
      basalName = 'Single Super Phosphate (SSP) or Gypsum';
      topName = 'Not required (Legumes fix atmospheric nitrogen)';
      timingAdvice = 'Apply gypsum at flowering to assist pod filling and prevent "pops" (empty shells). Avoid high nitrogen fertilisers.';
      break;
    case 'tomato':
      basalBags = hectares * 5;
      topBags = hectares * 4;
      basalName = 'Compound D or 23:10:5+6S';
      topName = 'CAN (Calcium Ammonium Nitrate) or Urea in split doses';
      timingAdvice = 'Apply basal fertilizer in planting stations. Side-dress with CAN every 2-3 weeks from first fruit set.';
      break;
    default:
      basalBags = hectares * 3;
      topBags = hectares * 3;
      timingAdvice = 'Follow localized field guidance from your Agricultural Development Division (ADD).';
  }

  return {
    hectares: hectares.toFixed(2),
    acres: (hectares * 2.47105).toFixed(2),
    basalBags: Math.ceil(basalBags),
    topBags: Math.ceil(topBags),
    basalName,
    topName,
    timingAdvice
  };
}

// Seed Requirement Calculator
export function calculateSeedRequirement({ crop, areaValue, areaUnit }) {
  let hectares = areaValue;
  if (areaUnit === 'acres') {
    hectares = areaValue * 0.404686;
  }

  // Recommended seed rates per hectare in Malawi:
  // Maize (Hybrid): ~25 kg/ha (~10 kg/acre)
  // Groundnuts (Shelled): ~80-100 kg/ha (~35-40 kg/acre)
  // Soya: ~60-70 kg/ha (~25-30 kg/acre)
  // Rice: ~45-50 kg/ha (~20 kg/acre)
  let seedRatePerHa = 25;
  let spacing = '75cm between ridges, 25cm between planting stations (1 seed per station)';

  switch (crop) {
    case 'maize':
      seedRatePerHa = 25;
      spacing = '75 cm ridges, 25 cm between stations, 1 seed per hole.';
      break;
    case 'groundnut':
      seedRatePerHa = 85;
      spacing = '75 cm ridges, double rows per ridge, 15 cm between stations.';
      break;
    case 'soybean':
      seedRatePerHa = 65;
      spacing = '75 cm ridges, double rows, 5-7 cm continuous drill.';
      break;
    case 'rice':
      seedRatePerHa = 50;
      spacing = '20 cm x 20 cm in puddled paddy fields.';
      break;
  }

  const totalKg = Math.round(seedRatePerHa * hectares);
  return {
    totalKg,
    spacing,
    hectares: hectares.toFixed(2)
  };
}

export function initCalculators() {
  const fertForm = document.getElementById('fertCalcForm');
  const seedForm = document.getElementById('seedCalcForm');

  if (fertForm) {
    fertForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const crop = document.getElementById('fertCrop')?.value;
      const areaValue = Number(document.getElementById('fertArea')?.value);
      const areaUnit = document.getElementById('fertUnit')?.value;

      if (!areaValue || areaValue <= 0) {
        showToast('Please enter a valid land area greater than 0.');
        return;
      }

      const res = calculateFertiliser({ crop, areaValue, areaUnit });
      const resultsDiv = document.getElementById('fertResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div style="background:#f2f7f3;border:1px solid #cce3d4;border-radius:16px;padding:20px;margin-top:20px">
            <h4 style="font-size:16px;font-weight:900;color:var(--forest);margin:0 0 10px">
              Fertiliser Estimate for ${res.hectares} Ha (${res.acres} Acres)
            </h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
              <div class="modal-box">
                <h4>Basal Requirement</h4>
                <div style="font-size:20px;font-weight:900;color:var(--green)">${res.basalBags} Bags (50 kg each)</div>
                <div style="font-size:12px;color:#52665a">${res.basalName}</div>
              </div>
              <div class="modal-box">
                <h4>Top-Dressing Requirement</h4>
                <div style="font-size:20px;font-weight:900;color:var(--forest)">${res.topBags} Bags (50 kg each)</div>
                <div style="font-size:12px;color:#52665a">${res.topName}</div>
              </div>
            </div>
            <p style="font-size:13px;line-height:1.6;color:#355241;margin:0">
              <strong>Application Schedule:</strong> ${res.timingAdvice}
            </p>
          </div>
        `;
        resultsDiv.hidden = false;
      }
    });
  }

  if (seedForm) {
    seedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const crop = document.getElementById('seedCrop')?.value;
      const areaValue = Number(document.getElementById('seedArea')?.value);
      const areaUnit = document.getElementById('seedUnit')?.value;

      if (!areaValue || areaValue <= 0) {
        showToast('Please enter a valid land area greater than 0.');
        return;
      }

      const res = calculateSeedRequirement({ crop, areaValue, areaUnit });
      const resultsDiv = document.getElementById('seedResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div style="background:#f2f7f3;border:1px solid #cce3d4;border-radius:16px;padding:20px;margin-top:20px">
            <h4 style="font-size:16px;font-weight:900;color:var(--forest);margin:0 0 10px">
              Certified Seed Requirement
            </h4>
            <div style="font-size:26px;font-weight:900;color:var(--green);margin:4px 0">
              Approx. ${res.totalKg} kg certified seed
            </div>
            <p style="font-size:13px;color:#355241;margin:6px 0 0">
              <strong>Recommended field spacing:</strong> ${res.spacing}
            </p>
          </div>
        `;
        resultsDiv.hidden = false;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initCalculators);
