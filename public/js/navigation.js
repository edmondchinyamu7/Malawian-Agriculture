/* ===== Navigation: mobile menu + active-link scroll spy ===== */
function initNavigation() {
  var menuBtn = document.getElementById('menuBtn');
  var nav = document.getElementById('nav');

  if (menuBtn && nav) {
    // Mobile navigation toggle
    menuBtn.onclick = function (e) {
      e.stopPropagation();
      var isOpen = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menuBtn.classList.toggle('active', isOpen);
    };

    // Close when clicking any nav link
    nav.onclick = function (e) {
      if (e.target.closest('a') || e.target.closest('button')) {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.classList.remove('active');
      }
    };

    // Close when clicking outside
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && !menuBtn.contains(e.target)) {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.classList.remove('active');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.classList.remove('active');
      }
    });
  }

  // Active link scroll spy
  if ('IntersectionObserver' in window) {
    var sections = Array.prototype.slice.call(
      document.querySelectorAll('main section[id], #home')
    );
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    if (sections.length > 0 && navLinks.length > 0) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (a) {
              var href = a.getAttribute('href');
              if (href && href.startsWith('#')) {
                a.classList.toggle('active', href === '#' + entry.target.id);
              }
            });
          }
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      sections.forEach(function (s) { observer.observe(s); });
    }
  }
}

// Ensure initNavigation executes if loaded after DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavigation);
} else {
  initNavigation();
}