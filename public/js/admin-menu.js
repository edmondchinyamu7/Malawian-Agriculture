/* Shared responsive admin sidebar controller for admin pages that use a page-specific module. */
document.addEventListener('DOMContentLoaded', () => {
  const shell = document.querySelector('.admin-shell');
  const sidebar = shell?.querySelector('.admin-sidebar');
  const topbar = shell?.querySelector('.topbar');
  const actions = topbar?.querySelector('.top-actions');
  if (!shell || !sidebar || !topbar || !actions || topbar.querySelector('.admin-menu-toggle')) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'admin-menu-toggle';
  toggle.setAttribute('aria-label', 'Open administration menu');
  toggle.setAttribute('aria-controls', 'adminNavigationSidebar');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  sidebar.id = 'adminNavigationSidebar';

  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.className = 'admin-sidebar-overlay';
  overlay.setAttribute('aria-label', 'Close administration menu');
  overlay.tabIndex = -1;

  const setOpen = open => {
    shell.classList.toggle('admin-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close administration menu' : 'Open administration menu');
    document.body.classList.toggle('admin-menu-lock', open && window.matchMedia('(max-width: 900px)').matches);
  };
  toggle.addEventListener('click', () => setOpen(!shell.classList.contains('admin-menu-open')));
  overlay.addEventListener('click', () => setOpen(false));
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 900px)').matches) setOpen(false);
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && shell.classList.contains('admin-menu-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 900px)').matches) setOpen(false);
  });
  actions.prepend(toggle);
  shell.append(overlay);
});
