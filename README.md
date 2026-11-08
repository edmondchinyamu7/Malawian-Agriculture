# Ulimi wa Malawi | Agriculture Knowledge Hub

Ulimi wa Malawi is a comprehensive, practical agricultural knowledge platform designed for smallholder farmers, learners, agricultural extension workers, and agribusinesses in Malawi.

---

## Architecture & Modular File System

```
ulimi-wa-malawi/
│
├── index.html                    # Central Agriculture Knowledge Hub homepage
├── modules.html                  # All-in-one modules browser view
├── metadata.json                 # AI Studio applet metadata & capabilities
├── server.js                     # Express static & clean-routing server (0.0.0.0:3000)
├── package.json                  # Node.js project manifest & scripts
├── README.md                     # Architecture & roadmap documentation
│
├── pages/                        # Feature-specific subpages
│   ├── crop-calendar.html        # V6 Farming & Cropping Seasonal Calendar
│   ├── crops.html                # V7 Advanced Malawi Crop Library (16+ crops)
│   ├── pest-disease.html         # V8 Integrated Pest & Disease Diagnostic Centre
│   ├── market-centre.html        # V5 Agricultural Market Information Centre
│   ├── weather.html              # Live Weather Centre (Open-Meteo 7-day forecast)
│   ├── fertiliser-calculator.html# V10 Fertiliser & Nutrient Quantity Calculator
│   ├── farm-planner.html         # V11 Seed Rate & Yield Estimator
│   ├── soil-centre.html          # V9 Soil Information & Fertility Centre
│   ├── irrigation.html           # V12 Irrigation & Water Management
│   ├── livestock.html            # V13 Animal Husbandry & Livestock Centre
│   ├── learning-centre.html      # V16 Farmer Academy & Tutorials
│   ├── farmer-community.html     # V17 Farmer Community Forum
│   ├── news.html                 # V20 Ministry & Research News Bulletins
│   ├── marketplace.html          # V22 Agricultural Commodities Marketplace
│   └── admin.html                # V23 Admin Market Price & Verification Portal
│
├── css/                          # Modular stylesheets
│   ├── style.css                 # Base theme variables, typography, layout & shell
│   ├── components.css            # Reusable cards, filter pills, search bars, modals, badges
│   ├── dashboard.css             # Dashboards for weather, market tables & analytics
│   ├── admin.css                 # Administrative controls & management tables
│   └── monetization.css          # Finance dashboard and membership plan styling
│   ├── responsive.css            # Mobile drawer navigation & responsive breakpoints
│   └── main.css                  # Combined stylesheet bundle
│
├── js/                           # Modular ES6 JavaScript
│   ├── main.js                   # Shared utilities, toast alerts, bookmarks & modal system
│   ├── navigation.js             # Mobile menu toggle, active link tracking, scroll spy
│   ├── crop-calendar.js          # V6 Interactive monthly calendar, reminders & crop Gantt
│   ├── crops.js                  # V7 Advanced crop catalog, agronomic guides & modal
│   ├── pest-disease.js           # V8 Pest & disease diagnostic search, filters & safety
│   ├── market-centre.js          # V5 Market prices directory, regional comparisons & stats
│   ├── weather.js                # Live Open-Meteo weather API integration & farm advisories
│   ├── calculators.js            # Fertiliser quantities, land area & seed calculations
│   ├── admin.js                  # Price administration, verification toggle & data reset
│   ├── admin-finance.js          # Revenue, expenses, users and subscription analytics
│   └── subscriptions.js          # Public four-tier membership catalogue
│
├── data/                         # Structured JSON datasets
│   ├── crops.json                # 16 complete Malawi crop profiles & agronomic guides
│   ├── farming-calendar.json     # 12-month agricultural timeline, seasonal reminders & crop schedules
│   ├── pests-diseases.json       # Diagnostic profiles for major Malawi pests & crop diseases
│   ├── farming-guides.json       # 18 traditional, commercial & modern farming systems
│   ├── markets.json              # Baseline agricultural market prices across Malawi
│   └── locations.json            # 12 Malawi district coordinates for weather & markets
│
└── partials/                     # Reusable HTML partial components
    ├── header.html
    ├── hero.html
    ├── landing.html
    ├── overview-features.html
    ├── farming-methods.html
    ├── crop-library.html
    ├── weather-centre.html
    ├── practical-guides.html
    ├── support-resources.html
    ├── overlays.html
    └── footer.html
```

---

## Roadmap Implementation Status

### Phase 1: Core Upgrades (Complete)
- **V5: Agricultural Market Information Centre**:
  - Live commodity price directory (Maize, Groundnuts, Soya, Rice, Tomatoes, Cassava, Pigeon Pea).
  - Market locations (Lilongwe, Blantyre, Mzuzu, Kasungu, Salima, Thyolo, Dedza, Karonga).
  - Price comparison between surplus rural production and deficit urban demand hubs.
  - Verified (`✓`) and Unverified (`⏳`) trade status badges.
  - Admin price management portal with local storage persistence.

- **V6: Farming Calendar (`pages/crop-calendar.html` & `js/crop-calendar.js`)**:
  - Interactive 12-month agricultural timeline with seasonal reminders.
  - Regional ecological zone selector (Southern, Central, Northern) with specific field guidance.
  - Crop-specific growth timelines (Maize, Groundnuts, Soya, Rice, Cassava, Tomato) with stage-by-stage Gantt cards.
  - "Current Month Activities" quick jump button.

- **V7: Advanced Crop Library (`pages/crops.html` & `js/crops.js`)**:
  - Expanded from 8 to 16 key Malawian crops (Maize, Groundnuts, Soya, Rice, Cassava, Sweet Potato, Tomato, Pigeon Pea, Common Beans, Irish Potato, Cotton, Tobacco, Tea, Coffee, Sunflower, Leafy Brassicas).
  - Detailed soil requirements, recommended fertiliser schedules (basal & top-dressing), key pests/diseases, planting/harvesting windows, and district ecological suitability.

- **V8: Pest and Disease Management (`pages/pest-disease.html` & `js/pest-disease.js`)**:
  - Diagnostic profiles for major Malawian pests and diseases (Fall Armyworm, Maize Stalk Borer, Groundnut Rosette, Cassava Mosaic CMD, Cassava Brown Streak CBSD, Tomato Late Blight, Tomato Tuta Absoluta, Larger Grain Borer).
  - Searchable symptom checker, host crop filters, severity ratings, cultural/biological prevention methods, approved chemical controls, and pesticide safety guidelines.

---

## Technical Standards & Verification

- Pure web standards: HTML5, CSS3, ES6 Modules, and JSON.
- Fully responsive across mobile phones, tablets, and desktop displays.
- Strict relative paths (`../css/`, `../js/`, `../data/`) ensuring GitHub Pages and web server compatibility.
- Build and linting verify clean.


## Monetisation & Business Dashboard

- Four membership plans are stored in Supabase: Free (MWK 0), Standard (MWK 2,000/month), Professional (MWK 5,000/month), and Agribusiness Premium (MWK 10,000/month).
- The administrator portal includes a finance dashboard for active users, subscriptions, recorded revenue, operating expenses and operating result.
- Finance dashboard access is restricted through the existing administrator sign-in and Supabase Row Level Security.
- Daily authenticated activity is recorded once per user per day to support monthly active user reporting.
- Revenue and expense entries are administrator-managed. Actual AdMob and Google Play Billing integrations remain separate launch tasks.
- SQL setup is documented in `supabase/monetization.sql`.
