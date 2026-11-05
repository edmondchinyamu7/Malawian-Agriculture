# Ulimi wa Malawi | Agriculture Knowledge Hub

A Malawi-focused agriculture learning hub in Chichewa and English.

## Run locally
This repository includes an Express server. From the project root:

```bash
npm install
npm run dev
```

The server serves static files from the repository root. The frontend uses plain HTML, CSS and JavaScript and requires no frontend build step.

## Project structure
- `index.html` — lightweight page shell that loads the HTML modules
- `partials/` — independent homepage, farming methods, crop library, weather, guides, support, footer and modal sections
- `css/` — base, layout, component, page and master stylesheets
- `js/layout.js` — loads the HTML partials before the app starts
- `js/config.js` — farming methods, crop profiles and Malawi weather locations
- `js/features/` — farming methods, crop library and live weather
- `js/app.js` — application startup after the page modules load

## Included features
- 18 farming methods with search, category filters, saved topics and detail modals
- 8 crop profiles with search, crop-group filters and detail guides
- Malawi weather centre with a 7-day Open-Meteo forecast for 12 locations
- Responsive navigation, keyboard support and accessible status messages

## Data and safety
Market prices are not fabricated or hard-coded. Weather is fetched from Open-Meteo. Confirm local farming decisions with agricultural extension services. Never place private API keys or credentials in frontend files.

## Future development
The modular structure is intended to support the planned V6–V29 features as additive changes.
