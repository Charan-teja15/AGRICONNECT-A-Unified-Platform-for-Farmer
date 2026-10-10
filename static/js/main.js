/* ==========================================================================
   AGRICONNECT — static/js/main.js
   Progressive enhancement only. All validation here is a convenience:
   the Flask backend must always re-validate every input.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- helpers */
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, evt, fn) { if (el) { el.addEventListener(evt, fn, false); } }

  /* ==============================================================
     1. Bootstrap component wiring (guarded: works if bundle is absent)
     ============================================================== */
  function initBootstrap() {
    if (typeof window.bootstrap === "undefined") { return; }
    if (window.bootstrap.Tooltip) {
      $$('[data-bs-toggle="tooltip"]').forEach(function (el) { new window.bootstrap.Tooltip(el); });
    }
    if (window.bootstrap.Popover) {
      $$('[data-bs-toggle="popover"]').forEach(function (el) { new window.bootstrap.Popover(el); });
    }
  }

  /* ==============================================================
     2. Show / hide password  —  [data-ag-toggle-password="#id"]
     ============================================================== */
  function initPasswordToggles() {
    $$("[data-ag-toggle-password]").forEach(function (btn) {
      var target = doc.getElementById(btn.getAttribute("data-ag-toggle-password"));
      if (!target) { return; }
      var icon = btn.querySelector("i");
      btn.setAttribute("aria-pressed", "false");
      on(btn, "click", function () {
        var show = target.type === "password";
        target.type = show ? "text" : "password";
        if (icon) {
          icon.classList.toggle("bi-eye", !show);
          icon.classList.toggle("bi-eye-slash", show);
        }
        btn.setAttribute("aria-pressed", show ? "true" : "false");
        btn.setAttribute("title", show ? "Hide password" : "Show password");
        target.focus();
      });
    });
  }

  /* ==============================================================
     3. Password strength meter (registration / profile)
     ============================================================== */
  function scorePassword(v) {
    var score = 0;
    if (v.length >= 8) { score += 1; }
    if (v.length >= 12) { score += 1; }
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) { score += 1; }
    if (/\d/.test(v)) { score += 1; }
    if (/[^A-Za-z0-9]/.test(v)) { score += 1; }
    return Math.min(score, 4);
  }

  function initPasswordStrength() {
    $$("[data-ag-strength-target]").forEach(function (input) {
      var wrap = doc.getElementById(input.getAttribute("data-ag-strength-target"));
      if (!wrap) { return; }
      var bar = wrap.querySelector("[data-ag-strength-bar]");
      var label = wrap.querySelector("[data-ag-strength-label]");
      var states = ["Too short", "Weak", "Fair", "Good", "Strong"];
      var colors = ["#C0392B", "#C0392B", "#F9A825", "#2E7D32", "#1B5E20"];
      on(input, "input", function () {
        var s = input.value ? scorePassword(input.value) : 0;
        if (bar) {
          bar.style.width = (s * 25) + "%";
          bar.style.background = colors[s];
        }
        if (label) {
          label.textContent = input.value ? states[s] : "";
          label.setAttribute("aria-live", "polite");
        }
      });
    });
  }

  /* ==============================================================
     4. Password confirmation matching
     ============================================================== */
  function initPasswordMatch() {
    $$("form[data-ag-check-password-match]").forEach(function (form) {
      var p1 = form.querySelector("[data-ag-password]");
      var p2 = form.querySelector("[data-ag-password-confirm]");
      if (!p1 || !p2) { return; }
      function check() {
        if (!p2.value) { p2.setCustomValidity(""); return; }
        p2.setCustomValidity(p1.value === p2.value ? "" : "Passwords do not match.");
        p2.classList.toggle("is-invalid", p1.value !== p2.value && p2.value.length > 0);
      }
      on(p2, "input", check);
      on(p1, "input", check);
      on(form, "submit", check);
    });
  }

  /* ==============================================================
     5. Character counters  —  textarea[maxlength][data-ag-counter="#id"]
     ============================================================== */
  function initCounters() {
    $$("[data-ag-counter]").forEach(function (field) {
      var out = doc.getElementById(field.getAttribute("data-ag-counter"));
      if (!out) { return; }
      var max = parseInt(field.getAttribute("maxlength") || "0", 10);
      function update() {
        var len = field.value.length;
        out.textContent = max ? (len + " / " + max + " characters") : (len + " characters");
        if (max && len > max * 0.9) { out.classList.add("text-danger"); }
        else { out.classList.remove("text-danger"); }
      }
      on(field, "input", update);
      update();
    });
  }

  /* ==============================================================
     6. Clear field errors as soon as the user edits the field
     ============================================================== */
  function initErrorClearing() {
    $$(".is-invalid").forEach(function (el) {
      on(el, "input", function () {
        el.classList.remove("is-invalid");
        el.removeAttribute("aria-invalid");
        var group = el.closest(".mb-3, .col-md-6, .col-12, .form-group");
        if (group) {
          $$(".ag-field-error", group).forEach(function (e) { e.remove(); });
          var fb = $(".invalid-feedback", group);
          if (fb && fb.hasAttribute("data-ag-server-error")) { fb.remove(); }
        }
      });
      on(el, "change", function () { el.classList.remove("is-invalid"); });
    });
  }

  /* ==============================================================
     7. Client-side required validation (convenience only)
     ============================================================== */
  function initClientValidation() {
    $$("form[data-ag-validate]").forEach(function (form) {
      on(form, "submit", function (ev) {
        // Let the browser's native constraint API do the work.
        if (typeof form.reportValidity === "function" && !form.reportValidity()) {
          ev.preventDefault();
          var firstBad = form.querySelector(":invalid");
          if (firstBad && firstBad.focus) { firstBad.focus(); }
          return;
        }
        if (form.hasAttribute("data-ag-check-password-match")) {
          var p1 = form.querySelector("[data-ag-password]");
          var p2 = form.querySelector("[data-ag-password-confirm]");
          if (p1 && p2 && p1.value !== p2.value) {
            ev.preventDefault();
            p2.classList.add("is-invalid");
            p2.focus();
            return;
          }
        }
        // Loading state on the submit button
        var btn = form.querySelector('[type="submit"], button[data-ag-submit]');
        if (btn && !btn.classList.contains("is-loading")) {
          btn.classList.add("is-loading");
          btn.setAttribute("aria-busy", "true");
          // Safety net: if navigation never happens (e.g. server error), release.
          window.setTimeout(function () {
            btn.classList.remove("is-loading");
            btn.removeAttribute("aria-busy");
          }, 12000);
        }
      });
    });
  }

  /* ==============================================================
     8. Confirmation dialogs
        a) [data-ag-confirm]           -> native confirm() (simple actions)
        b) [data-ag-confirm-modal]     -> Bootstrap modal (#agConfirmModal)
     ============================================================== */
  var pendingForm = null;

  function initConfirmations() {
    var modalEl = doc.getElementById("agConfirmModal");
    var modal = (modalEl && window.bootstrap && window.bootstrap.Modal) ? new window.bootstrap.Modal(modalEl) : null;
    var titleEl = modalEl ? modalEl.querySelector("[data-ag-modal-title]") : null;
    var bodyEl = modalEl ? modalEl.querySelector("[data-ag-modal-body]") : null;
    var okBtn = modalEl ? modalEl.querySelector("[data-ag-modal-confirm]") : null;

    $$("[data-ag-confirm-modal]").forEach(function (trigger) {
      on(trigger, "click", function (ev) {
        ev.preventDefault();
        var form = trigger.closest("form");
        var title = trigger.getAttribute("data-ag-modal-title-text") || "Are you sure?";
        var body = trigger.getAttribute("data-ag-confirm-modal") || "This action cannot be undone.";

        if (!modal) { if (window.confirm(body)) { if (form) { form.submit(); } } return; }

        pendingForm = form;
        if (titleEl) { titleEl.textContent = title; }
        if (bodyEl) { bodyEl.textContent = body; }
        if (okBtn) {
          okBtn.textContent = trigger.getAttribute("data-ag-modal-ok") || "Yes, continue";
          okBtn.className = "btn " + (trigger.getAttribute("data-ag-modal-ok-class") || "btn-ag-primary");
        }
        modal.show();
      });
    });

    if (okBtn) {
      on(okBtn, "click", function () {
        if (pendingForm) {
          if (okBtn && !okBtn.classList.contains("is-loading")) { okBtn.classList.add("is-loading"); }
          // If it is a real <form>, submit it; otherwise follow the stored link.
          if (pendingForm.tagName === "FORM") { pendingForm.submit(); }
          else if (pendingForm.getAttribute("href")) { window.location.href = pendingForm.getAttribute("href"); }
        }
      });
    }
    if (modalEl) {
      on(modalEl, "hidden.bs.modal", function () { pendingForm = null; });
    }

    // Simple native confirmation for non-form actions (links).
    $$("[data-ag-confirm]").forEach(function (el) {
      on(el, "click", function (ev) {
        if (!window.confirm(el.getAttribute("data-ag-confirm"))) { ev.preventDefault(); }
      });
    });
  }

  /* ==============================================================
     9. Flash messages: auto-dismiss + dismiss animation
     ============================================================== */
  function initFlash() {
    $$("[data-ag-autodismiss]").forEach(function (alertEl) {
      var delay = parseInt(alertEl.getAttribute("data-ag-autodismiss"), 10) || 6000;
      window.setTimeout(function () { dismissAlert(alertEl); }, delay);
    });
  }

  function dismissAlert(alertEl) {
    var bsAlert = (window.bootstrap && window.bootstrap.Alert) ? window.bootstrap.Alert.getOrCreateInstance(alertEl) : null;
    if (bsAlert) { bsAlert.close(); }
    else if (alertEl && alertEl.parentNode) { alertEl.parentNode.removeChild(alertEl); }
  }

  /* ==============================================================
     10. Marketplace filter helpers
     ============================================================== */
  function initFilters() {
    // "Clear filters" -> empty every input inside the form, then submit.
    $$("[data-ag-clear-filters]").forEach(function (btn) {
      on(btn, "click", function (ev) {
        ev.preventDefault();
        var form = doc.getElementById(btn.getAttribute("data-ag-clear-filters"));
        if (!form) { return; }
        $$("input, select, textarea", form).forEach(function (field) {
          if (field.type === "hidden") { return; }           // csrf token etc.
          if (field.tagName === "SELECT") { field.selectedIndex = 0; }
          else { field.value = ""; }
          field.classList.remove("is-invalid");
        });
        form.submit();
      });
    });

    // Auto-submit when an "auto" control changes (sort dropdown).
    $$("[data-ag-autosubmit]").forEach(function (el) {
      on(el, "change", function () {
        var form = el.closest("form");
        if (form) { form.submit(); }
      });
    });

    // Remember whether the filter panel was open on mobile (session storage).
    var filterCollapse = doc.getElementById("filterPanel");
    if (filterCollapse && window.sessionStorage) {
      on(filterCollapse, "shown.bs.collapse", function () { window.sessionStorage.setItem("agFilters", "open"); });
      on(filterCollapse, "hidden.bs.collapse", function () { window.sessionStorage.setItem("agFilters", "closed"); });
    }
  }

  /* ==============================================================
     11. Remote image fallback  —  img[data-ag-fallback]
         If the remote image fails, hide it and reveal the local placeholder.
     ============================================================== */
  function initImageFallbacks() {
    $$("img[data-ag-fallback]").forEach(function (img) {
      function fail() {
        img.style.display = "none";
        var fb = img.parentNode ? img.parentNode.querySelector("[data-ag-fallback-target]") : null;
        if (fb) { fb.classList.remove("d-none"); }
      }
      if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) { fail(); }
      on(img, "error", fail);
    });
  }

  /* ==============================================================
     12. Dates: set today as the earliest allowed availability date
     ============================================================== */
  function initDates() {
    $$("[data-ag-min-today]").forEach(function (input) {
      var d = new Date();
      var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      input.min = iso;
    });
  }

  /* ==============================================================
     13. Reveal-on-scroll (skipped when reduced motion is requested)
     ============================================================== */
  function initReveal() {
    var items = $$(".reveal");
    if (!items.length) { return; }
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("reveal-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ==============================================================
     14. Navbar: shadow on scroll + close mobile menu after navigation
     ============================================================== */
  function initNavbar() {
    var nav = $(".navbar-ag");
    if (nav) {
      var onScroll = function () {
        if (window.scrollY > 8) { nav.classList.add("shadow-sm"); }
        else { nav.classList.remove("shadow-sm"); }
      };
      on(window, "scroll", onScroll, { passive: true });
      onScroll();
    }
    var collapseEl = doc.getElementById("mainNavbar");
    if (collapseEl && window.bootstrap && window.bootstrap.Collapse && window.matchMedia("(max-width: 991.98px)").matches) {
      var collapse = window.bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
      $$("a.nav-link, a.dropdown-item", collapseEl).forEach(function (link) {
        on(link, "click", function () { collapse.hide(); });
      });
    }
  }

  /* ==============================================================
     15. Table helpers: make rows keyboard-focusable/clickable when wanted
     ============================================================== */
  function initTables() {
    $$("table[data-ag-responsive-hint]").forEach(function (table) {
      var wrap = table.parentNode;
      if (wrap && wrap.classList.contains("table-responsive")) {
        wrap.setAttribute("tabindex", "0");
        wrap.setAttribute("role", "region");
        wrap.setAttribute("aria-label", table.getAttribute("data-ag-responsive-hint"));
      }
    });
  }

  /* ==============================================================
     16. Public helper for future async (fetch) work
         Usage:  AG.withLoading(buttonEl, promise)
     ============================================================== */
  window.AG = {
    withLoading: function (btn, promise) {
      if (btn) { btn.classList.add("is-loading"); btn.setAttribute("aria-busy", "true"); }
      var done = function () {
        if (btn) { btn.classList.remove("is-loading"); btn.removeAttribute("aria-busy"); }
      };
      if (promise && typeof promise.then === "function") { promise.then(done, done); }
      return promise;
    },
    dismissAlert: dismissAlert,
    reduceMotion: reduceMotion
  };

  /* ==============================================================
     17. Boot
     ============================================================== */
  function boot() {
    initBootstrap();
    initNavbar();
    initPasswordToggles();
    initPasswordStrength();
    initPasswordMatch();
    initCounters();
    initErrorClearing();
    initClientValidation();
    initConfirmations();
    initFlash();
    initFilters();
    initImageFallbacks();
    initDates();
    initTables();
    initReveal();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
