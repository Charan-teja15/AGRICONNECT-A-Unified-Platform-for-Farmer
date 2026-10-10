# AGRICONNECT — Frontend

**A Unified Platform for Farmer Market Access, Crop Advisory, and Government Subsidy Awareness**
*"Connecting Farmers to Markets, Knowledge and Government Support."*

Complete, responsive, Flask-ready frontend for the AGRICONNECT college project:
**16 Jinja2 templates + 6 reusable partials + 1 custom stylesheet + 1 JavaScript file**,
built with **HTML5, CSS3, Bootstrap 5, vanilla JavaScript, Bootstrap Icons and Jinja2** —
no React/Angular/Vue, no external APIs, no framework build step.

---

## 1. Project structure

```
AGRICONNECT/
├── templates/
│   ├── base.html                  # shared layout: nav, footer, flashes, confirm modal
│   ├── index.html                 # landing page (hero, 3 services, how it works, why)
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── profile.html               # view mode + edit mode (?edit=1)
│   ├── marketplace.html           # search / filter / sort / paginate
│   ├── create_listing.html
│   ├── edit_listing.html
│   ├── crop_advisory.html
│   ├── advisory_result.html
│   ├── subsidy_checker.html
│   ├── subsidy_results.html
│   ├── 404.html
│   ├── 500.html
│   └── partials/
│       ├── navbar.html
│       ├── footer.html
│       ├── flash_messages.html
│       ├── crop_card.html
│       ├── scheme_card.html
│       └── empty_state.html
├── static/
│   ├── css/style.css              # design tokens + components + utilities
│   ├── js/main.js                 # progressive enhancement only
│   ├── vendor/                    # Bootstrap 5.3.3 + Bootstrap Icons 1.11.3 (offline)
│   │   ├── bootstrap.min.css
│   │   ├── bootstrap.bundle.min.js
│   │   ├── bootstrap-icons.min.css
│   │   └── fonts/…
│   └── images/                    # hero, illustrations, fallbacks + README.md
├── preview_app.py                 # DEV-ONLY preview server (delete before submission)
├── BACKEND_INTEGRATION.md         # endpoints, field names, context contract
├── VERIFICATION_CHECKLIST.md      # page-by-page QA checklist
└── README.md                      # this file
```

---

## 2. Running and previewing the frontend

### Option A — Live preview with the bundled demo server (no backend needed)

```bash
pip install flask                 # only dependency
./run_preview.sh                  # supervised: auto-restarts if it crashes or hangs
python preview_app.py             # single run, no supervisor
python preview_app.py --reset     # rebuild the demo SQLite database
```

`run_preview.sh` is a small supervisor loop: it starts the server, pings
`http://127.0.0.1:5000/` every 15 seconds, and restarts it within 2 seconds if it
exits or stops responding (3 failed checks in a row). Logs go to `server.log`.
Tune it with `PORT=8000 CHECK_INTERVAL=10 ./run_preview.sh`, and stop it with
`pkill -f "[r]un_preview.sh"`.

* Demo login: **demo@agriconnect.in / demo1234** (also shown on the login page while
  `demo_mode` is true). New registrations work too — data is stored in
  `agrconnect_preview.db` and is seeded with 3 farmers, 9 crop listings,
  6 government schemes and 6 advisory rules.
* `preview_app.py` is scaffolding for design review and the expo demo. It implements
  every endpoint/field/context variable the templates use, but **it is not your
  production backend** — delete it (or keep it only as a reference) once your real
  Flask app is wired up.

### Option B — Mount the templates in your own Flask app

```python
from flask import Flask
app = Flask(__name__, template_folder="templates", static_folder="static")
```

Nothing else is needed for the layout to render: `templates/`, `static/css/style.css`,
`static/js/main.js` and `static/vendor/` are the only assets. See
**[BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)** for the exact routes, form field
names and context variables each template expects.

### Offline / expo machines

Bootstrap and Bootstrap Icons are **vendored inside `static/vendor/`**, so the UI is
identical with no internet access. To use a CDN instead, replace the three
`<link>`/`<script>` tags in `templates/base.html` with the jsDelivr URLs and delete
`static/vendor/`.

---

## 3. Design system

| Token | Value | Use |
|---|---|---|
| `--ag-primary` | `#1B5E20` | headings, brand, footer, dark buttons |
| `--ag-secondary` | `#2E7D32` | primary buttons, links, active states |
| `--ag-light` | `#E8F5E9` | icon tiles, soft badges, light surfaces |
| `--ag-bg` | `#F7F9F5` | page background |
| `--ag-white` | `#FFFFFF` | cards |
| `--ag-text` | `#263238` | body copy |
| `--ag-muted` | `#667085` | secondary copy, help text |
| `--ag-accent` | `#F9A825` | CTA buttons, highlight accents |

* **Type:** system font stack (no web fonts → no network dependency, no FOIT).
* **Surfaces:** 14 px radius cards, 1 px `#E3E8E0` borders, layered shadows
  (`--ag-shadow-xs…lg`), 8 px spacing rhythm.
* **Components:** `.card-ag`, `.icon-tile`, `.badge-soft`, `.btn-ag-*`, `.stat-card`,
  `.quick-action`, `.listing-card`, `.result-block`, `.scheme-card`, `.empty-state`,
  `.hero`, `.side-nav`, `.filter-panel`, `.pagination-ag`, `.alert-ag`.
* **Motion:** hover lifts, image zoom on listing cards, reveal-on-scroll, button
  spinners. Everything collapses to zero duration under
  `prefers-reduced-motion: reduce`.

---

## 4. Frontend behaviour implemented in `static/js/main.js`

| Feature | Hook |
|---|---|
| Responsive navbar (collapse + auto-close on navigation) | `.navbar-ag` / `#mainNavbar` |
| Show / hide password (all password fields) | `[data-ag-toggle-password="#id"]` |
| Password strength meter (register) | `[data-ag-strength-target]` |
| Password confirmation matching | `form[data-ag-check-password-match]` |
| Character counters (description, symptoms) | `[data-ag-counter="#id"]` |
| Client-side required validation + loading state | `form[data-ag-validate]` |
| Clear field errors as the user types | `.is-invalid` inputs |
| Delete / destructive-action confirmation modal | `[data-ag-confirm-modal]` |
| Simple native confirmations | `[data-ag-confirm]` |
| Dismissible + auto-dismissing flash messages | `[data-ag-autodismiss]` |
| Filter search / clear filters / auto-submit sort | `#filterForm`, `[data-ag-clear-filters]`, `[data-ag-autosubmit]` |
| Remote-image fallback (never shows a broken image) | `img[data-ag-fallback]` |
| Min date = today for availability date | `[data-ag-min-today]` |
| Reveal on scroll (respects reduced motion) | `.reveal` |
| Helper for future async work | `AG.withLoading(button, promise)` |

> All client-side validation is a **convenience only**. The Flask backend must
> re-validate every field — and the demo server does.

---

## 5. Accessibility & responsiveness

* Every input has an associated `<label for>`; required fields are marked and use
  `aria-invalid` / `aria-describedby` when the server returns an error.
* Error messages are real text nodes, not colour alone; the whole UI is keyboard
  operable with a visible focus ring and a "Skip to main content" link.
* Images carry descriptive `alt`; decorative icons are `aria-hidden="true"`.
* Contrast: text on brand colours is white or `#263238`; muted text meets AA on
  white and on `#F7F9F5`.
* Mobile-first grid: cards stack, the dashboard sidebar and marketplace filter panel
  become collapsible at `<992 px`, tables scroll inside `.table-responsive`,
  and no page scrolls horizontally.
* `prefers-reduced-motion` disables animation; print styles hide chrome for handouts.

---

## 6. Content honesty (important for the viva)

The templates are built so the UI **cannot** overstate what the system does:

* No advisory page shows a confidence percentage or claims a trained AI model —
  the result page states the rule that fired and why.
* No scheme card invents a benefit amount, deadline or URL: every field comes from
  the backend, and empty values render "—" or an explicit "not stored" badge.
* No payment buttons: the marketplace states that AGRICONNECT only helps farmers
  connect, and the footer repeats it.
* Disclaimers on the landing page, advisory pages, subsidy pages and footer state
  that results are informational and do not guarantee an outcome or approval.

---

## 7. Next steps

1. Read **[BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)** and map the endpoints to
   your routes (or rename `url_for()` calls to your blueprint names).
2. Work through **[VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md)** once the
   backend is connected.
3. Replace `static/images/*.jpg` with your own photographs (or licensed stock) and
   note the source in `static/images/README.md`.
