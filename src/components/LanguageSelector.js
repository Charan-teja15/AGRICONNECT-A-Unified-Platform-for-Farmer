/**
 * ============================================================================
 * AGRICONNECT — LanguageSelector Component
 * src/components/LanguageSelector.js
 * ============================================================================
 * Handles multilingual language selection, fetches preferred_language from
 * Supabase profile or local storage, renders a Bootstrap dropdown with native
 * language names, and updates the global UI state immediately on change.
 * ============================================================================
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' }
];

export class LanguageSelector {
  /**
   * @param {HTMLElement|string} target - Parent element or selector to render into
   * @param {Object} options - Configuration options
   */
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    this.options = Object.assign({
      onLanguageChange: null,
      autoSyncSupabase: true,
      className: ''
    }, options);

    this.currentLang = this.getInitialLanguage();
    this.init();
  }

  /**
   * Detect initial language preference from URL -> Local Storage -> Cookie -> Fallback
   */
  getInitialLanguage() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const langParam = urlParams.get('lang');
      if (langParam && SUPPORTED_LANGUAGES.some(l => l.code === langParam)) {
        return langParam;
      }
    } catch (e) {}

    const stored = localStorage.getItem('ag_lang');
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
      return stored;
    }

    const match = document.cookie.match(/(?:^|; )ag_lang=([^;]*)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      if (SUPPORTED_LANGUAGES.some(l => l.code === decoded)) {
        return decoded;
      }
    }

    return window.AG_CURRENT_LANG || 'en';
  }

  /**
   * Initialize component, fetch Supabase profile preference, and render
   */
  async init() {
    if (this.target) {
      this.render();
    }

    if (this.options.autoSyncSupabase && window.AgriSupabase) {
      await this.fetchSupabasePreference();
    }
  }

  /**
   * Fetch preferred_language from user's Supabase profile
   */
  async fetchSupabasePreference() {
    try {
      if (!window.AgriSupabase || !window.AgriSupabase.isConfigured()) return;
      const user = await window.AgriSupabase.getUser();
      if (!user) return;

      const client = window.AgriSupabase.getClient ? window.AgriSupabase.getClient() : null;
      if (!client) return;

      const { data, error } = await client
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .single();

      if (!error && data && data.preferred_language) {
        const pref = data.preferred_language;
        if (SUPPORTED_LANGUAGES.some(l => l.code === pref) && pref !== this.currentLang) {
          this.setLanguage(pref, false); // Update state without triggering infinite profile updates
        }
      }
    } catch (err) {
      console.warn('LanguageSelector: Supabase profile language fetch notice:', err);
    }
  }

  /**
   * Render Bootstrap language dropdown HTML
   */
  render() {
    if (!this.target) return;

    const currentObj = SUPPORTED_LANGUAGES.find(l => l.code === this.currentLang) || SUPPORTED_LANGUAGES[0];

    const container = document.createElement('div');
    container.className = `dropdown me-lg-2 my-2 my-lg-0 agriconnect-lang-component ${this.options.className}`.trim();

    const itemsHtml = SUPPORTED_LANGUAGES.map(lang => {
      const isActive = lang.code === this.currentLang;
      return `
        <li>
          <button type="button" 
                  class="dropdown-item d-flex align-items-center justify-content-between py-2 lang-option-btn ${isActive ? 'active fw-bold' : ''}" 
                  data-lang-code="${lang.code}">
            <span>${lang.nativeName}</span>
            <small class="text-muted ms-2">(${lang.name})</small>
          </button>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <button class="btn btn-ag-light btn-sm dropdown-toggle d-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
              type="button" 
              data-bs-toggle="dropdown" 
              aria-expanded="false"
              style="border-radius:20px; font-size:0.875rem; border:1px solid var(--ag-border);">
        <i class="bi bi-globe text-success" aria-hidden="true"></i>
        <span class="current-lang-label">${currentObj.nativeName}</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-1">
        ${itemsHtml}
      </ul>
    `;

    // Attach event listeners
    const buttons = container.querySelectorAll('.lang-option-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const langCode = btn.getAttribute('data-lang-code');
        this.setLanguage(langCode, true);
      });
    });

    this.target.innerHTML = '';
    this.target.appendChild(container);
  }

  /**
   * Set language, update global UI state immediately, and persist preferences
   * @param {string} langCode - Language code (e.g. 'te', 'hi')
   * @param {boolean} updateProfile - Whether to sync preference with Supabase / server
   */
  async setLanguage(langCode, updateProfile = true) {
    if (!SUPPORTED_LANGUAGES.some(l => l.code === langCode)) return;

    this.currentLang = langCode;

    // 1. Update localStorage & Cookies
    try {
      localStorage.setItem('ag_lang', langCode);
      document.cookie = `ag_lang=${encodeURIComponent(langCode)}; path=/; max-age=31536000`;
      document.documentElement.setAttribute('lang', langCode);
    } catch (e) {}

    // 2. Immediate Client-Side Page Translation
    if (typeof window.translatePage === 'function') {
      window.translatePage(langCode);
    }

    // 3. Update rendered component UI dropdown
    this.render();

    // 4. Trigger custom callback if provided
    if (typeof this.options.onLanguageChange === 'function') {
      this.options.onLanguageChange(langCode);
    }

    if (updateProfile) {
      // 5. Sync with Supabase profile if user is authenticated
      if (window.AgriSupabase && window.AgriSupabase.isConfigured()) {
        try {
          const user = await window.AgriSupabase.getUser();
          if (user) {
            const client = window.AgriSupabase.getClient ? window.AgriSupabase.getClient() : null;
            if (client) {
              await client
                .from('profiles')
                .update({ preferred_language: langCode })
                .eq('id', user.id);
            }
          }
        } catch (err) {
          console.warn('LanguageSelector: Supabase profile language update notice:', err);
        }
      }

      // 6. Sync with Server Endpoint
      fetch('/api/user/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: langCode })
      }).catch(err => console.warn('LanguageSelector: Server sync notice:', err));

      // 7. Update URL search parameter & reload for full server-side template re-rendering
      if (window.switchLanguage) {
        window.switchLanguage(langCode);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', langCode);
        window.location.href = url.toString();
      }
    }
  }

  /**
   * Static helper to automatically mount LanguageSelector into container elements
   */
  static mount(target, options = {}) {
    return new LanguageSelector(target, options);
  }
}

// Global window binding for non-ES-module browser environments
if (typeof window !== 'undefined') {
  window.LanguageSelector = LanguageSelector;
  window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
}

export default LanguageSelector;
