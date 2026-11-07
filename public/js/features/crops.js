/* ===== Feature: Crop library section (V7 Advanced Support) ===== */
(function () {
  var activeCropGroup = 'All crops';

  function renderCropFilters() {
    var el = document.querySelector('#cropFilters');
    if (!el) return;
    var groups = ['All crops', 'Cereals', 'Legumes', 'Root crops', 'Vegetables', 'Cash crops'];
    el.innerHTML = groups.map(function (g) {
      return '<button class="filter ' + (g === activeCropGroup ? 'active' : '') +
             '" data-crop-group="' + g + '">' + g + '</button>';
    }).join('');
  }

  function renderCrops() {
    var grid = document.querySelector('#cropGrid');
    if (!grid) return;
    var list = window.cropData || [];
    var q = (document.querySelector('#cropSearch').value || '').trim().toLowerCase();
    var rows = list.filter(function (c) {
      var matchGroup = activeCropGroup === 'All crops' || c.group === activeCropGroup;
      if (!matchGroup) return false;
      var hay = [c.ch, c.en, c.group, c.summary, c.ecologicalSuitability || ''].concat(c.uses || []).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    var countEl = document.querySelector('#cropCount');
    if (countEl) {
      countEl.textContent = rows.length + ' ' + (rows.length === 1 ? 'crop' : 'crops');
    }

    if (!rows.length) {
      grid.innerHTML = '<div class="empty">No crops found. Try another search or crop group.</div>';
      return;
    }
    grid.innerHTML = rows.map(function (c) {
      var ecoHtml = c.ecologicalSuitability ? '<div style="font-size:11px;color:#3f5949;margin-bottom:10px;font-weight:700">📍 ' + c.ecologicalSuitability + '</div>' : '';
      return '<article class="crop-card">' +
        '<div class="crop-emoji">' + c.emoji + '</div>' +
        '<h3>' + c.ch + '</h3>' +
        '<div class="crop-en">' + c.en + ' · ' + c.group + '</div>' +
        '<p>' + c.summary + '</p>' +
        ecoHtml +
        '<button type="button" data-crop-id="' + c.id + '">Explore crop guide →</button>' +
        '</article>';
    }).join('');
  }

  function openCrop(id) {
    var list = window.cropData || [];
    var c = list.find(function (x) { return x.id === id; });
    if (!c) return;
    
    var seasonalHtml = '';
    if (c.plantingWindow || c.harvestWindow) {
      seasonalHtml = '<div class="modal-grid" style="margin:14px 0">' +
        '<div class="modal-box"><h4>🗓️ Seasonal Timing</h4>' +
        '<p style="font-size:12px;margin:2px 0"><strong>Planting:</strong> ' + (c.plantingWindow || 'November – December') + '</p>' +
        '<p style="font-size:12px;margin:2px 0"><strong>Harvest:</strong> ' + (c.harvestWindow || 'April – May') + '</p>' +
        '</div>' +
        '<div class="modal-box"><h4>🌍 Ecological Suitability</h4>' +
        '<p style="font-size:12px;margin:2px 0">' + (c.ecologicalSuitability || 'Widespread across Malawi') + '</p>' +
        '</div>' +
        '</div>';
    }

    var soilHtml = c.soilRequirements ? '<h3>🌱 Soil & Land Requirements</h3><p>' + c.soilRequirements + '</p>' : '';
    var fertHtml = c.fertiliserRecommendations ? '<h3>⚡ Recommended Fertiliser Schedule</h3><p>' + c.fertiliserRecommendations + '</p>' : '';
    var pestHtml = c.pestsAndDiseases ? '<h3>🐛 Key Pests & Disease Risks</h3><p><strong>Common threats:</strong> ' + c.pestsAndDiseases.join(' • ') + '</p>' : '';

    var html =
      '<p><strong>Overview:</strong> ' + c.summary + '</p>' +
      seasonalHtml +
      soilHtml +
      fertHtml +
      pestHtml +
      '<h3>Common uses / Kagwiritsidwe ntchito</h3><ul>' +
        (c.uses || []).map(function (v) { return '<li>' + v + '</li>'; }).join('') +
      '</ul>' +
      '<h3>Field-learning checklist / Zoyenera kutsatira m\'munda</h3><ol>' +
        (c.field || []).map(function (v) { return '<li>' + v + '</li>'; }).join('') +
      '</ol>' +
      '<h3>Things to watch</h3><p>' + c.watch + '</p>' +
      '<p class="notice"><strong>Local guidance matters:</strong> ' +
      'This is general crop education, not a district-specific production package. ' +
      'Confirm seed variety, planting window, spacing, fertiliser and crop protection ' +
      'recommendations with a qualified local extension worker.</p>';
    openModal(c.emoji + ' ' + c.ch, c.en + ' • ' + c.group + ' • Malawi crop profile', html);
  }

  window.initCrops = function () {
    var filtersEl = document.querySelector('#cropFilters');
    if (!filtersEl) return;

    // Load full JSON dataset if available
    fetch('data/crops.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        window.cropData = data;
        renderCropFilters();
        renderCrops();
      })
      .catch(function () {
        // Fall back to config.js cropData
        renderCropFilters();
        renderCrops();
      });

    filtersEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-crop-group]');
      if (!b) return;
      activeCropGroup = b.dataset.cropGroup;
      renderCropFilters();
      renderCrops();
    });

    var searchEl = document.querySelector('#cropSearch');
    if (searchEl) {
      searchEl.addEventListener('input', renderCrops);
    }

    var gridEl = document.querySelector('#cropGrid');
    if (gridEl) {
      gridEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-crop-id]');
        if (b) openCrop(b.dataset.cropId);
      });
    }

    renderCropFilters();
    renderCrops();
  };
})();