// ============================================================================
// AGRICONNECT — Client-side Internationalization (i18n) Engine
// Handles instant DOM translations, language switching, local storage & API sync
// ============================================================================

(function() {
  // Global translation dictionaries passed from server or embedded
  if (!window.AG_TRANSLATIONS) {
    window.AG_TRANSLATIONS = {};
  }

  // Active language getter (checks URL param -> localStorage -> cookie -> server default)
  window.agGetLang = function() {
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var langParam = urlParams.get('lang');
      if (langParam) return langParam;
    } catch (e) {}

    var stored = localStorage.getItem('ag_lang');
    if (stored) return stored;

    var match = document.cookie.match(/(?:^|; )ag_lang=([^;]*)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    return window.AG_CURRENT_LANG || 'en';
  };

  // Translate key helper
  window.t = function(key, fallback) {
    var lang = window.agGetLang();
    var dict = window.AG_TRANSLATIONS[lang] || window.AG_TRANSLATIONS['en'] || {};
    if (dict[key]) return dict[key];
    var enDict = window.AG_TRANSLATIONS['en'] || {};
    return enDict[key] || fallback || key;
  };

  // Apply translations to all DOM elements with data-i18n attributes
  window.translatePage = function(lang) {
    if (!lang) lang = window.agGetLang();

    try {
      localStorage.setItem('ag_lang', lang);
      document.cookie = 'ag_lang=' + encodeURIComponent(lang) + '; path=/; max-age=31536000';
      document.documentElement.setAttribute('lang', lang);
    } catch(e) {}

    var dict = window.AG_TRANSLATIONS[lang] || window.AG_TRANSLATIONS['en'] || {};

    // 1. Text content elements
    var elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (key && dict[key]) {
        el.textContent = dict[key];
      }
    });

    // 2. Input/Textarea Placeholders
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key && dict[key]) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    // 3. Titles and Aria labels
    var titles = document.querySelectorAll('[data-i18n-title]');
    titles.forEach(function(el) {
      var key = el.getAttribute('data-i18n-title');
      if (key && dict[key]) {
        el.setAttribute('title', dict[key]);
        el.setAttribute('aria-label', dict[key]);
      }
    });

    // 4. Form Option elements if tagged
    var options = document.querySelectorAll('option[data-i18n]');
    options.forEach(function(opt) {
      var key = opt.getAttribute('data-i18n');
      if (key && dict[key]) {
        opt.textContent = dict[key];
      }
    });

    // 5. Update active language display in navbar
    var langDisplay = document.getElementById('currentLangName');
    var langMap = {
      'en': 'English',
      'te': 'తెలుగు',
      'hi': 'हिन्दी',
      'ta': 'தமிழ்',
      'kn': 'ಕನ್ನಡ',
      'ml': 'മലയാളം',
      'mr': 'मराठी'
    };
    if (langDisplay && langMap[lang]) {
      langDisplay.textContent = langMap[lang];
    }

    // 6. Update active highlight on dropdown items
    var dropItems = document.querySelectorAll('.lang-select-btn');
    dropItems.forEach(function(item) {
      var code = item.getAttribute('data-lang-code');
      if (code === lang) {
        item.classList.add('active', 'fw-bold');
      } else {
        item.classList.remove('active', 'fw-bold');
      }
    });
  };

  // Switch language function (invoked from navbar language dropdown)
  window.switchLanguage = function(langCode) {
    if (!langCode) return;

    // Instantly translate page elements client-side
    window.translatePage(langCode);

    // Synchronize preference with server API in background
    fetch('/api/user/language', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lang: langCode })
    }).catch(function(err) {
      console.warn('Language preference sync notice:', err);
    });

    // Navigate to URL with updated lang query param so server templates re-render
    var url = new URL(window.location.href);
    url.searchParams.set('lang', langCode);
    window.location.href = url.toString();
  };

  // Voice input speech recognition helper
  window.startVoiceSearch = function(targetId) {
    var targetInput = document.getElementById(targetId);
    if (!targetInput) return;

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice speech recognition is not supported by your browser. Please type your query in text.');
      return;
    }

    var recognition = new SpeechRecognition();
    var langMap = {
      'en': 'en-IN',
      'te': 'te-IN',
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'mr': 'mr-IN'
    };
    var currentLang = window.agGetLang();
    recognition.lang = langMap[currentLang] || 'en-IN';
    recognition.interimResults = false;

    var voiceBtn = document.getElementById('voiceSearchBtn');
    if (voiceBtn) voiceBtn.classList.add('btn-danger', 'animate-pulse');

    recognition.onresult = function(event) {
      if (event.results && event.results[0] && event.results[0][0]) {
        targetInput.value = event.results[0][0].transcript;
        if (targetInput.form) targetInput.form.submit();
      }
    };

    recognition.onerror = function(err) {
      console.warn('Voice speech recognition notice:', err);
      if (voiceBtn) voiceBtn.classList.remove('btn-danger', 'animate-pulse');
    };

    recognition.onend = function() {
      if (voiceBtn) voiceBtn.classList.remove('btn-danger', 'animate-pulse');
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start error:', e);
    }
  };

  // On DOM ready, verify language preference
  document.addEventListener('DOMContentLoaded', function() {
    var activeLang = window.agGetLang();
    window.translatePage(activeLang);
  });
})();
