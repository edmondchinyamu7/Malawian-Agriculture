/* ===== Feature: Farming methods section ===== */
(function () {
  var categories = ['Zonse','Chakudya','Zamalonda','Zamakono','Zachikhalidwe'];
  var activeCategory = 'Zonse';
  var saved = new Set(JSON.parse(localStorage.getItem('ulimiSaved') || '[]'));

  function renderFilters() {
    $('#filters').innerHTML = categories.map(function (c) {
      var label = c === 'Zonse' ? 'All topics' : escapeHtml(c);
      return '<button class="filter ' + (c === activeCategory ? 'active' : '') +
             '" data-category="' + escapeHtml(c) + '">' + label + '</button>';
    }).join('');
  }

  function renderCards() {
    var q = $('#search').value.trim().toLowerCase();
    var list = farmingData.filter(function (x) {
      var matchCat = activeCategory === 'Zonse' || x.category === activeCategory;
      if (!matchCat) return false;
      if (!q) return true;
      var hay = [x.nameCh, x.nameEn, x.desc, x.full].concat(x.zitsanzo, x.mfundo)
                 .join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    $('#resultCount').textContent = list.length + ' ' + (list.length === 1 ? 'topic' : 'topics');
    var mc = $('#methodCount'); if (mc) mc.textContent = farmingData.length;

    if (!list.length) {
      $('#cards').innerHTML =
        '<div class="empty"><strong>No matching topics found.</strong><br>' +
        'Try another word or select a different category.</div>';
      return;
    }

    $('#cards').innerHTML = list.map(function (x) {
      var isSaved = saved.has(x.id);
      return '<article class="farm-card" tabindex="0" role="button" data-id="' + x.id +
        '" aria-label="Read ' + escapeHtml(x.nameEn) + '">' +
        '<div class="card-top"><div class="crop-icon">' + x.emoji + '</div>' +
        '<span class="category">' + escapeHtml(x.category) + '</span></div>' +
        '<h3>' + escapeHtml(x.nameCh) + '</h3>' +
        '<div class="english">' + escapeHtml(x.nameEn) + '</div>' +
        '<p class="desc">' + escapeHtml(x.desc) + '</p>' +
        '<div class="tags">' + x.zitsanzo.slice(0, 3).map(function (t) {
          return '<span class="tag">' + escapeHtml(t) + '</span>';
        }).join('') + '</div>' +
        '<div class="card-foot"><span>Read full guide →</span>' +
        '<button class="save ' + (isSaved ? 'saved' : '') + '" data-save="' + x.id +
        '" aria-label="' + (isSaved ? 'Remove saved topic' : 'Save topic') + '">' +
        (isSaved ? '★' : '☆') + '</button></div></article>';
    }).join('');
  }

  function openDetails(id) {
    var x = farmingData.find(function (v) { return v.id === Number(id); });
    if (!x) return;
    var html =
      '<p>' + escapeHtml(x.desc) + '</p>' +
      '<p>' + escapeHtml(x.full || '') + '</p>' +
      '<h3>Key points / Mfundo zazikulu</h3>' +
      '<ul>' + (x.mfundo || []).map(function (t) {
        return '<li>' + escapeHtml(t) + '</li>';
      }).join('') + '</ul>' +
      '<h3>Where it may be suitable in Malawi</h3>' +
      '<p>' + escapeHtml(x.bwino || 'Confirm local suitability with an extension worker.') + '</p>' +
      '<h3>Examples</h3>' +
      '<p>' + (x.zitsanzo || []).map(escapeHtml).join(' • ') + '</p>' +
      '<div class="modal-grid">' +
        '<div class="modal-box"><h4>Advantages / Ubwino</h4><ul>' +
          (x.ubwino || []).map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') +
        '</ul></div>' +
        '<div class="modal-box"><h4>Challenges / Zovuta</h4><ul>' +
          (x.vuto || []).map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') +
        '</ul></div>' +
      '</div>' +
      '<p style="font-size:11px;color:#718078;margin-top:18px">' +
      'Use this as learning material and confirm technical decisions with a local agricultural extension worker.</p>';

    openModal(x.nameCh, x.nameEn + ' • ' + x.category, html);
  }

  function bind() {
    $('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-category]');
      if (!b) return;
      activeCategory = b.dataset.category;
      renderFilters();
      renderCards();
    });

    $('#search').addEventListener('input', renderCards);

    $('#cards').addEventListener('click', function (e) {
      var saveBtn = e.target.closest('[data-save]');
      if (saveBtn) {
        e.stopPropagation();
        var id = Number(saveBtn.dataset.save);
        if (saved.has(id)) saved.delete(id); else saved.add(id);
        localStorage.setItem('ulimiSaved', JSON.stringify(Array.from(saved)));
        renderCards();
        toast(saved.has(id) ? 'Topic saved' : 'Topic removed from saved list');
        return;
      }
      var card = e.target.closest('[data-id]');
      if (card) openDetails(card.dataset.id);
    });

    $('#cards').addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) {
        e.preventDefault();
        openDetails(e.target.dataset.id);
      }
    });
  }

  /* Public entry point */
  window.initFarmingMethods = function () {
    renderFilters();
    renderCards();
    bind();
  };
})();