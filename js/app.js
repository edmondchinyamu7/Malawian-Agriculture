/* ===== App bootstrap: initialise features after HTML partials are ready ===== */
document.addEventListener('DOMContentLoaded', function () {
  Promise.resolve(window.appPartialsReady)
    .then(function () {
      bindModalGlobals();
      initNavigation();
      if (typeof initFarmingMethods === 'function') initFarmingMethods();
      if (typeof initCrops === 'function') initCrops();
      if (typeof initWeather === 'function') initWeather();
    })
    .catch(function (error) {
      console.error('The Ulimi wa Malawi app could not initialise:', error);
    });
});
