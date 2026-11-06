/**
 * Ulimi wa Malawi | Live Weather Centre (Open-Meteo Integration)
 */

export const weatherPlaces = {
  Lilongwe: { lat: -13.9626, lon: 33.7741 },
  Blantyre: { lat: -15.7861, lon: 35.0058 },
  Mzuzu: { lat: -11.4581, lon: 34.0151 },
  Zomba: { lat: -15.3850, lon: 35.3188 },
  Kasungu: { lat: -13.0333, lon: 33.4833 },
  Mangochi: { lat: -14.4782, lon: 35.2645 },
  Salima: { lat: -13.7804, lon: 34.4587 },
  Dedza: { lat: -14.3779, lon: 34.3332 },
  Karonga: { lat: -9.9333, lon: 33.9333 },
  Nsanje: { lat: -16.9190, lon: 35.2610 },
  Chitipa: { lat: -9.7024, lon: 33.2697 },
  Balaka: { lat: -14.9793, lon: 34.9558 }
};

export function weatherDescription(code) {
  if (code === 0) return ['Clear sky', '☀️'];
  if ([1, 2].includes(code)) return ['Mainly clear / partly cloudy', '🌤️'];
  if (code === 3) return ['Overcast', '☁️'];
  if ([45, 48].includes(code)) return ['Fog', '🌫️'];
  if ([51, 53, 55, 56, 57].includes(code)) return ['Drizzle', '🌦️'];
  if ([61, 63, 65, 66, 67].includes(code)) return ['Rain', '🌧️'];
  if ([71, 73, 75, 77].includes(code)) return ['Snow / ice pellets', '🌨️'];
  if ([80, 81, 82].includes(code)) return ['Rain showers', '🌧️'];
  if ([85, 86].includes(code)) return ['Snow showers', '🌨️'];
  if ([95, 96, 99].includes(code)) return ['Thunderstorm', '⛈️'];
  return ['Variable conditions', '🌥️'];
}

export function farmWeatherAdvice(current, daily) {
  const rain = Number(daily.precipitation_sum?.[0] || 0);
  const prob = Number(daily.precipitation_probability_max?.[0] || 0);
  const code = Number(current.weather_code);

  if ([95, 96, 99].includes(code) || prob >= 70) {
    return '<strong>Farm planning note:</strong> Rain or storm risk is elevated. Check local warnings, avoid working in exposed stormy fields, and inspect drainage ditches around your crops and drying structures.';
  }
  if (rain >= 5 || prob >= 40) {
    return '<strong>Farm planning note:</strong> Rain is probable. Review field ridges and plan outdoor operations flexibly. Avoid applying agrochemicals right before heavy rain to prevent runoff.';
  }
  if (Number(current.temperature_2m) >= 32) {
    return '<strong>Farm planning note:</strong> High temperatures forecast. Watch shallow-rooted crops and livestock for moisture stress, inspect irrigation lines, and conduct weeding/spraying in early morning hours.';
  }
  return '<strong>Farm planning note:</strong> Favourable conditions. Use this outlook with daily field inspections. Check root-zone soil moisture before watering and keep monitoring crop growth.';
}

export async function loadWeather() {
  const select = document.getElementById('weatherDistrict');
  const button = document.getElementById('refreshWeather');
  const status = document.getElementById('weatherStatus');
  const results = document.getElementById('weatherResults');
  const currentBox = document.getElementById('weatherCurrent');
  const grid = document.getElementById('forecastGrid');
  const advice = document.getElementById('weatherAdvice');

  if (!select || !button || !status || !results) return;

  const place = select.value;
  const coords = weatherPlaces[place] || weatherPlaces.Lilongwe;

  button.disabled = true;
  button.textContent = 'Loading…';
  status.classList.remove('error');
  status.textContent = `Getting the latest available forecast for ${place}…`;
  results.hidden = true;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&forecast_days=7&timezone=Africa%2FBlantyre`;

  try {
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('Weather service returned an unavailable response.');

    const data = await response.json();
    if (!data.current || !data.daily) throw new Error('Weather service did not return complete forecast data.');

    const current = data.current;
    const daily = data.daily;
    const desc = weatherDescription(current.weather_code);

    if (currentBox) {
      currentBox.innerHTML = `
        <div class="weather-now">
          <div class="place">📍 ${place}, Malawi</div>
          <div class="temperature">${Math.round(current.temperature_2m)}°C</div>
          <div class="condition">${desc[1]} ${desc[0]}</div>
          <div class="updated">Updated: ${new Date(current.time).toLocaleString('en-GB', { timeZone: 'Africa/Blantyre', dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div class="weather-metrics">
          <div class="weather-metric"><span>💧 Relative humidity</span><strong>${Math.round(current.relative_humidity_2m)}%</strong></div>
          <div class="weather-metric"><span>🌧️ Current precipitation</span><strong>${Number(current.precipitation).toFixed(1)} mm</strong></div>
          <div class="weather-metric"><span>💨 Wind speed</span><strong>${Math.round(current.wind_speed_10m)} km/h</strong></div>
          <div class="weather-metric"><span>🌡️ Current temperature</span><strong>${Math.round(current.temperature_2m)}°C</strong></div>
        </div>
      `;
    }

    if (grid && daily.time) {
      grid.innerHTML = daily.time.map((date, i) => {
        const d = new Date(date + 'T12:00:00');
        const day = i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' });
        const w = weatherDescription(Number(daily.weather_code[i]));
        const rain = daily.precipitation_probability_max?.[i];
        return `
          <article class="forecast-day">
            <div class="day">${day}</div>
            <div class="symbol" aria-label="${w[0]}">${w[1]}</div>
            <div class="range">${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</div>
            <div class="rain">${rain == null ? '—' : Math.round(rain) + '%'} rain<br>${Number(daily.precipitation_sum?.[i] || 0).toFixed(1)} mm</div>
          </article>
        `;
      }).join('');
    }

    if (advice) {
      advice.innerHTML = farmWeatherAdvice(current, daily);
    }

    status.textContent = `Forecast loaded for ${place}.`;
    results.hidden = false;
  } catch (error) {
    status.classList.add('error');
    status.textContent = 'Unable to load live weather right now. Check your internet connection and try again. No forecast has been invented or substituted.';
  } finally {
    button.disabled = false;
    button.textContent = '↻ Refresh forecast';
  }
}

export function initWeather() {
  const select = document.getElementById('weatherDistrict');
  const refreshBtn = document.getElementById('refreshWeather');

  if (select) {
    select.addEventListener('change', loadWeather);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadWeather);
  }

  // Auto-load if weather controls exist on current page
  if (select && refreshBtn) {
    loadWeather();
  }
}

document.addEventListener('DOMContentLoaded', initWeather);
