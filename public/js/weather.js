/**
 * Ulimi wa Malawi | Live Weather Centre (Open-Meteo Integration)
 * Full Bilingual (Chichewa default / English) Support
 */
import { getCurrentLang } from './i18n.js';

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

export function weatherDescription(code, lang = 'ny') {
  if (lang === 'ny') {
    if (code === 0) return ['Dzuwa / Thambo loyera', '☀️'];
    if ([1, 2].includes(code)) return ['Mitambo yapang\'ono', '🌤️'];
    if (code === 3) return ['Mitambo yambiri', '☁️'];
    if ([45, 48].includes(code)) return ['Chifunga', '🌫️'];
    if ([51, 53, 55, 56, 57].includes(code)) return ['Mvula yowaza', '🌦️'];
    if ([61, 63, 65, 66, 67].includes(code)) return ['Mvula ikugwa', '🌧️'];
    if ([71, 73, 75, 77].includes(code)) return ['Matalala', '🌨️'];
    if ([80, 81, 82].includes(code)) return ['Mvula yapang\'ono', '🌧️'];
    if ([85, 86].includes(code)) return ['Matalala', '🌨️'];
    if ([95, 96, 99].includes(code)) return ['Mvula ya bingu ndi mphenzi', '⛈️'];
    return ['Nyengo yosinthasintha', '🌥️'];
  } else {
    if (code === 0) return ['Clear sky', '☀️'];
    if ([1, 2].includes(code)) return ['Mainly clear / partly cloudy', '🌤️'];
    if (code === 3) return ['Overcast', '☁️'];
    if ([45, 48].includes(code)) return ['Fog', '🌫️'];
    if ([51, 53, 55, 56, 57].includes(code)) return ['Drizzle', '🌦️'];
    if ([61, 63, 65, 66, 67].includes(code)) return ['Rain', '🌧️'];
    if ([71, 73, 75, 77].includes(code)) return ['Hail / ice pellets', '🌨️'];
    if ([80, 81, 82].includes(code)) return ['Rain showers', '🌧️'];
    if ([85, 86].includes(code)) return ['Snow / hail showers', '🌨️'];
    if ([95, 96, 99].includes(code)) return ['Thunderstorm', '⛈️'];
    return ['Variable conditions', '🌥️'];
  }
}

export function farmWeatherAdvice(current, daily, lang = 'ny') {
  const rain = Number(daily.precipitation_sum?.[0] || 0);
  const prob = Number(daily.precipitation_probability_max?.[0] || 0);
  const code = Number(current.weather_code);

  if (lang === 'ny') {
    if ([95, 96, 99].includes(code) || prob >= 70) {
      return '<strong>Malangizo a m\'munda:</strong> Pali chiopsezo cha mvula yamphamvu kapena bingu. Pewani kugwira ntchito m\'minda yotseguka ndipo onetsetsani kuti mitsinje ndi mizere yochotsera madzi m\'munda siyadzala komanso chitetezo cha nkhokwe ndi zofolera.';
    }
    if (rain >= 5 || prob >= 40) {
      return '<strong>Malangizo a m\'munda:</strong> Mvula ikuyembekezeka. Onetsetsani mizere ya munda wanu ndipo musathire feteleza wamadzimadzi kapena mankhwala a tizilombo mvula isanagwe kuti asapite ndi madzi.';
    }
    if (Number(current.temperature_2m) >= 32) {
      return '<strong>Malangizo a m\'munda:</strong> Kutentha kwambiri. Samalani mbewu zazing\'ono ndi ziweto kuti zisamwe madzi okwanira, thirirani m\'mawa kwambiri kapena dzuwa litalowa kuti madzi asaphwe mwamsanga.';
    }
    return '<strong>Malangizo a m\'munda:</strong> Nyengo yabwino yaulimi. Yenderani munda nthawi zonse, yang\'anani chinyontho cha nthaka musanathirire madzi komanso pitirizani kuyang\'ana kukula kwa mbewu.';
  } else {
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

  const lang = getCurrentLang();
  const place = select.value;
  const coords = weatherPlaces[place] || weatherPlaces.Lilongwe;

  button.disabled = true;
  button.textContent = lang === 'ny' ? 'Kutenga…' : 'Loading…';
  status.classList.remove('error');
  status.textContent = lang === 'ny' ? `Kutenga zolosera zatsopano za nyengo ku ${place}…` : `Getting the latest available forecast for ${place}…`;
  results.hidden = true;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&forecast_days=7&timezone=Africa%2FBlantyre`;

  try {
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('Weather service returned an unavailable response.');

    const data = await response.json();
    if (!data.current || !data.daily) throw new Error('Weather service did not return complete forecast data.');

    const current = data.current;
    const daily = data.daily;
    const desc = weatherDescription(current.weather_code, lang);

    const humLabel = lang === 'ny' ? '💧 Chinyezi cha mpweya' : '💧 Relative humidity';
    const rainLabel = lang === 'ny' ? '🌧️ Mvula ya lero' : '🌧️ Current precipitation';
    const windLabel = lang === 'ny' ? '💨 Liwiro la mphepo' : '💨 Wind speed';
    const tempLabel = lang === 'ny' ? '🌡️ Kutentha kwake' : '🌡️ Current temperature';
    const updatedLabel = lang === 'ny' ? 'Yasinthidwa:' : 'Updated:';

    if (currentBox) {
      currentBox.innerHTML = `
        <div class="weather-now">
          <div class="place">📍 ${place}, Malawi</div>
          <div class="temperature">${Math.round(current.temperature_2m)}°C</div>
          <div class="condition">${desc[1]} ${desc[0]}</div>
          <div class="updated">${updatedLabel} ${new Date(current.time).toLocaleString(lang === 'ny' ? 'ny-MW' : 'en-GB', { timeZone: 'Africa/Blantyre', dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div class="weather-metrics">
          <div class="weather-metric"><span>${humLabel}</span><strong>${Math.round(current.relative_humidity_2m)}%</strong></div>
          <div class="weather-metric"><span>${rainLabel}</span><strong>${Number(current.precipitation).toFixed(1)} mm</strong></div>
          <div class="weather-metric"><span>${windLabel}</span><strong>${Math.round(current.wind_speed_10m)} km/h</strong></div>
          <div class="weather-metric"><span>${tempLabel}</span><strong>${Math.round(current.temperature_2m)}°C</strong></div>
        </div>
      `;
    }

    if (grid && daily.time) {
      grid.innerHTML = daily.time.map((date, i) => {
        const d = new Date(date + 'T12:00:00');
        const day = i === 0 ? (lang === 'ny' ? 'Lero' : 'Today') : d.toLocaleDateString(lang === 'ny' ? 'ny-MW' : 'en-GB', { weekday: 'short' });
        const w = weatherDescription(Number(daily.weather_code[i]), lang);
        const rain = daily.precipitation_probability_max?.[i];
        const rainText = lang === 'ny' ? 'mvula' : 'rain';
        return `
          <article class="forecast-day">
            <div class="day">${day}</div>
            <div class="symbol" aria-label="${w[0]}">${w[1]}</div>
            <div class="range">${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</div>
            <div class="rain">${rain == null ? '—' : Math.round(rain) + '%'} ${rainText}<br>${Number(daily.precipitation_sum?.[i] || 0).toFixed(1)} mm</div>
          </article>
        `;
      }).join('');
    }

    if (advice) {
      advice.innerHTML = farmWeatherAdvice(current, daily, lang);
    }

    status.textContent = lang === 'ny' ? `Zanyengo za ku ${place} zatuluka bwinobwino.` : `Forecast loaded for ${place}.`;
    results.hidden = false;
  } catch (error) {
    status.classList.add('error');
    status.textContent = lang === 'ny'
      ? 'Sitinathe kutenga zanyengo pakadali pano. Yang\'anani intaneti yanu ndikuyesanso. Palibe zolosera zopeka zomwe zalowetsedwa.'
      : 'Unable to load live weather right now. Check your internet connection and try again. No forecast has been invented or substituted.';
  } finally {
    button.disabled = false;
    button.textContent = lang === 'ny' ? '↻ Pezani nyengo yatsopano' : '↻ Refresh forecast';
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

  // Re-render weather when language changes
  window.addEventListener('languageChanged', () => {
    loadWeather();
  });
}

document.addEventListener('DOMContentLoaded', initWeather);
