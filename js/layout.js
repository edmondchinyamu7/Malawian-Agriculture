/* ===== HTML partial loader =====
   Loads the page sections before the feature modules initialise.
   Paths stay relative so the app works from a GitHub Pages project URL.
*/
(function () {
  window.appPartialsReady = (async function () {
    var placeholders = Array.prototype.slice.call(
      document.querySelectorAll('[data-include]')
    );

    return Promise.all(placeholders.map(async function (placeholder) {
      var path = placeholder.getAttribute('data-include');
      var response = await fetch(path, { headers: { 'Accept': 'text/html' } });
      if (!response.ok) {
        throw new Error('Could not load page module: ' + path + ' (' + response.status + ')');
      }
      placeholder.outerHTML = await response.text();
      return path;
    }));
  })();

  window.appPartialsReady.catch(function (error) {
    console.error('Ulimi wa Malawi page modules failed to load:', error);
    var message = document.createElement('p');
    message.className = 'notice';
    message.setAttribute('role', 'alert');
    message.textContent = 'Some page sections could not load. Refresh the page or check your connection.';
    document.body.appendChild(message);
  });
})();
