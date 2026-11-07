/* ===== Feature: Live weather centre (Open-Meteo) ===== */
(function () {

  function weatherDescription(code) {
    if (code === 0) return ['Clear sky', '☀️'];
    if ([1, 2].indexOf(code) !== -1) return ['Mainly clear / partly cloudy', '🌤️'];
    if (code === 3) return ['Overcast', '☁️'];
    if ([45, 48].indexOf(code) !== -1) return ['Fog', '🌫️'];
    if ([51, 53, 55, 56, 57].indexOf(code) !== -1) return ['Drizzle', '🌦️'];
    if ([61, 63, 65, 66, 67].indexOf(code) !== -1) return ['Rain', '🌧️'];
    if ([71, 73, 75, 77].indexOf(code) !== -1) return ['Snow / ice pellets', '🌨️'];
    if ([80, 81, 82].indexOf(code) !== -1) return ['Rain showers', '🌧️'];
    if ([85, 86].indexOf(code) !== -1) return ['Snow showers', '🌨️'];
    if ([95, 96, 99].indexOf(code) !== -1) return ['Thunderstorm', '⛈️'];
    return ['Variable conditions', '🌥️'];
  }

  function farmWeatherAdvice(current, daily) {
    var rain = Number((daily.precipitation_sum || [])[0] || 0);
    var prob = Number((daily.precipitation_probability_max || [])[0] || 0);
    var code = Number(current.weather_code);
    if ([95, 96, 99].indexOf(code) !== -1 || prob >= 70) {
      return '<strong>Farm planning note:</strong> Rain or storm risk may be elevated. ' +
        'Check local warnings, avoid working in unsafe storm conditions, and inspect drainage ' +
        'around fields and storage areas.';
    }
    if (rain >= 5 || prob >= 40) {
      return '<strong>Farm planning note:</strong> Rain is possible. Review field drainage ' +
        'and plan field work flexibly. Avoid applying products when rain could wash them away; ' +
        'follow the product label and local extension advice.';
    }
    if (Number(current.temperature_2m) >= 32) {
      return '<strong>Farm planning note:</strong> Hot conditions are forecast. Monitor crops ' +
        'and livestock for heat stress, check water availability, and schedule demanding outdoor ' +
        'work for cooler periods.';
    }
    return '<strong>Farm planning note:</strong> Use this forecast alongside field observations. ' +
      'Check soil moisture before irrigation and continue routine crop and livestock monitoring.';
  }

  async function loadWeather() {
    var select = document.querySelector('#weatherDistrict');
    var button = document.querySelector('#refreshWeather');
    var status = document.querySelector('#weatherStatus');
    var results = document.querySelector('#weatherResults');
    if (!select || !button || !status || !results) return;

    var place = select.value;
    var coords = weatherPlaces[place];
    if (!coords) return;

    button.disabled = true;
    button.textContent = 'Loading…';
    status.classList.remove('error');
    status.textContent = 'Getting the latest available forecast for ' + place + '…';
    results.hidden = true;

    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + coords.lat +
      '&longitude=' + coords.lon +
      '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum' +
      '&forecast_days=7&timezone=Africa%2FBlantyre';

    try {
      var response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('Weather service returned an unavailable response.');
      var data = await response.json();
      if (!data.current || !data.daily) throw new Error('The weather service did not return a complete forecast.');

      var current = data.current;
      var daily = data.daily;
      var desc = weatherDescription(current.weather_code);

      document.querySelector('#weatherCurrent').innerHTML =
        '<div class="weather-now">' +
          '<div class="place">📍 ' + place + ', Malawi</div>' +
          '<div class="temperature">' + Math.round(current.temperature_2m) + '°C</div>' +
          '<div class="condition">' + desc[1] + ' ' + desc[0] + '</div>' +
          '<div class="updated">Updated: ' +
            new Date(current.time).toLocaleString('en-GB', {
              timeZone: 'Africa/Blantyre', dateStyle: 'medium', timeStyle: 'short'
            }) + '</div>' +
        '</div>' +
        '<div class="weather-metrics">' +
          '<div class="weather-metric"><span>💧 Relative humidity</span><strong>' +
            Math.round(current.relative_humidity_2m) + '%</strong></div>' +
          '<div class="weather-metric"><span>🌧️ Current precipitation</span><strong>' +
            Number(current.precipitation).toFixed(1) + ' mm</strong></div>' +
          '<div class="weather-metric"><span>💨 Wind speed</span><strong>' +
            Math.round(current.wind_speed_10m) + ' km/h</strong></div>' +
          '<div class="weather-metric"><span>🌡️ Current temperature</span><strong>' +
            Math.round(current.temperature_2m) + '°C</strong></div>' +
        '</div>';

      var grid = document.querySelector('#forecastGrid');
      grid.innerHTML = daily.time.map(function (date, i) {
        var d = new Date(date + 'T12:00:00');
        var day = i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' });
        var w = weatherDescription(Number(daily.weather_code[i]));
        var rain = (daily.precipitation_probability_max || [])[i];
        return '<article class="forecast-day">' +
          '<div class="day">' + day + '</div>' +
          '<div class="symbol" aria-label="' + w[0] + '">' + w[1] + '</div>' +
          '<div class="range">' + Math.round(daily.temperature_2m_max[i]) + '° / ' +
            Math.round(daily.temperature_2m_min[i]) + '°</div>' +
          '<div class="rain">' + (rain == null ? '—' : Math.round(rain) + '%') + ' rain chance<br>' +
            Number((daily.precipitation_sum || [])[i] || 0).toFixed(1) + ' mm</div>' +
          '</article>';
      }).join('');

      document.querySelector('#weatherAdvice').innerHTML = farmWeatherAdvice(current, daily);
      status.textContent = 'Forecast loaded for ' + place + '.';
      results.hidden = false;
    } catch (err) {
      status.classList.add('error');
      status.textContent =
        'Unable to load live weather right now. Check your internet connection and try again. ' +
        'No forecast has been invented or substituted.';
    } finally {
      button.disabled = false;
      button.textContent = '↻ Refresh forecast';
    }
  }

  window.initWeather = function () {
    var sel = document.querySelector('#weatherDistrict');
    var btn = document.querySelector('#refreshWeather');
    if (!sel || !btn) return;
    sel.addEventListener('change', loadWeather);
    btn.addEventListener('click', loadWeather);
    loadWeather();
  };
})();