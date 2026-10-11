/**
 * ============================================================================
 * AGRICONNECT — LanguageSelector Component
 * static/js/LanguageSelector.js
 * ============================================================================
 * Handles multilingual language selection, fetches preferred_language from
 * Supabase profile or local storage, renders a Bootstrap dropdown with native
 * language names, and updates the global UI state immediately on change.
 * ============================================================================
 */

(function (window) {
  'use strict';

  var SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' }
  ];

  function LanguageSelector(target, options) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    this.options = Object.assign({
      onLanguageChange: null,
      autoSyncSupabase: true,
      className: ''
    }, options || {});

    this.currentLang = this.getInitialLanguage();
    this.init();
  }

  LanguageSelector.prototype.getInitialLanguage = function () {
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var langParam = urlParams.get('lang');
      if (langParam && SUPPORTED_LANGUAGES.some(function(l) { return l.code === langParam; })) {
        return langParam;
      }
    } catch (e) {}

    var stored = localStorage.getItem('ag_lang');
    if (stored && SUPPORTED_LANGUAGES.some(function(l) { return l.code === stored; })) {
      return stored;
    }

    var match = document.cookie.match(/(?:^|; )ag_lang=([^;]*)/);
    if (match && match[1]) {
      var decoded = decodeURIComponent(match[1]);
      if (SUPPORTED_LANGUAGES.some(function(l) { return l.code === decoded; })) {
        return decoded;
      }
    }

    return window.AG_CURRENT_LANG || 'en';
  };

  LanguageSelector.prototype.init = function () {
    if (this.target) {
      this.render();
    }

    if (this.options.autoSyncSupabase && window.AgriSupabase) {
      this.fetchSupabasePreference();
    }
  };

  LanguageSelector.prototype.fetchSupabasePreference = async function () {
    try {
      if (!window.AgriSupabase || !window.AgriSupabase.isConfigured()) return;
      var user = await window.AgriSupabase.getUser();
      if (!user) return;

      var client = window.AgriSupabase.getClient ? window.AgriSupabase.getClient() : null;
      if (!client) return;

      var res = await client
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .single();

      if (!res.error && res.data && res.data.preferred_language) {
        var pref = res.data.preferred_language;
        if (SUPPORTED_LANGUAGES.some(function(l) { return l.code === pref; }) && pref !== this.currentLang) {
          this.setLanguage(pref, false);
        }
      }
    } catch (err) {
      console.warn('LanguageSelector: Supabase profile language fetch notice:', err);
    }
  };

  LanguageSelector.prototype.render = function () {
    if (!this.target) return;

    var currentLang = this.currentLang;
    var currentObj = SUPPORTED_LANGUAGES.find(function(l) { return l.code === currentLang; }) || SUPPORTED_LANGUAGES[0];

    var container = document.createElement('div');
    container.className = ('dropdown me-lg-2 my-2 my-lg-0 agriconnect-lang-component ' + (this.options.className || '')).trim();

    var itemsHtml = SUPPORTED_LANGUAGES.map(function(lang) {
      var isActive = lang.code === currentLang;
      return '<li>' +
        '<button type="button" class="dropdown-item d-flex align-items-center justify-content-between py-2 lang-option-btn ' + (isActive ? 'active fw-bold' : '') + '" data-lang-code="' + lang.code + '">' +
          '<span>' + lang.nativeName + '</span>' +
          '<small class="text-muted ms-2">(' + lang.name + ')</small>' +
        '</button>' +
      '</li>';
    }).join('');

    container.innerHTML = 
      '<button class="btn btn-ag-light btn-sm dropdown-toggle d-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="border-radius:20px; font-size:0.875rem; border:1px solid var(--ag-border);">' +
        '<i class="bi bi-globe text-success" aria-hidden="true"></i> ' +
        '<span class="current-lang-label">' + currentObj.nativeName + '</span>' +
      '</button>' +
      '<ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-1">' +
        itemsHtml +
      '</ul>';

    var self = this;
    var buttons = container.querySelectorAll('.lang-option-btn');
    buttons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var langCode = btn.getAttribute('data-lang-code');
        self.setLanguage(langCode, true);
      });
    });

    this.target.innerHTML = '';
    this.target.appendChild(container);
  };

  LanguageSelector.prototype.setLanguage = async function (langCode, updateProfile) {
    if (!SUPPORTED_LANGUAGES.some(function(l) { return l.code === langCode; })) return;

    this.currentLang = langCode;

    try {
      localStorage.setItem('ag_lang', langCode);
      document.cookie = 'ag_lang=' + encodeURIComponent(langCode) + '; path=/; max-age=31536000';
      document.documentElement.setAttribute('lang', langCode);
    } catch (e) {}

    if (typeof window.translatePage === 'function') {
      window.translatePage(langCode);
    }

    this.render();

    if (typeof this.options.onLanguageChange === 'function') {
      this.options.onLanguageChange(langCode);
    }

    if (updateProfile) {
      if (window.AgriSupabase && window.AgriSupabase.isConfigured()) {
        try {
          var user = await window.AgriSupabase.getUser();
          if (user) {
            var client = window.AgriSupabase.getClient ? window.AgriSupabase.getClient() : null;
            if (client) {
              await client
                .from('profiles')
                .update({ preferred_language: langCode })
                .eq('id', user.id);
            }
          }
        } catch (err) {
          console.warn('LanguageSelector: Supabase profile update notice:', err);
        }
      }

      fetch('/api/user/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: langCode })
      }).catch(function(err) { console.warn('LanguageSelector: Server sync notice:', err); });

      if (window.switchLanguage) {
        window.switchLanguage(langCode);
      } else {
        var url = new URL(window.location.href);
        url.searchParams.set('lang', langCode);
        window.location.href = url.toString();
      }
    }
  };

  LanguageSelector.mount = function (target, options) {
    return new LanguageSelector(target, options);
  };

  window.LanguageSelector = LanguageSelector;
  window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
})(window);
