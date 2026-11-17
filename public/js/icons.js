/**
 * Ulimi wa Malawi | Shared Inline SVG Icon System
 * Clean Lucide-style vector icons for UI consistency and accessibility.
 */

const ICON_PATHS = {
  leaf: '<path d="M12 22v-8"/><path d="M12 14C6 14 3 10 3 4c6 0 9 3 9 10Z"/><path d="M12 17c0-5 3-8 9-8 0 5-3 8-9 8Z"/>',
  sprout: '<path d="M12 21v-7"/><path d="M12 14C7 14 4 11 4 6c5 0 8 3 8 8Z"/><path d="M12 16c0-5 3-8 8-8 0 5-3 8-8 8Z"/><path d="M8 21h8"/>',
  wheat: '<path d="M12 3c-3 2-4 5-4 9s1 7 4 9c3-2 4-5 4-9s-1-7-4-9Z"/><path d="M8 8 5 5M8 13l-4-1M9 17l-3 2M16 8l3-3M16 13l4-1M15 17l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
  bug: '<path d="M12 8v13M8 11H4M20 11h-4M8 16H4M20 16h-4M9 8 7 5M15 8l2-3"/><rect x="8" y="8" width="8" height="13" rx="4"/><path d="M9 4c1-2 5-2 6 0"/>',
  barChart: '<path d="M3 3v18h18"/><path d="M8 16V9M13 16V5M18 16v-4"/>',
  trendingUp: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/><path d="M15 6h5v5"/>',
  cloudSun: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 6.34l1.41-1.41"/><path d="M16 12a4 4 0 0 0-7.46-2"/><path d="M13 21H7a4 4 0 0 1-.8-7.92A5 5 0 0 1 16 12a3.5 3.5 0 0 1-3 9Z"/>',
  cloudRain: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v2M12 17v4M16 19v2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13S5 11 5 15a7 7 0 0 0 7 7Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  tractor: '<path d="M3 4h9l1 7"/><path d="M4 11V4"/><path d="M8 10V4"/><path d="M18 5c-.6 0-1 .4-1 1v5.6"/><path d="m10 11 11 .9c.6 0 .9.5.8 1.1l-.8 5h-1"/><circle cx="7" cy="15" r="4"/><circle cx="18" cy="18" r="2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};

export function getIconSvg(name = 'leaf', className = 'pro-icon') {
  const paths = ICON_PATHS[name] || ICON_PATHS.leaf;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function pickCropIconName(category = '', id = '') {
  const k = `${category} ${id}`.toLowerCase();
  if (k.includes('maize') || k.includes('rice') || k.includes('sorghum') || k.includes('millet') || k.includes('cereal')) return 'wheat';
  if (k.includes('legume') || k.includes('groundnut') || k.includes('bean') || k.includes('soy') || k.includes('pea')) return 'sprout';
  if (k.includes('root') || k.includes('cassava') || k.includes('potato')) return 'layers';
  if (k.includes('veg') || k.includes('tomato') || k.includes('onion') || k.includes('cabbage') || k.includes('rape')) return 'leaf';
  if (k.includes('cash') || k.includes('tobacco') || k.includes('cotton') || k.includes('tea') || k.includes('coffee')) return 'coins';
  return 'sprout';
}

export function pickWeatherIconName(code = 0) {
  const c = Number(code);
  if (c === 0 || c === 1) return 'sun';
  if (c === 2 || c === 3) return 'cloudSun';
  if (c >= 45) return 'cloudRain';
  return 'cloudSun';
}
