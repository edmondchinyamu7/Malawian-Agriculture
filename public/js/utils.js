/* ===== Utils: shared helpers ===== */
var $ = function (sel) { return document.querySelector(sel); };

function escapeHtml(v) {
  v = v == null ? '' : String(v);
  return v.replace(/[&<>"']/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
  });
}

var toastTimer;
function toast(msg) {
  var el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
}