/* ===== App bootstrap: wire every feature once the DOM is ready ===== */
document.addEventListener('DOMContentLoaded', function () {
  bindModalGlobals();
  initNavigation();
  if (typeof initFarmingMethods === 'function') initFarmingMethods();
  if (typeof initCrops === 'function') initCrops();
  if (typeof initWeather === 'function') initWeather();
});