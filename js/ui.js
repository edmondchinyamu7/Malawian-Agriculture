/* ===== UI: modal shared by farming methods + crops ===== */
function openModal(title, sub, bodyHtml, focusSel) {
  var modal = $('#modal');
  $('#modalTitle').textContent = title;
  $('#modalSub').textContent = sub;
  $('#modalBody').innerHTML = bodyHtml;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  var focusEl = $(focusSel || '#closeModal');
  if (focusEl) focusEl.focus();
}

function closeModal() {
  var modal = $('#modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

/* Bind once at app boot */
function bindModalGlobals() {
  var closeBtn = $('#closeModal');
  var modal = $('#modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });
}