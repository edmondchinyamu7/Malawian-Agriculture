# Security Summary

**Reviewed Files**: 52
**Issues Resolved**: 7

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Untrusted Link Protocol | `js/market-centre.js` | 228–248 | Source links from market observation records were inserted directly into `<a href="...">` without validating the URL protocol, allowing `javascript:` or `data:` links if malicious data existed. | High | Fixed | Added `sanitizeHttpUrl()` to permit only `http:` and `https:` URLs before rendering source links. |
| Redirect Parameter Handling | `login.html` | 532–554, 745 | Sign-in `redirect` query parameters for admin and farmer accounts lacked backslash (`\`), control-character, and same-origin URL normalization checks. | Medium | Fixed | Added `sanitizeLocalRedirect()` to reject backslashes, control characters, and off-origin URLs, enforcing local relative paths only. |
| Cross-Origin Request & IP Spoofing Guards | `api/_auth.js` | 178–291 | `verifySameOrigin()` returned true when both `Origin` and `Referer` headers were absent, `getClientIp()` trusted arbitrary client `X-Forwarded-For` headers outside Vercel, and HTTPS session cookies used `SameSite=Lax` without `Partitioned`. | High | Fixed | Required `X-Requested-With: fetch` / `xmlhttprequest` when `Origin`/`Referer` are absent (and updated all frontend `/api/admin/` `POST` callers), confined `getClientIp()` to trusted proxy headers (`req.ip` / Vercel edge headers), and set `Secure; SameSite=None; Partitioned` on HTTPS cookies. |
| Encoded Traversal & Root Static Exposure | `server.js` | 48–56, 176–299 | Dynamic `/:page` routing lacked strict slug confinement, and serving the repository root via `express.static(__dirname)` allowed encoded traversal paths like `/pages/..%2fserver.js` to bypass `req.path` blocklists and read server files. | High | Fixed | Added early URL-decoded dot-segment/backslash/null-byte rejection, canonical path normalization before admin and internal-file guards, strict `SAFE_PAGE_SLUG_REGEX` + `resolveConfinedFile()` confinement, and allowlisted static directory mounts instead of serving the project root. |
| Browser Security Headers | `server.js`, `vercel.json` | 44, 62–73 (`server.js`); 5–14 (`vercel.json`) | Responses exposed `X-Powered-By` and omitted baseline hardening headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). | Low | Fixed | Disabled `x-powered-by` and added global security headers in both Express and Vercel while keeping iframe embedding compatible. |
| Spreadsheet Formula Injection | `js/admin-utils.js` | 119–128 | CSV exports of farmer suggestions wrote raw user-submitted text cells directly, allowing cells starting with `=`, `+`, `-`, `@`, tab, or carriage return to run formulas when opened in spreadsheet tools. | Medium | Fixed | Updated `formatCsvCell()` to prefix formula-triggering values with a leading single quote (`'`) before CSV escaping. |
| Partial Include Allowlist | `js/layout.js` | 11–16 | The client partial loader fetched whatever path string appeared in `[data-include]` without verifying it targeted a local partial file. | Low | Fixed | Restricted `[data-include]` paths to `partials/<slug>.html` or `../partials/<slug>.html` prior to fetching. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Dependency Audit | `bun.lock`, `package.json` | Checked all 67 locked packages with `bun audit`; zero known dependency vulnerabilities were reported. |
| Server Secrets & Credentials | `api/_auth.js`, `.env.example` | `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` are read strictly from server environment variables (`process.env`) and never bundled into client JavaScript. |
| Client Auth Configuration | `js/auth.js` | Browser clients use only the public Supabase URL and publishable key, backed by database Row-Level Security policies across `profiles`, `subscriptions`, `market_price_reports`, `farmer_suggestions`, `revenue_entries`, `expense_entries`, `business_partners`, `app_activity_events`, and `admin_access`. |
| Session Token Signing & Storage | `api/_auth.js` | Administrator session tokens use HMAC-SHA256 signing (`crypto.timingSafeEqual` verification) stored in `HttpOnly` cookies with `no-store` cache headers on all `/api/admin/*` responses and `/pages/admin*.html` routes. |
| Brute-Force Protection | `api/_auth.js` | Failed administrator login attempts are rate-limited per verified client IP (5 failed attempts per 15-minute window). |
| Protected Admin Routing | `server.js`, `scripts/build-public.mjs`, `vercel.json` | Protected `admin*.html` files are excluded from `public/`, blocked from direct static serving, and gated by `requireAdminAuth` before `res.sendFile()`. |
| Dynamic DOM Rendering | `js/*.js`, `profile.html` | Active UI templates pass dynamic crop, market, suggestion, profile, and financial strings through `escapeHtml()` / `esc()` before rendering. |

## PoC Verification

### 1. Unsafe Link Protocol in Market Observation Source URLs

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsanitized Link Protocol |
| Impact | High |
| Affected File | `js/market-centre.js:228-248, 265` |
| Test Scenario | Market observation record containing `sourceUrl: "javascript:alert(document.domain)"` |

#### How It Was Fixed
Added `sanitizeHttpUrl(rawUrl)` to parse the URL via the `URL` constructor and return `parsed.href` only when `parsed.protocol` is `https:` or `http:`. Invalid URLs or non-HTTP schemes return `""` and omit the clickable link.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `openMarketDetail(id)` receives a record with `item.sourceUrl = "javascript:alert(document.domain)"`. | Input enters modal builder |
| 2 | `sanitizeHttpUrl(item.sourceUrl)` at `js/market-centre.js:248` parses the string and checks `parsed.protocol === 'https:' \|\| parsed.protocol === 'http:'` (`js/market-centre.js:234`). | Protocol `'javascript:'` fails check and returns `""` |
| 3 | Template check at `js/market-centre.js:265` sees empty `safeSourceUrl` and skips rendering the `<a>` element. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Executable URL schemes such as `javascript:` and `data:` can no longer render as clickable links in market detail modals.

---

### 2. Open Redirect via Backslashes or Off-Origin Redirect Parameters

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unvalidated Local Redirect |
| Impact | Medium |
| Affected File | `login.html:532-554, 745` |
| Test Scenario | Visiting `/login.html?redirect=/\evil.com` or `/login.html?redirect=//evil.com` |

#### How It Was Fixed
Added `sanitizeLocalRedirect(rawTarget, fallback, blockedKeyword)` to reject backslashes (`\`), control characters (`\u0000-\u001F\u007F`), protocol-relative paths (`//`), and any URL whose parsed `origin` does not match `window.location.origin` or whose protocol is not `http:`/`https:`. Both admin and farmer login redirects now pass through this helper.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Browser opens `/login.html?redirect=/\evil.com` and completes sign-in. | Untrusted `redirect` parameter read from `URLSearchParams` |
| 2 | `getSafeAdminRedirect()` (`login.html:552`) or farmer login (`login.html:745`) calls `sanitizeLocalRedirect()`. | Input evaluated by sanitizer |
| 3 | Line `login.html:535` matches `candidate.includes('\\')` and immediately returns the safe local fallback (`/pages/admin.html` or `/profile.html`). | **Handled Safely** |

#### Conclusion
**Fix Verified** - Both backslash-normalized and protocol-relative external redirects fall back cleanly to safe internal pages.

---

### 3. Missing-Origin Cross-Site Requests, IP Rate-Limit Bypass, and Iframe Cookie Handling

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Origin Request Validation & Rate-Limit Spoofing |
| Impact | High |
| Affected File | `api/_auth.js:178-291`, `js/auth.js:47`, `js/admin.js:304, 354, 867`, `js/admin-suggestions.js:224, 411`, `js/admin-finance.js:58, 178`, `login.html:510` |
| Test Scenario | Sending `POST /api/admin/login` or `POST /api/admin/logout` with stripped `Origin`/`Referer` headers and spoofed `X-Forwarded-For: 198.51.100.25` |

#### How It Was Fixed
`verifySameOrigin(req)` now rejects requests with empty `allowedHosts` or `Origin: null` and requires `X-Requested-With: fetch` (or `xmlhttprequest`) whenever both `Origin` and `Referer` are absent; all legitimate client `POST` callers were updated to include `'X-Requested-With': 'fetch'`. `getClientIp(req)` ignores arbitrary client-supplied `X-Forwarded-For` headers in favor of Express's verified `req.ip` (or Vercel's edge headers on Vercel), and HTTPS cookies emit `Secure; SameSite=None; Partitioned`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | A cross-site form or script sends `POST /api/admin/login` without `Origin`, `Referer`, or `X-Requested-With: fetch`, plus a fake `X-Forwarded-For` header. | Request enters `handleAdminLogin` (`api/_auth.js:486`) |
| 2 | `verifySameOrigin(req)` checks `Origin` (`api/_auth.js:270`), `Referer` (`api/_auth.js:280`), and `X-Requested-With` (`api/_auth.js:289`); none match, so it returns `false`. | Request rejected with HTTP `403 CSRF_ORIGIN_MISMATCH` |
| 3 | For rate-limited failed attempts, `getClientIp(req)` (`api/_auth.js:215-225`) uses `req.ip` / socket address (or Vercel edge header when deployed) instead of raw `X-Forwarded-For`. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Cross-origin state-changing admin requests without trusted same-origin or fetch headers are blocked, and attackers cannot rotate fake `X-Forwarded-For` headers to bypass login rate limits.

---

### 4. Encoded Path Traversal & Dynamic Page Slug Confinement

#### Summary
| Field | Value |
|---|---|
| Issue Type | Path Traversal & Root Static Exposure |
| Impact | High |
| Affected File | `server.js:48-56, 176-299` |
| Test Scenario | Requesting `/pages/..%2fserver.js`, `/..%2fpackage.json`, or `/%2e%2e%2fserver.js` against the Express server |

#### How It Was Fixed
Added an early path-validation middleware (`server.js:176-196`) that URL-decodes `req.path`, rejects null bytes, backslashes, or `..` segments (`%2e%2e`) with HTTP `404`, and stores `req.canonicalPath = path.posix.normalize(decodedPath)` for all admin and internal-file checks. Replaced raw `express.static(__dirname)` with allowlisted static asset directories (`assets`, `css`, `data`, `js`, `partials`), root HTML entry points, and `SAFE_PAGE_SLUG_REGEX` + `resolveConfinedFile()` confinement on page routes.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request `/pages/..%2fserver.js` arrives at the early path guard (`server.js:176`). | Raw path `/pages/..%2fserver.js` enters middleware |
| 2 | `decodeURIComponent(req.path)` yields `/pages/../server.js`, matching `/(?:^\|\/)\.\.(?:\/\|$)/` at `server.js:188` (and `/%2e%2e/i` at `server.js:189`). | Middleware returns HTTP `404` immediately |
| 3 | Broad root static serving is removed (`server.js:250-278`), and valid slugs pass `SAFE_PAGE_SLUG_REGEX` (`server.js:290`) and `resolveConfinedFile()` (`server.js:52-56`). | **Handled Safely** |

#### Conclusion
**Fix Verified** - Encoded traversal sequences cannot reach static handlers, and server source/config files are completely unreachable over HTTP.

---

### 5. Spreadsheet Formula Injection in CSV Exports

#### Summary
| Field | Value |
|---|---|
| Issue Type | CSV Formula Injection |
| Impact | Medium |
| Affected File | `js/admin-utils.js:119-128, 155-157` |
| Test Scenario | Exporting a farmer suggestion whose subject or message is `=CMD\|' /C calc'!A0` or `  +1+1` |

#### How It Was Fixed
Updated `formatCsvCell(value)` to detect leading `=`, `+`, `-`, `@` (including after leading spaces/tabs/CR) as well as leading `\t` or `\r`, and prepend a single quote (`'`) so spreadsheet programs treat the cell strictly as plain text.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `buildSuggestionsCsv(items)` (`js/admin-utils.js:130`) maps each submission field into `formatCsvCell(value)` (`js/admin-utils.js:156`). | Cell value `=1+1` enters formatter |
| 2 | `formatCsvCell()` matches `/^[\t\r ]*[=+\-@]/` at `js/admin-utils.js:121` and transforms `text` to `"'=1+1"`. | Formula trigger neutralized |
| 3 | Standard CSV quoting runs afterward (`js/admin-utils.js:124-126`) and returns the inert string. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Formula-prefixed values in exported farmer suggestion CSV files are neutralized as literal text.

---

### 6. Partial Module Path Allowlist in Layout Loader

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unvalidated Partial Include Path |
| Impact | Low |
| Affected File | `js/layout.js:11-16` |
| Test Scenario | A `[data-include]` attribute set to `//evil.example/payload.html` or `../server.js` |

#### How It Was Fixed
Added an allowlist check matching `/^(?:partials|\.\.\/partials)\/[a-z0-9-]+\.html$/i` before calling `fetch(path)` in `js/layout.js`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | The partial loader reads `placeholder.getAttribute('data-include')` at `js/layout.js:12`. | Include path read from DOM |
| 2 | Line `js/layout.js:13` tests the string against `/^(?:partials\|\.\.\/partials)\/[a-z0-9-]+\.html$/i`. | Path `//evil.example/payload.html` or `../server.js` fails match |
| 3 | Error `'Blocked unsafe page module include path.'` is thrown at `js/layout.js:14` prior to `fetch()`. | **Handled Safely** |

#### Conclusion
**Fix Verified** - The layout partial loader can only fetch local HTML fragments inside `partials/`.
