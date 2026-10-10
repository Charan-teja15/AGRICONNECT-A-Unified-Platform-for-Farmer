# Verification checklist — AGRICONNECT frontend

Work through this once the templates are connected to the real Flask backend.
Tick each box; anything unticked is a defect to fix before the expo/viva.
Run the same checks at 360 px, 768 px and 1440 px widths.

---

## A. Global / layout

- [ ] Every page extends `base.html` (no duplicated `<html>`, nav or footer).
- [ ] Bootstrap CSS, Bootstrap Icons CSS and `static/css/style.css` load (no 404s in DevTools → Network).
- [ ] `main.js` and the Bootstrap bundle load; no console errors on any page.
- [ ] Navbar is sticky, collapses into a hamburger below 992 px, and closes after a tap.
- [ ] Active nav item is highlighted for the section you are in.
- [ ] Footer shows project name, short description, service links, account links and the disclaimer.
- [ ] "Skip to main content" link is the first tab stop.
- [ ] No horizontal scrolling on any page at 360 px.
- [ ] Tab order is logical; focus ring is visible on every interactive element.
- [ ] Page title and meta description differ per page.

## B. Landing page (`index.html`)

- [ ] Hero headline reads "One Platform. Three Powerful Solutions for Farmers."
- [ ] Three hero buttons go to Marketplace / Crop Advisory / Subsidy Checker.
- [ ] Hero image loads; if deleted, the SVG fallback appears (no broken-image icon).
- [ ] Three service cards render with icon, description and working button.
- [ ] "How it works" shows the three steps.
- [ ] "Why AGRICONNECT" shows the four benefit cards.
- [ ] Optional `public_stats` counters render only when the backend supplies them (no fake numbers).
- [ ] Optional `featured_listings` section appears only when data exists.
- [ ] CTA button shows "Go to Dashboard" when logged in, "Create Farmer Profile" when not.

## C. Authentication

### `login.html`
- [ ] Fields: email-or-username, password, remember-me (only if supported), submit.
- [ ] Show/hide password toggles the field type and the eye icon; focus is retained.
- [ ] Wrong credentials → flash/alert shown, email preserved, **password cleared**.
- [ ] `?next=` sends the user back to the page they requested.
- [ ] "Create a farmer profile" link goes to `/register`.
- [ ] Demo hint is hidden once `demo_mode` is not set.

### `register.html`
- [ ] All fields labelled, placeholders helpful, required fields marked.
- [ ] Password strength meter updates as you type.
- [ ] Mismatched passwords are blocked client-side **and** rejected by the server.
- [ ] Server-side errors: every invalid field shows a message, non-sensitive values
      (name, email, phone, state, district, land size, crop) are preserved, and
      **both password fields are empty**.
- [ ] Duplicate email is reported next to the email field.
- [ ] Successful registration logs the user in and lands on the dashboard.

## D. Dashboard (`dashboard.html`)

- [ ] Header shows "Welcome back, {name}!" and today's date.
- [ ] Four summary cards show backend values (`stats.*`), not hardcoded numbers.
- [ ] Quick-action cards (Add listing / Browse marketplace / Crop advisory / Schemes) all navigate.
- [ ] Recent listings show real rows with working Edit and Delete buttons.
- [ ] Recent advisory activity renders when history exists; otherwise the friendly empty state appears.
- [ ] Recommended next steps and shortcuts all link somewhere real.
- [ ] New user (no data) sees the dashed full empty state with an action button.
- [ ] Logout works from the sidebar and the navbar menu.

## E. Marketplace

### `marketplace.html`
- [ ] Title "Farmer Marketplace" and subtitle render.
- [ ] Search by crop name, state, district, min/max price and sort all affect results
      (server-side, via query string).
- [ ] "Search" submits; "Clear Filters" empties the form and reloads the full list.
- [ ] Sort dropdown auto-submits and keeps the other filters.
- [ ] Result count matches the number of cards (and pagination total).
- [ ] Cards show crop, quantity + unit, price, location, availability date, description, farmer.
- [ ] "View Details" opens the modal with all fields; "Contact Farmer" uses `tel:`/`mailto:`
      when contact information exists, and is hidden when it does not.
- [ ] `{% for %}…{% else %}` empty state shows when nothing matches.
- [ ] Pagination links preserve the filters and disable at the first/last page.
- [ ] "Show only my listings" (logged in) filters correctly.

### `create_listing.html`
- [ ] All nine fields present; label + placeholder + help text for each.
- [ ] Availability date cannot be set in the past (JS sets `min`; server must re-check).
- [ ] Description character counter counts up to 500 and warns near the limit.
- [ ] Validation errors appear per field; entered values are preserved.
- [ ] Publishing redirects to the listing and a success flash appears.

### `edit_listing.html`
- [ ] Every field is pre-filled from the existing listing.
- [ ] Status dropdown updates availability.
- [ ] "Save Changes" persists; "Cancel" leaves without saving.
- [ ] "Delete Listing" opens the confirmation modal; confirming deletes, cancelling does not.
- [ ] Editing someone else's listing is refused by the server (403/redirect + flash).

## F. Crop advisory

### `crop_advisory.html`
- [ ] Fields: crop name, growth stage, soil type, symptoms, irrigation, weather.
- [ ] Dropdowns are populated from backend lists; symptoms textarea has a counter and an example.
- [ ] Submit button reads "Get Crop Guidance" and posts to the backend (no client-side faking).
- [ ] Server-side errors are displayed per field; entered values preserved.

### `advisory_result.html`
- [ ] Shows the selected crop and growth stage, and the reported symptoms.
- [ ] Recommendation, "why the rule matched", rule name and matched conditions render.
- [ ] Recommended next steps render as a numbered list.
- [ ] Caution block is always present.
- [ ] "Submit another query" and "Back to dashboard" both work.
- [ ] **No** confidence percentage and **no** AI/ML claim anywhere on the page.
- [ ] When no rule matches, the "no rule matched" panel shows instead of invented advice.
- [ ] Print/Save produces a clean, readable page.

## G. Subsidy awareness

### `subsidy_checker.html`
- [ ] Fields: state, district, land size, landholding category, crop type (+ dynamic extras).
- [ ] Dropdowns populated from the backend; numeric inputs use `inputmode`.
- [ ] "Check My Eligibility" posts to the backend.
- [ ] Validation errors appear per field; values preserved.

### `subsidy_results.html`
- [ ] Each scheme renders in its own card with name, description, geography, status badge,
      why it matched, conditions to verify, documents and application instructions.
- [ ] Status badges are limited to "Potential Match", "Check Additional Conditions",
      "Official Verification Required".
- [ ] Official links open in a new tab with `rel="noopener noreferrer"`; empty URLs show the
      "No official link stored" badge instead of a dead link.
- [ ] Preliminary-results disclaimer is visible above the list.
- [ ] Empty state appears (with Try Again / Dashboard) when nothing matches.
- [ ] **No** invented benefit amounts, deadlines or URLs.

## H. Profile (`profile.html`)

- [ ] View mode shows all fields for the logged-in user.
- [ ] "Edit Profile" switches to edit mode (`?edit=1`) with values pre-filled.
- [ ] "Save Changes" updates the record and flashes a success message.
- [ ] "Cancel" returns to view mode without saving.
- [ ] Validation errors show per field; values preserved.

## I. Shared components

- [ ] `partials/navbar.html` — responsive, active states, auth-aware.
- [ ] `partials/footer.html` — links + disclaimer on every page.
- [ ] `partials/flash_messages.html` — success/danger/warning/info styling, dismissible,
      auto-dismiss for success/info.
- [ ] `partials/crop_card.html` — used by both marketplace and homepage; image fallback works.
- [ ] `partials/scheme_card.html` — renders every documented field.
- [ ] `partials/empty_state.html` — used by dashboard, marketplace, advisory, subsidy.
- [ ] Confirmation modal (`#agConfirmModal` in `base.html`) is used by all delete actions.
- [ ] Pagination renders only when there is more than one page.
- [ ] Button loading spinner appears on submit (`AG.withLoading` available for future async work).

## J. Error pages

- [ ] `404.html` renders for an unknown URL with useful navigation links.
- [ ] `500.html` renders for a server error (test with `abort(500)`), with no stack trace
      and no secret values.

## K. Accessibility, performance and honesty pass

- [ ] Every input has a `<label for>`; required fields marked and announced.
- [ ] Error text is associated with the field (`aria-describedby`) and not colour-only.
- [ ] All images have `alt`; decorative icons are `aria-hidden`.
- [ ] Contrast passes AA for body text, muted text and buttons.
- [ ] Zoom to 200 % keeps the layout usable.
- [ ] `prefers-reduced-motion: reduce` disables animations (OS setting test).
- [ ] Images are lazy-loaded below the fold; total page weight is reasonable.
- [ ] No button, link or tab does nothing.
- [ ] No hardcoded data where backend data is expected.
- [ ] No fake payments, fake confidence scores, or fake scheme values.
