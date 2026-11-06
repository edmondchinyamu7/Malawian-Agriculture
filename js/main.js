/**
 * Ulimi wa Malawi | Core Shared Utilities & Modal System
 */

// Safe HTML escaping
export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

// Toast notification helper
let toastTimer;
export function showToast(message) {
  let toastEl = document.getElementById('toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2200);
}

// Global Bookmark / Saved Items System
export const bookmarks = {
  key: 'ulimiSaved',
  getAll() {
    try {
      return new Set(JSON.parse(localStorage.getItem(this.key) || '[]'));
    } catch {
      return new Set();
    }
  },
  toggle(id) {
    const numericId = Number(id);
    const set = this.getAll();
    let isSaved = false;
    if (set.has(numericId)) {
      set.delete(numericId);
      isSaved = false;
    } else {
      set.add(numericId);
      isSaved = true;
    }
    localStorage.setItem(this.key, JSON.stringify([...set]));
    showToast(isSaved ? 'Topic saved to your device list' : 'Topic removed from saved list');
    return isSaved;
  },
  has(id) {
    return this.getAll().has(Number(id));
  }
};

// Modal System
export function openModal({ title, subtitle = '', bodyHtml = '' }) {
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modalTitle');
  const subEl = document.getElementById('modalSub');
  const bodyEl = document.getElementById('modalBody');
  const closeBtn = document.getElementById('closeModal');

  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;
  bodyEl.innerHTML = bodyHtml;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (closeBtn) closeBtn.focus();
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}


// Hidden admin entry: tap the header logo five times on the homepage.
function initHiddenAdminAccess() {
  document.querySelectorAll('a[href*="admin.html"], a[href="/admin"]').forEach(link => link.remove());
  const brand = document.querySelector('.topbar .brand');
  if (!brand || !['/', '/index.html'].includes(window.location.pathname)) return;
  let taps = 0;
  let firstTapAt = 0;
  brand.addEventListener('click', (event) => {
    const now = Date.now();
    if (!firstTapAt || now - firstTapAt > 4000) {
      taps = 0;
      firstTapAt = now;
    }
    taps += 1;
    event.preventDefault();
    if (taps >= 5) {
      taps = 0;
      firstTapAt = 0;
      window.location.assign('/admin-login.html');
    }
  });
}
\n// Attach global modal listeners
document.addEventListener('DOMContentLoaded', () => {\n  initHiddenAdminAccess();
  const closeBtn = document.getElementById('closeModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  const modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});
