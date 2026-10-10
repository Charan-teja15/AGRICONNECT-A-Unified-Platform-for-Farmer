# Backend integration notes

Everything the frontend expects from the Flask + SQLite backend, in one place.
The bundled `preview_app.py` already implements all of it and can be used as a
reference implementation.

---

## 1. Endpoints

Flat endpoint names are used throughout the templates (no blueprints assumed).
If your app uses blueprints, do a project-wide find & replace of `url_for('x')`
using the mapping in §2 — no other change is required.

| Endpoint | Methods | URL rule | Template | Notes |
|---|---|---|---|---|
| `index` | GET | `/` | `index.html` | optional `public_stats`, `featured_listings` |
| `login` | GET, POST | `/login` | `login.html` | supports `?next=` |
| `register` | GET, POST | `/register` | `register.html` | |
| `logout` | POST *(GET fallback)* | `/logout` | — | navbar + sidebar post here with CSRF |
| `dashboard` | GET | `/dashboard` | `dashboard.html` | login required |
| `profile` | GET, POST | `/profile` | `profile.html` | `?edit=1` opens edit mode |
| `marketplace` | GET | `/marketplace` | `marketplace.html` | query-string filters |
| `create_listing` | GET, POST | `/listings/new` | `create_listing.html` | login required |
| `edit_listing` | GET, POST | `/listings/<int:listing_id>/edit` | `edit_listing.html` | owner only |
| `delete_listing` | POST | `/listings/<int:listing_id>/delete` | — | owner only, confirmed in UI |
| `crop_advisory` | GET, POST | `/crop-advisory` | `crop_advisory.html` | POST → redirect to result |
| `advisory_result` | GET | `/crop-advisory/<int:query_id>` | `advisory_result.html` | |
| `subsidy_checker` | GET, POST | `/subsidy-checker` | `subsidy_checker.html` → `subsidy_results.html` | |
| `subsidy_results` | GET | `/subsidy-results` | `subsidy_results.html` | re-shows last stored check |
| `static` | GET | `/static/...` | — | provided by Flask |

### 2. Blueprint mapping (if you use blueprints)

| Template call | Blueprint equivalent |
|---|---|
| `url_for('index')` | `url_for('main.index')` |
| `url_for('login' / 'register' / 'logout')` | `url_for('auth.login' / 'auth.register' / 'auth.logout')` |
| `url_for('dashboard' / 'profile')` | `url_for('farmer.dashboard' / 'farmer.profile')` |
| `url_for('marketplace' / 'create_listing' / 'edit_listing' / 'delete_listing')` | `url_for('marketplace.index' / 'marketplace.create' / 'marketplace.edit' / 'marketplace.delete')` |
| `url_for('crop_advisory' / 'advisory_result')` | `url_for('advisory.form' / 'advisory.result')` |
| `url_for('subsidy_checker' / 'subsidy_results')` | `url_for('subsidy.checker' / 'subsidy.results')` |

---

## 3. Form field names (exact `name=` attributes)

### `login` — POST
`email` (email **or** username), `password`, `remember` (optional checkbox), `next` (hidden), `csrf_token`

### `register` — POST
`full_name`, `email`, `phone`, `state`, `district`, `land_size`, `preferred_crop`,
`password`, `confirm_password`, `csrf_token`

### `profile` — POST
`full_name`, `email`, `phone`, `state`, `district`, `land_size`, `preferred_crop`, `csrf_token`

### `create_listing` / `edit_listing` — POST
`crop_name`, `quantity`, `unit`, `expected_price`, `state`, `district`,
`availability_date`, `description`, `contact_info`, `csrf_token`
(`edit_listing` also posts `status`.)

### `delete_listing` — POST
`csrf_token` only (listing id is in the URL).

### `crop_advisory` — POST
`crop_name`, `growth_stage`, `soil_type`, `symptoms`, `irrigation`, `weather`, `csrf_token`

### `subsidy_checker` — POST
`state`, `district`, `land_size`, `landholding_category`, `crop_type`, `csrf_token`
**plus** any dynamic field declared in `extra_fields` (see §6).

### `marketplace` — GET query string
`q`, `state`, `district`, `min_price`, `max_price`, `sort` (`newest` | `price_asc` | `price_desc`), `mine`, `page`

---

## 4. Context variables (all optional — every template has safe defaults)

| Variable | Used by | Shape |
|---|---|---|
| `current_user` | navbar, footer, index, dashboards | any object with `.is_authenticated`, `.name`, `.email` (Flask-Login works as-is) |
| `request` | navbar active-state, 404 | Flask request (automatic) |
| `csrf_token()` | every POST form | Jinja global from Flask-WTF (`CSRFProtect`) or your own helper |
| `errors` | every form page | `dict` field-name → message (`errors.email`), plus optional `errors.general` |
| `form_data` | every form page | `dict` of previously submitted values for re-population. **Never put passwords in it.** |
| `user` | dashboard, profile, forms | user record: `name, email, phone, state, district, land_size, preferred_crop, created_at` |
| `stats` | dashboard | `dict`: `active_listings, available_crops, advisory_queries, scheme_matches` |
| `recent_listings` | dashboard | list of listings |
| `recent_advisories` | dashboard | list: `id, crop_name, growth_stage, created_at` |
| `next_steps` | dashboard | list of `{title, text, url, icon, action_label}` (omit for built-in defaults) |
| `profile_completion` | dashboard, profile | int 0–100 |
| `today` | dashboard header | pre-formatted date string |
| `listings` | marketplace | list of listings (see §5) |
| `filters` | marketplace | `dict` echoing the query string (`q, state, district, min_price, max_price, sort, mine`) |
| `result_count`, `pagination` | marketplace | int; paginator object |
| `sort_options` | marketplace | list of `{value,label}` (template has defaults) |
| `listing` | edit_listing | single listing record |
| `query`, `advisory` | advisory_result | see §7 |
| `criteria`, `schemes`, `match_count`, `schemes_checked`, `checked_at` | subsidy_results | see §8 |
| `public_stats`, `featured_listings` | index | `dict`; list of listings |
| `states`, `districts`, `crops`, `units`, `growth_stages`, `soil_types`, `irrigation_options`, `weather_options`, `categories` | all forms | lists of strings (dropdowns/datalists) |

### Feature flags (all default to sensible values)

| Flag | Default | Effect |
|---|---|---|
| `supports_remember_me` | `True` | hides the remember-me checkbox when `False` |
| `collect_phone` | `True` | hides phone fields when `False` |
| `require_phone` | `False` | marks phone required |
| `collect_land_size` / `collect_preferred_crop` | `True` | registration |
| `collect_landholding_category` | `True` | subsidy checker |
| `collect_weather` | `True` | crop advisory form |
| `require_contact` | `False` | listing contact information |
| `history_enabled` | `False` | wording of the "advisory queries" stat card when history is not stored |
| `demo_mode` (+ `demo_credentials`) | `False` | shows the demo login hint on `login.html` |

A single context processor can inject all of the lists and flags:

```python
@app.context_processor
def inject_globals():
    return dict(states=STATES, districts=DISTRICTS, crops=CROPS, units=UNITS,
                growth_stages=GROWTH_STAGES, soil_types=SOIL_TYPES,
                irrigation_options=IRRIGATION_OPTIONS, weather_options=WEATHER_OPTIONS,
                categories=LANDHOLDING_CATEGORIES, app_name="AGRICONNECT",
                current_year=date.today().year)
```

Templates work with **ORM objects or plain dicts** (Jinja resolves `listing.crop_name`
for both). Prefer dicts when passing computed values such as `is_owner`.

---

## 5. Listing record contract

`id, user_id, crop_name, quantity, unit, expected_price, state, district,
availability_date, description, contact_info, status, image_url, created_at,
farmer_name, is_owner`

* `status`: `available` | `reserved` | `sold` (anything else renders as a neutral badge).
* `image_url`: optional — falls back to `static/images/crop-placeholder.jpg`, then to a
  leaf icon if that fails too.
* `is_owner`: set it in the view (`listing.user_id == current_user.id`) so the marketplace
  can show Edit/Delete controls; the dashboard passes it implicitly for the owner's rows.

---

## 6. Dynamic eligibility fields (`subsidy_checker.html`)

If your scheme database needs extra inputs, pass `extra_fields` — the template renders
them with no template changes:

```python
extra_fields = [
    {"name": "farmer_category", "label": "Farmer category", "type": "select",
     "options": ["General", "OBC", "SC", "ST"], "required": True,
     "help": "As per your category certificate."},
    {"name": "has_kcc", "label": "Do you have a Kisan Credit Card?",
     "type": "checkbox", "checkbox_label": "Yes"},
    {"name": "irrigation_type", "label": "Irrigation source", "type": "text"},
    {"name": "annual_income", "label": "Annual income (₹)", "type": "number", "min": 0},
]
```

Supported types: `text` (default), `select`, `number`, `checkbox`.
Each field is posted under its own `name` and validated via `errors[name]`.

---

## 7. Advisory result contract (`advisory_result.html`)

`query`: `id, crop_name, growth_stage, soil_type, symptoms, irrigation, weather, created_at`

`advisory`:

| Key | Type | Purpose |
|---|---|---|
| `title` | str | headline of the recommendation block |
| `recommendation` | str **or** list | guidance (list renders as bullets) |
| `summary` | str | fallback if `recommendation` is absent |
| `rule_name` | str | e.g. `RULE-NITRO-01` (shown as a chip) |
| `explanation` | str | why the rule fired |
| `matched_conditions` | list[str] | reported values that satisfied the rule |
| `next_steps` | list[str] | ordered actions |
| `caution` | str | caution block (template has a safe default) |
| `severity` | str | optional badge, e.g. "Monitor closely" — **not** a percentage |
| `no_match` | bool | renders the "no rule matched" panel instead of a guess |

`related_rules` (optional): list of `{name, summary}` shown in the sidebar.

> Do **not** return a confidence score and do not claim AI/ML — the UI explicitly says
> the engine is rule-based.

---

## 8. Scheme record contract (`partials/scheme_card.html`)

| Key | Type | Notes |
|---|---|---|
| `name`, `description` | str | required |
| `level`, `category` | str | e.g. `Central`, `Income support` |
| `geo_applicability` **or** `states` | str / list | geographic applicability |
| `eligibility_status` | str | `potential_match` \| `check_conditions` \| `verification_required` |
| `eligibility_note` | str | cautious sentence (template has a default) |
| `match_score` | int 0–100 | optional; renders the 5-bar "match strength" meter |
| `why_matched` | list[str] | reasons |
| `conditions_to_verify` | list[str] | what the farmer must confirm |
| `documents_required` | list[str] | documents |
| `application_instructions` | str | how to apply |
| `official_url` | str | optional; the card shows "No official link stored" when empty |

Never generate scheme names, benefit amounts, deadlines or URLs in the backend —
only render rows that exist in the configured scheme database.

---

## 9. Backend changes needed (checklist)

1. **Routes** — add every route in §1 with those endpoint names (or apply the §2 mapping).
2. **CSRF** — enable protection and expose `csrf_token()` to Jinja:

   ```python
   from flask_wtf.csrf import CSRFProtect
   CSRFProtect(app)          # provides {{ csrf_token() }}
   ```
   Templates already contain `{% if csrf_token %}<input type="hidden" …>{% endif %}`,
   so they work whether or not CSRF is configured.
3. **Flash messages** — call `flash(..., "success" | "danger" | "warning" | "info")`.
   `partials/flash_messages.html` normalises `error` → `danger`.
4. **Validation errors** — on failure re-render the same template with
   `errors={field: message}` and `form_data=request.form` **minus passwords**.
   Add `is-invalid` handling is already done in the templates via `errors.<field>`.
5. **Auth** — Flask-Login's `current_user` drops straight in. Protect
   `dashboard`, `profile`, `create_listing`, `edit_listing`, `delete_listing` with
   `@login_required`; return 403/redirect when a user tries to edit someone else's listing.
6. **Pagination** — the marketplace expects an object with
   `page, pages, total, has_prev, has_next, prev_num, next_num`
   (Flask-SQLAlchemy's `query.paginate(...)` matches; pass `listings=pagination.items`).
7. **`is_owner`** — compute it per listing so the Edit/Delete controls appear only for
   the owner.
8. **Advisory storage** — add an `advisory_queries` table (see `preview_app.py` schema)
   if you want `recent_advisories` and revisit-able results; otherwise pass
   `history_enabled=False` and skip the history card.
9. **Scheme table** — store `documents / conditions` as JSON (or a related table) and map
   them to the §8 keys in the view.
10. **Error handlers** — register `404.html` and `500.html`:

    ```python
    @app.errorhandler(404)
    def not_found(e): return render_template("404.html"), 404
    @app.errorhandler(500)
    def server_error(e): return render_template("500.html"), 500
    ```
11. **Static assets** — keep `static/` as-is; if you already have a `static/` folder,
    merge `css/style.css`, `js/main.js`, `vendor/` and `images/` into it.
12. **Security** — never log or template `password_hash`; keep `SECRET_KEY` out of the
    repository; the templates never display credentials.

---

## 10. Minimal view examples

```python
@app.route("/marketplace")
def marketplace():
    f = {k: request.args.get(k, "") for k in
         ("q", "state", "district", "min_price", "max_price", "sort", "mine")}
    page = request.args.get("page", 1, type=int) or 1
    q = Listing.query.filter_by(status="available")
    if f["q"]:
        q = q.filter(Listing.crop_name.contains(f["q"]))
    pagination = q.order_by(Listing.id.desc()).paginate(page=page, per_page=9)
    items = [{**row_to_dict(l), "is_owner": current_user.is_authenticated
              and l.user_id == current_user.id} for l in pagination.items]
    return render_template("marketplace.html", listings=items, filters=f,
                           result_count=pagination.total, pagination=pagination,
                           states=STATES, districts=DISTRICTS, crops=CROPS)


@app.route("/crop-advisory", methods=["GET", "POST"])
def crop_advisory():
    if request.method == "POST":
        data = {k: request.form.get(k, "").strip() for k in
                ("crop_name", "growth_stage", "soil_type", "symptoms",
                 "irrigation", "weather")}
        errors = {k: "This field is required." for k, v in data.items() if not v}
        if errors:
            return render_template("crop_advisory.html", errors=errors,
                                   form_data=data), 400
        query_id = save_query_and_run_rules(data)   # your rule engine
        return redirect(url_for("advisory_result", query_id=query_id))
    return render_template("crop_advisory.html")
```
