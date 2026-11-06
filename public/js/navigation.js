/* ===== Navigation: mobile menu + active-link scroll spy ===== */
function initNavigation() {
  var menuBtn = $('#menuBtn');
  var nav = $('#nav');

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) nav.classList.remove('open');
    });
  }

  if ('IntersectionObserver' in window) {
    var sections = Array.prototype.slice.call(
      document.querySelectorAll('main section[id], #home')
    );
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          navLinks.forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
          });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(function (s) { observer.observe(s); });
  }
}