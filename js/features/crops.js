/* ===== Feature: Crop library section ===== */
(function () {
  var activeCropGroup = 'All crops';

  function renderCropFilters() {
    var el = document.querySelector('#cropFilters');
    if (!el) return;
    el.innerHTML = cropGroups.map(function (g) {
      return '<button class="filter ' + (g === activeCropGroup ? 'active' : '') +
             '" data-crop-group="' + g + '">' + g + '</button>';
    }).join('');
  }

  function renderCrops() {
    var grid = document.querySelector('#cropGrid');
    if (!grid) return;
    var q = (document.querySelector('#cropSearch').value || '').trim().toLowerCase();
    var rows = cropData.filter(function (c) {
      var matchGroup = activeCropGroup === 'All crops' || c.group === activeCropGroup;
      if (!matchGroup) return false;
      var hay = [c.ch, c.en, c.group, c.summary].concat(c.uses).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    document.querySelector('#cropCount').textContent =
      rows.length + ' ' + (rows.length === 1 ? 'crop' : 'crops');

    if (!rows.length) {
      grid.innerHTML = '<div class="empty">No crops found. Try another search or crop group.</div>';
      return;
    }
    grid.innerHTML = rows.map(function (c) {
      return '<article class="crop-card">' +
        '<div class="crop-emoji">' + c.emoji + '</div>' +
        '<h3>' + c.ch + '</h3>' +
        '<div class="crop-en">' + c.en + ' · ' + c.group + '</div>' +
        '<p>' + c.summary + '</p>' +
        '<button type="button" data-crop-id="' + c.id + '">Explore crop guide →</button>' +
        '</article>';
    }).join('');
  }

  function openCrop(id) {
    var c = cropData.find(function (x) { return x.id === id; });
    if (!c) return;
    var html =
      '<p><strong>Overview:</strong> ' + c.summary + '</p>' +
      '<h3>Common uses</h3><ul>' +
        c.uses.map(function (v) { return '<li>' + v + '</li>'; }).join('') +
      '</ul>' +
      '<h3>Field-learning checklist</h3><ol>' +
        c.field.map(function (v) { return '<li>' + v + '</li>'; }).join('') +
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

    filtersEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-crop-group]');
      if (!b) return;
      activeCropGroup = b.dataset.cropGroup;
      renderCropFilters();
      renderCrops();
    });
    document.querySelector('#cropSearch').addEventListener('input', renderCrops);
    document.querySelector('#cropGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-crop-id]');
      if (b) openCrop(b.dataset.cropId);
    });

    renderCropFilters();
    renderCrops();
  };
})();