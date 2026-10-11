/**
 * ============================================================================
 * AGRICONNECT — Supabase JavaScript Client Integration
 * ============================================================================
 * Enables client-side Supabase Auth, Row-Level Security enforcement,
 * real-time marketplace interaction, and direct advisory querying.
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Config object with environment placeholders or runtime overrides
  const config = {
    url: window.AGRICONNECT_SUPABASE_URL || localStorage.getItem('supabase_url') || '',
    anonKey: window.AGRICONNECT_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '',
  };

  let supabaseClient = null;

  function getClient() {
    if (!supabaseClient && window.supabase && config.url && config.anonKey) {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    }
    return supabaseClient;
  }

  const AgriSupabase = {
    /**
     * Initialize or update Supabase credentials at runtime
     */
    init: function (url, anonKey) {
      config.url = url;
      config.anonKey = anonKey;
      if (url && anonKey) {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_anon_key', anonKey);
      }
      if (window.supabase) {
        supabaseClient = window.supabase.createClient(url, anonKey);
      }
      return supabaseClient;
    },

    isConfigured: function () {
      return Boolean(getClient());
    },

    // ------------------------------------------------------------------------
    // Authentication Functions
    // ------------------------------------------------------------------------

    signUp: async function (email, password, profileData) {
      const client = getClient();
      if (!client) throw new Error('Supabase client is not initialized.');

      const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: profileData.fullName || profileData.full_name,
            phone: profileData.phone || '',
            village: profileData.village || '',
            district: profileData.district || '',
            state: profileData.state || '',
          },
        },
      });

      if (error) throw error;
      return data;
    },

    signIn: async function (email, password) {
      const client = getClient();
      if (!client) throw new Error('Supabase client is not initialized.');

      const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;
      return data;
    },

    signOut: async function () {
      const client = getClient();
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    getUser: async function () {
      const client = getClient();
      if (!client) return null;
      const { data } = await client.auth.getUser();
      return data ? data.user : null;
    },

    // ------------------------------------------------------------------------
    // Marketplace Operations
    // ------------------------------------------------------------------------

    fetchListings: async function (filters) {
      const client = getClient();
      if (!client) return [];

      let query = client
        .from('marketplace_listings')
        .select('*, profiles(full_name, phone)')
        .eq('status', 'active');

      if (filters) {
        if (filters.cropName) query = query.ilike('crop_name', `%${filters.cropName}%`);
        if (filters.category) query = query.eq('category', filters.category);
        if (filters.state) query = query.eq('state', filters.state);
        if (filters.district) query = query.eq('district', filters.district);
        if (filters.minPrice) query = query.gte('price_per_unit', filters.minPrice);
        if (filters.maxPrice) query = query.lte('price_per_unit', filters.maxPrice);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    createListing: async function (listing) {
      const client = getClient();
      if (!client) throw new Error('Supabase client is not initialized.');

      const user = await AgriSupabase.getUser();
      if (!user) throw new Error('Please log in to publish a crop listing.');

      const { data, error } = await client
        .from('marketplace_listings')
        .insert({
          seller_id: user.id,
          crop_name: listing.cropName,
          category: listing.category || 'Grains & Cereals',
          quantity: parseFloat(listing.quantity),
          unit: listing.unit || 'quintal',
          price_per_unit: listing.pricePerUnit ? parseFloat(listing.pricePerUnit) : null,
          state: listing.state,
          district: listing.district,
          description: listing.description || '',
          status: 'active',
        })
        .select();

      if (error) throw error;
      return data[0];
    },

    // ------------------------------------------------------------------------
    // Advisory Rules
    // ------------------------------------------------------------------------

    fetchAdvisoryRules: async function (cropName) {
      const client = getClient();
      if (!client) return [];

      let query = client.from('advisory_rules').select('*').eq('active', true);
      if (cropName) {
        query = query.ilike('crop_name', `%${cropName}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    // ------------------------------------------------------------------------
    // Government Schemes
    // ------------------------------------------------------------------------

    fetchSchemes: async function (state) {
      const client = getClient();
      if (!client) return [];

      let query = client.from('government_schemes').select('*').eq('active', true);
      if (state) {
        query = query.or(`state.eq.All-India,state.ilike.%${state}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  };

  window.AgriSupabase = AgriSupabase;
})(window);
