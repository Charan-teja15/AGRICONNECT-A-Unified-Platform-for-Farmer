import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction } from 'express';
import nunjucks from 'nunjucks';
import cookieSession from 'cookie-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { LANGUAGES, TRANSLATIONS, CROP_ALIASES, translateKey } from './locales.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------------------------------
// String prototype format patch for Python string formatting like '{:,.0f}'.format(...)
// --------------------------------------------------------------------------
(String.prototype as any).format = function (...args: any[]) {
  const num = Number(args[0]);
  if (!isNaN(num)) {
    return Math.round(num).toLocaleString('en-IN');
  }
  return args[0] !== undefined ? String(args[0]) : '';
};

// --------------------------------------------------------------------------
// Reference Data & Types
// --------------------------------------------------------------------------
const DEMO_EMAIL = 'demo@agriconnect.in';
const DEMO_PASSWORD = 'demo1234';

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Karnataka', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'West Bengal'
];

const DISTRICTS = [
  'Warangal', 'Hanamkonda', 'Nalgonda', 'Khammam', 'Karimnagar',
  'Nizamabad', 'Adilabad', 'Mahbubnagar', 'Ranga Reddy', 'Medak'
];

const CROPS = [
  'Paddy', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Groundnut',
  'Soybean', 'Chilli', 'Tomato', 'Onion', 'Potato', 'Turmeric',
  'Banana', 'Mango', 'Bajra', 'Jowar', 'Gram', 'Mustard'
];

const UNITS = ['quintal', 'kg', 'tonne', 'bag', 'crate', 'dozen'];

const GROWTH_STAGES = [
  'Seedling', 'Vegetative', 'Flowering', 'Fruiting / Pod filling',
  'Maturity / Harvest'
];

const SOIL_TYPES = [
  'Sandy', 'Loamy', 'Clay', 'Black (regur)', 'Red', 'Laterite', 'Alluvial'
];

const IRRIGATION_OPTIONS = [
  'Adequate irrigation', 'Limited irrigation',
  'Rainfed only', 'No irrigation available'
];

const WEATHER_OPTIONS = [
  'Normal', 'Hot and dry', 'Humid', 'Heavy rainfall',
  'Cool / cold', 'Not sure'
];

const PROBLEM_CATEGORIES = [
  'Leaf disease / Spots / Blight',
  'Pests & Insect damage',
  'Yellowing leaves / Chlorosis',
  'Wilting / Drying of plant',
  'Poor growth & Stunting',
  'Irrigation / Water stress',
  'Fertilizer & Nutrient issue',
  'Soil & Root issue',
  'Other / Unsure'
];

const SYMPTOM_DURATIONS = [
  'Just started (1-2 days ago)',
  'Past week (3-7 days ago)',
  '1-2 weeks ago',
  'More than 2 weeks ago'
];

const LANDHOLDING_CATEGORIES = [
  'Marginal (below 1 hectare)', 'Small (1–2 hectares)',
  'Semi-medium (2–4 hectares)', 'Medium (4–10 hectares)',
  'Large (above 10 hectares)'
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const ADVISORY_RULES = [
  {
    name: 'RULE-NITRO-01',
    title: 'Possible nitrogen deficiency in the standing crop',
    keywords: ['yellow', 'yellowing', 'pale', 'chlorosis', 'light green'],
    crop: null as string[] | null,
    stage: ['Vegetative', 'Flowering'],
    soil: ['Sandy', 'Red'],
    irrigation: ['Limited irrigation', 'Rainfed only'],
    recommendation: [
      'Yellowing that begins on the older, lower leaves and moves upward is often associated with low nitrogen availability.',
      'Consider a split application of a nitrogen source (for example urea) after a soil or leaf-colour chart check, and avoid applying it just before heavy rain.',
      'Keep a small untreated strip in the field so you can compare recovery over the next 7–10 days.',
    ],
    next_steps: [
      'Confirm with a soil test or a leaf colour chart before applying fertiliser.',
      'Apply nitrogen in two splits rather than a single heavy dose.',
      'Irrigate lightly after application so the nutrient reaches the root zone.',
      'Re-check the crop after 7–10 days and record any change.',
    ],
    severity: 'Monitor closely',
  },
  {
    name: 'RULE-WATERLOG-01',
    title: 'Drainage and root-health check after excess water',
    keywords: ['waterlogging', 'water logged', 'heavy rain', 'flood', 'standing water', 'wilting'],
    crop: null as string[] | null,
    stage: null as string[] | null,
    soil: ['Clay', 'Black (regur)', 'Alluvial'],
    irrigation: null as string[] | null,
    recommendation: [
      'Standing water for more than 24–48 hours restricts oxygen around the roots and often leads to yellowing and wilting.',
      'Open drainage channels at the field edges and, where possible, create shallow surface drains across the slope.',
      'Avoid walking in or working the field until the surface has firmed up.',
    ],
    next_steps: [
      'Clear outlet channels so water can leave the field.',
      'After drainage, loosen the surface gently to help the roots breathe.',
      'Watch for root rot or fungal patches over the next week.',
      'Delay top-dressing fertiliser until the field has drained.',
    ],
    severity: 'Act within 48 hours',
  },
  {
    name: 'RULE-PEST-01',
    title: 'Inspect for pest damage before spraying',
    keywords: ['spots', 'holes', 'insect', 'pest', 'caterpillar', 'aphid', 'borer', 'chewed', 'larva'],
    crop: null as string[] | null,
    stage: null as string[] | null,
    soil: null as string[] | null,
    irrigation: null as string[] | null,
    recommendation: [
      'Chewed leaves, holes and visible insects usually indicate pest activity rather than a nutrient problem.',
      'Identify the pest first — pheromone traps and yellow sticky traps help you decide whether spraying is really needed.',
      'If intervention is required, prefer need-based, recommended doses and avoid spraying during flowering when pollinators are active.',
    ],
    next_steps: [
      "Walk the field in a 'W' pattern and note how many plants in 10 are affected.",
      'Install sticky or pheromone traps to confirm the pest and its numbers.',
      'Consult the label of any pesticide and follow the recommended dose and waiting period.',
      'Contact your local agriculture officer before applying restricted chemicals.',
    ],
    severity: 'Act soon',
  },
  {
    name: 'RULE-IRRIG-01',
    title: 'Irrigation scheduling for limited water availability',
    keywords: ['dry', 'drought', 'moisture stress', 'cracks', 'no rain', 'scarcity'],
    crop: null as string[] | null,
    stage: ['Flowering', 'Fruiting / Pod filling'],
    soil: ['Sandy', 'Loamy', 'Red'],
    irrigation: ['Limited irrigation', 'Rainfed only', 'No irrigation available'],
    recommendation: [
      'Flowering and pod/fruit filling are the stages most sensitive to moisture stress — protecting water at this stage protects yield.',
      'Prioritise irrigation at these critical stages and consider mulching to reduce evaporation.',
      'Where water is very limited, irrigate alternate rows rather than the whole field.',
    ],
    next_steps: [
      'Mulch between rows with crop residue or straw where available.',
      'Irrigate during the cooler part of the day to reduce evaporation losses.',
      'Remove weeds that compete for the same moisture.',
      'Record rainfall and irrigation dates to plan the next cycle.',
    ],
    severity: 'Plan irrigation',
  },
  {
    name: 'RULE-HEALTHY-01',
    title: 'No problem indicators reported — continue routine crop care',
    keywords: ['nothing', 'no issue', 'healthy', 'normal', 'fine', 'good', 'none'],
    crop: null as string[] | null,
    stage: null as string[] | null,
    soil: null as string[] | null,
    irrigation: null as string[] | null,
    recommendation: [
      'No problem indicators were reported. Continue routine monitoring and keep a simple daily record of the crop.',
      'Scout the field at least once a week so any change is noticed early, when it is cheapest to manage.',
    ],
    next_steps: [
      'Scout the field weekly and note stage, colour and any unusual patches.',
      'Keep the field free of weeds around the crop rows.',
      'Plan the next irrigation and nutrient schedule in advance.',
      'Take photographs so you can compare the crop week by week.',
    ],
    severity: 'No action needed',
  },
  {
    name: 'RULE-FUNGAL-01',
    title: 'Possible fungal or disease symptom — confirm before spraying',
    keywords: ['powder', 'rust', 'blight', 'rot', 'mould', 'fungus', 'brown patch', 'black spot'],
    crop: null as string[] | null,
    stage: null as string[] | null,
    soil: null as string[] | null,
    irrigation: null as string[] | null,
    recommendation: [
      'Powdery growth, rust-coloured pustules, rotting or spreading patches are usually disease symptoms rather than nutrient problems.',
      'Remove and destroy badly affected plant parts, improve air movement, and avoid overhead irrigation late in the day.',
      'Confirm the disease before choosing a fungicide — the right product depends on the organism involved.',
    ],
    next_steps: [
      'Collect a sample of an affected leaf for the agriculture officer or KVK.',
      'Avoid working in the field while the foliage is wet.',
      'Do not over-apply nitrogen, which can encourage soft, susceptible growth.',
      'Follow the recommended waiting period before harvest if you do spray.',
    ],
    severity: 'Confirm before spraying',
  },
];

const DEFAULT_CAUTION =
  'This guidance is informational and comes from simplified rules, not from a laboratory test or a trained AI model. Field conditions vary widely — confirm with your local agriculture officer, Krishi Vigyan Kendra, or a qualified agronomist before applying fertilisers or pesticides. AGRICONNECT does not guarantee any particular agricultural outcome.';

const NO_MATCH_TEXT =
  'No rule in the configured advisory rule set matched this combination of crop, stage, soil and symptoms.';

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  state?: string | null;
  district?: string | null;
  land_size?: number | null;
  preferred_crop?: string | null;
  buyer_type?: string | null;
  organisation_name?: string | null;
  crops_of_interest?: string | null;
  preferred_language?: string | null;
  password_hash: string;
  created_at: string;
}

interface Listing {
  id: number;
  user_id: number;
  crop_name: string;
  quantity: number;
  unit: string;
  expected_price?: number | null;
  state?: string | null;
  district?: string | null;
  availability_date?: string | null;
  description?: string | null;
  contact_info?: string | null;
  status: string;
  image_url?: string | null;
  created_at: string;
}

interface Order {
  id: number;
  buyer_id: number;
  listing_id: number;
  quantity: number;
  offered_price: number;
  notes?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string | null;
}

interface WishlistItem {
  id: number;
  buyer_id: number;
  listing_id: number;
  created_at: string;
}

interface Scheme {
  id: number;
  official_id: string;
  name: string;
  description: string;
  level: string;
  department: string;
  category: string;
  states: string;
  districts?: string;
  benefits: string;
  min_land: number;
  max_land: number;
  crops: string;
  farmer_types?: string[];
  irrigation_methods?: string[];
  farming_activities?: string[];
  min_age?: number;
  max_age?: number;
  social_categories?: string[];
  requires_pattadar_passbook?: boolean;
  requires_field_verification: number | boolean;
  exclusion_rules?: string[];
  documents: string[];
  conditions: string[];
  instructions: string;
  official_url: string;
  source_info_url?: string;
  last_verified_date: string;
  status: 'active' | 'temporarily_unavailable' | 'closed' | 'unverified';
  rules_version: string;
}

interface SavedAssessment {
  id: number;
  user_id: number;
  criteria: any;
  results: any[];
  match_count: number;
  created_at: string;
}

interface AdvisoryQuery {
  id: number;
  user_id?: number | null;
  crop_name?: string | null;
  growth_stage?: string | null;
  problem_category?: string | null;
  soil_type?: string | null;
  symptoms?: string | null;
  symptom_duration?: string | null;
  irrigation?: string | null;
  location?: string | null;
  weather?: string | null;
  preferred_language?: string | null;
  crop_photo?: string | null;
  created_at: string;
  no_match: boolean;
  result_title?: string | null;
  recommendation?: string | string[] | null;
  summary?: string | null;
  rule_name?: string | null;
  explanation?: string | null;
  matched_conditions: string[];
  organic_remedies?: string[];
  chemical_remedies?: string[];
  next_steps: string[];
  preventive_measures?: string[];
  caution?: string | null;
  severity?: string | null;
  is_ai_generated?: boolean;
}

// --------------------------------------------------------------------------
// Date helpers
// --------------------------------------------------------------------------
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDateShort(d: Date = new Date()): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateLong(d: Date = new Date()): string {
  return `${DAY_NAMES[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${FULL_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(d: Date = new Date()): string {
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${hours}:${minutes} ${ampm}`;
}

// --------------------------------------------------------------------------
// In-Memory Database Store
// --------------------------------------------------------------------------
let userSeq = 1;
let listingSeq = 1;
let advisorySeq = 1;
let schemeSeq = 1;
let orderSeq = 1;
let wishlistSeq = 1;
let assessmentSeq = 1;

const users: Map<number, User> = new Map();
const listings: Map<number, Listing> = new Map();
const advisoryQueries: Map<number, AdvisoryQuery> = new Map();
const schemes: Map<number, Scheme> = new Map();
const orders: Map<number, Order> = new Map();
const wishlists: Map<number, WishlistItem> = new Map();
const savedAssessments: Map<number, SavedAssessment> = new Map();

function seedData() {
  const now = formatDateShort();
  const demoHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const seedUsers: Array<Omit<User, 'id'>> = [
    {
      name: 'Ramesh Kumar',
      email: DEMO_EMAIL,
      phone: '9848012345',
      role: 'farmer',
      state: 'Telangana',
      district: 'Warangal',
      land_size: 2.5,
      preferred_crop: 'Paddy',
      password_hash: demoHash,
      created_at: now,
    },
    {
      name: 'Lakshmi Devi',
      email: 'lakshmi@example.in',
      phone: '9848098765',
      role: 'farmer',
      state: 'Telangana',
      district: 'Nalgonda',
      land_size: 4.0,
      preferred_crop: 'Cotton',
      password_hash: demoHash,
      created_at: now,
    },
    {
      name: 'Suresh Naik',
      email: 'suresh@example.in',
      phone: '9848076543',
      role: 'farmer',
      state: 'Karnataka',
      district: 'Karimnagar',
      land_size: 1.2,
      preferred_crop: 'Tomato',
      password_hash: demoHash,
      created_at: now,
    },
  ];

  for (const u of seedUsers) {
    const id = userSeq++;
    users.set(id, { id, ...u });
  }

  // Seed Demo Buyers
  const kavithaId = userSeq++;
  users.set(kavithaId, {
    id: kavithaId,
    name: 'Kavitha Rao',
    email: 'buyer@agriconnect.in',
    phone: '9848011223',
    role: 'buyer',
    state: 'Telangana',
    district: 'Warangal',
    buyer_type: 'Retailer',
    organisation_name: 'Rao Fresh Organics',
    crops_of_interest: 'Paddy, Tomato, Cotton',
    password_hash: demoHash,
    created_at: now,
  });

  const rajeshId = userSeq++;
  users.set(rajeshId, {
    id: rajeshId,
    name: 'Rajesh Traders',
    email: 'trader@agriconnect.in',
    phone: '9848055667',
    role: 'buyer',
    state: 'Telangana',
    district: 'Hanamkonda',
    buyer_type: 'Trader',
    organisation_name: 'Rajesh Agri Exports',
    crops_of_interest: 'Paddy, Wheat, Maize',
    password_hash: demoHash,
    created_at: now,
  });

  const todayIso = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const seedListings: Array<Omit<Listing, 'id'>> = [
    {
      user_id: 1,
      crop_name: 'Paddy (Sona Masuri)',
      quantity: 40,
      unit: 'quintal',
      expected_price: 2180,
      state: 'Telangana',
      district: 'Warangal',
      availability_date: firstOfMonth,
      description: 'Fine-grade Sona Masuri paddy, moisture below 14 percent, machine cleaned and packed in new gunny bags.',
      contact_info: '9848012345',
      status: 'available',
      created_at: now,
    },
    {
      user_id: 1,
      crop_name: 'Paddy (BPT 5204)',
      quantity: 25,
      unit: 'quintal',
      expected_price: 2050,
      state: 'Telangana',
      district: 'Warangal',
      availability_date: todayIso,
      description: 'Freshly harvested BPT paddy from rabi season, stored in a covered godown.',
      contact_info: '9848012345',
      status: 'available',
      created_at: now,
    },
    {
      user_id: 2,
      crop_name: 'Cotton (Shankar-6)',
      quantity: 60,
      unit: 'quintal',
      expected_price: 7200,
      state: 'Telangana',
      district: 'Nalgonda',
      availability_date: todayIso,
      description: 'Good staple length cotton, hand-picked and sun dried. Ready for loading within a week.',
      contact_info: 'lakshmi@example.in',
      status: 'available',
      created_at: now,
    },
    {
      user_id: 2,
      crop_name: 'Groundnut',
      quantity: 18,
      unit: 'quintal',
      expected_price: 5800,
      state: 'Telangana',
      district: 'Nalgonda',
      availability_date: todayIso,
      description: 'Bold variety groundnut, cleaned and graded. Suitable for oil extraction.',
      contact_info: 'lakshmi@example.in',
      status: 'available',
      created_at: now,
    },
    {
      user_id: 3,
      crop_name: 'Tomato (Hybrid)',
      quantity: 30,
      unit: 'quintal',
      expected_price: 1600,
      state: 'Karnataka',
      district: 'Karimnagar',
      availability_date: todayIso,
      description: 'Firm hybrid tomatoes, graded by size, packed in plastic crates of 20 kg.',
      contact_info: '9848076543',
      status: 'available',
      created_at: now,
    },
    {
      user_id: 3,
      crop_name: 'Onion (Bellary)',
      quantity: 50,
      unit: 'quintal',
      expected_price: 1450,
      state: 'Karnataka',
      district: 'Karimnagar',
      availability_date: todayIso,
      description: 'Well-cured onions with good skin retention, stored on a raised platform.',
      contact_info: '9848076543',
      status: 'reserved',
      created_at: now,
    },
    {
      user_id: 1,
      crop_name: 'Maize',
      quantity: 35,
      unit: 'quintal',
      expected_price: 1950,
      state: 'Telangana',
      district: 'Hanamkonda',
      availability_date: todayIso,
      description: 'Yellow maize, moisture checked, suitable for poultry feed.',
      contact_info: '9848012345',
      status: 'available',
      created_at: now,
    },
    {
      user_id: 2,
      crop_name: 'Chilli (Teja)',
      quantity: 12,
      unit: 'quintal',
      expected_price: 13500,
      state: 'Telangana',
      district: 'Khammam',
      availability_date: todayIso,
      description: 'Teja variety red chilli, sun dried and sorted. High colour value.',
      contact_info: 'lakshmi@example.in',
      status: 'available',
      created_at: now,
    },
    {
      user_id: 3,
      crop_name: 'Turmeric (Finger)',
      quantity: 20,
      unit: 'quintal',
      expected_price: 8600,
      state: 'Karnataka',
      district: 'Medak',
      availability_date: todayIso,
      description: 'Polished finger turmeric, cured and cleaned, ready for mandi delivery.',
      contact_info: '9848076543',
      status: 'available',
      created_at: now,
    },
  ];

  for (const l of seedListings) {
    const id = listingSeq++;
    listings.set(id, { id, ...l });
  }

  // Seed demo orders & wishlist for Kavitha Rao
  const o1Id = orderSeq++;
  orders.set(o1Id, {
    id: o1Id,
    buyer_id: 4, // Kavitha Rao
    listing_id: 1,
    quantity: 10,
    offered_price: 2150,
    notes: 'Interested in 10 quintals of paddy. Can collect directly.',
    status: 'pending',
    created_at: now,
    updated_at: now,
  });

  const o2Id = orderSeq++;
  orders.set(o2Id, {
    id: o2Id,
    buyer_id: 4, // Kavitha Rao
    listing_id: 2,
    quantity: 5,
    offered_price: 2050,
    notes: 'Ready for immediate dispatch.',
    status: 'accepted',
    created_at: now,
    updated_at: now,
  });

  const w1Id = wishlistSeq++;
  wishlists.set(w1Id, {
    id: w1Id,
    buyer_id: 4,
    listing_id: 3,
    created_at: now,
  });

  const rawSchemes: Array<Omit<Scheme, 'id'>> = [
    {
      official_id: 'PM-KISAN',
      name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      description: 'Central sector income support scheme providing ₹6,000 per year in three equal installments directly into bank accounts of landholding farmer families.',
      level: 'Central',
      department: 'Ministry of Agriculture & Farmers Welfare',
      category: 'Income support',
      states: '',
      districts: '',
      benefits: '₹6,000 per year transferred via Direct Benefit Transfer (DBT) in three equal installments of ₹2,000 every 4 months.',
      min_land: 0,
      max_land: 99999,
      crops: '',
      farmer_types: ['landowner'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: true,
      requires_field_verification: true,
      exclusion_rules: [
        'Institutional landholders',
        'Former and present holders of constitutional posts',
        'Serving or retired officers and employees of state/central government',
        'All persons who paid Income Tax in the last assessment year'
      ],
      documents: ['Aadhaar Card', 'Land Ownership Record (Khatauni / RoR / Pattadar Passbook)', 'Aadhaar-Seeded Bank Account with IFSC', 'Mobile Number'],
      conditions: [
        'Must be a landowning farmer family with cultivable land in revenue records',
        'Bank account must be Aadhaar-seeded for DBT transfer',
        'e-KYC mandatory on PM-KISAN portal'
      ],
      instructions: '1. Visit pmkisan.gov.in or Common Service Centre (CSC).\n2. Register under Farmers Corner with Aadhaar & Land Survey Number.\n3. Complete biometric e-KYC.',
      official_url: 'https://pmkisan.gov.in/',
      source_info_url: 'https://agricoop.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'PMFBY',
      name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
      description: 'Comprehensive crop insurance covering non-preventable natural yield losses, mid-season adversity, and post-harvest damage.',
      level: 'Central',
      department: 'Ministry of Agriculture & Farmers Welfare',
      category: 'Crop insurance',
      states: '',
      districts: '',
      benefits: 'Subsidized premium: 2% for Kharif food/oilseed crops, 1.5% for Rabi, 5% for commercial/horticultural crops. Govt covers remaining premium.',
      min_land: 0,
      max_land: 99999,
      crops: 'Paddy,Wheat,Cotton,Groundnut,Soybean,Maize,Onion,Tomato,Chilli,Sugarcane',
      farmer_types: ['landowner', 'tenant_farmer', 'sharecropper'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: true,
      exclusion_rules: [
        'Unnotified crops or unnotified insurance units',
        'Losses due to war, nuclear risks, or preventable malicious damage'
      ],
      documents: ['Aadhaar Card', 'Land Record or Tenant Lease Certificate', 'Sowing Certificate / Declaration from AEO', 'Bank Passbook Copy'],
      conditions: [
        'Crop must be notified in your district for the season',
        'Must enrol before seasonal cut-off date',
        'Intimate crop loss within 72 hours of disaster'
      ],
      instructions: '1. Visit pmfby.gov.in, your bank branch, or CSC before seasonal deadline.\n2. Upload sowing certificate and land/lease proof.\n3. Pay subsidized farmer premium share.',
      official_url: 'https://pmfby.gov.in/',
      source_info_url: 'https://agricoop.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'KCC',
      name: 'Kisan Credit Card (KCC) Loan Scheme',
      description: 'Revolving institutional crop loan facility providing timely short-term credit for cultivation, post-harvest, and farm maintenance.',
      level: 'Central',
      department: 'NABARD & Reserve Bank of India',
      category: 'Credit & Loans',
      states: '',
      districts: '',
      benefits: 'Revolving credit line at 7% annual interest, reduced to 4% effective interest upon prompt 1-year repayment. Collateral-free loans up to ₹1.6 Lakh.',
      min_land: 0,
      max_land: 99999,
      crops: '',
      farmer_types: ['landowner', 'tenant_farmer', 'sharecropper', 'agricultural_labourer'],
      min_age: 18,
      max_age: 75,
      requires_pattadar_passbook: false,
      requires_field_verification: true,
      exclusion_rules: [
        'Willful bank loan defaulters',
        'Inability to produce proof of cultivation or tenancy'
      ],
      documents: ['KCC Application Form', 'Aadhaar / Voter ID', 'Land Ownership or Lease Agreement Copy', 'Passport Photographs'],
      conditions: [
        'Credit limit assessed based on scale of finance per acre',
        'Interest subvention applies upon timely repayment'
      ],
      instructions: '1. Obtain simplified 1-page KCC form from bank or RRB branch.\n2. Submit identity proof and cropping pattern declaration.\n3. RuPay KCC card issued within 14 days.',
      official_url: 'https://www.myscheme.gov.in/schemes/kcc',
      source_info_url: 'https://www.nabard.org/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'PMKSY-MI',
      name: 'Pradhan Mantri Krishi Sinchayee Yojana - Micro Irrigation (PDMC)',
      description: 'Financial subsidy assisting farmers in installing drip and sprinkler micro-irrigation systems to maximize water and fertilizer efficiency.',
      level: 'Central',
      department: 'Department of Agriculture & Farmers Welfare',
      category: 'Irrigation & Water',
      states: '',
      districts: '',
      benefits: '55% subsidy for Small & Marginal farmers (up to 5 acres) and 45% subsidy for Other farmers towards benchmark equipment costs.',
      min_land: 0.5,
      max_land: 12.5,
      crops: 'Sugarcane,Banana,Mango,Tomato,Chilli,Cotton,Onion,Groundnut,Maize',
      farmer_types: ['landowner', 'tenant_farmer'],
      irrigation_methods: ['rainfed', 'canal_well', 'drip', 'sprinkler'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: true,
      exclusion_rules: [
        'Fields without an assured water source (well, borewell, canal, farm pond)',
        'Land already benefitted under micro-irrigation subsidy in last 7 years'
      ],
      documents: ['Aadhaar Card', 'Land Record / Pahani', 'Electricity Bill or Water Source Certificate', 'Quotation from Empanelled Vendor', 'Bank Passbook'],
      conditions: [
        'Must have assured water source on the field plot',
        'Installation must be through an empanelled vendor',
        'Physical field inspection by department officer before subsidy release'
      ],
      instructions: '1. Register on state micro-irrigation / horticulture portal.\n2. Submit vendor quotation.\n3. Department inspects field and approves installation.',
      official_url: 'https://pmksy.gov.in/',
      source_info_url: 'https://agricoop.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'SMAM',
      name: 'Sub-Mission on Agricultural Mechanization (SMAM)',
      description: 'Subsidizes modern farm equipment, power tillers, rotavators, and tractors to promote mechanization among smallholders.',
      level: 'Central',
      department: 'Ministry of Agriculture & Farmers Welfare',
      category: 'Farm Machinery',
      states: '',
      districts: '',
      benefits: '40% to 50% subsidy on individual machinery purchase for small/marginal, SC/ST, and women farmers; 40% for other categories; up to 80% for Custom Hiring Centres.',
      min_land: 0,
      max_land: 99999,
      crops: '',
      farmer_types: ['landowner', 'tenant_farmer'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: true,
      exclusion_rules: [
        'Purchase of non-FMTTI tested equipment',
        'Non-empanelled equipment dealers'
      ],
      documents: ['Aadhaar Card', 'Land Record copy', 'Caste Certificate (if SC/ST)', 'Bank Passbook', 'Equipment Quotation from Empanelled Dealer'],
      conditions: [
        'Equipment must be FMTTI test approved',
        'Online application and administrative sanction required prior to purchase'
      ],
      instructions: '1. Register online at agrimachinery.nic.in.\n2. Select machine model and empanelled dealer.\n3. Upon sanction, purchase equipment and upload tax invoice.',
      official_url: 'https://agrimachinery.nic.in/',
      source_info_url: 'https://farmech.dac.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'SHC',
      name: 'Soil Health Card Scheme',
      description: 'Free soil sample collection and diagnostic testing providing customized nutrient status reports and crop-wise fertilizer dosage advice.',
      level: 'Central',
      department: 'Ministry of Agriculture & Farmers Welfare',
      category: 'Soil & Organic',
      states: '',
      districts: '',
      benefits: 'Free soil testing report card detailing 12 parameters (pH, EC, Organic Carbon, N, P, K, S, Zn, Fe, Cu, Mn, Bo) with recommended fertilizer doses.',
      min_land: 0,
      max_land: 99999,
      crops: '',
      farmer_types: ['landowner', 'tenant_farmer', 'sharecropper'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: false,
      exclusion_rules: [],
      documents: ['Land Survey Number', 'Village Revenue details', 'Farmer Identity Proof'],
      conditions: [
        'Soil samples collected by department grid testing team',
        'Card issued once every 2 years per field'
      ],
      instructions: '1. Contact local Agriculture Extension Officer (AEO) or Krishi Vigyan Kendra.\n2. GPS-tagged soil sample collected from field.\n3. Diagnostic card issued at Gram Sabha.',
      official_url: 'https://soilhealth.dac.gov.in/',
      source_info_url: 'https://agricoop.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'PKVY',
      name: 'Paramparagat Krishi Vikas Yojana (PKVY)',
      description: 'Promotes eco-friendly organic farming through farmer clusters, bio-input assistance, and Participatory Guarantee System (PGS) certification.',
      level: 'Central',
      department: 'National Centre of Organic Farming',
      category: 'Soil & Organic',
      states: '',
      districts: '',
      benefits: '₹50,000 per hectare grant over 3 years, with ₹31,000/ha direct assistance for organic bio-fertilizers, neem cake, vermicompost, and PGS certification.',
      min_land: 1.0,
      max_land: 5.0,
      crops: '',
      farmer_types: ['landowner', 'tenant_farmer'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: true,
      exclusion_rules: [
        'Individual farmers not part of a registered 20-50 farmer cluster'
      ],
      documents: ['Aadhaar Card', 'Land Record', 'Cluster Agreement Form', 'Bank Account details'],
      conditions: [
        'Must join a cluster of 20-50 farmers covering ~50 acres',
        'Adhere to PGS India organic farming standards'
      ],
      instructions: '1. Form a group with neighbouring farmers.\n2. Contact District Agriculture Officer to register cluster on Jaivik Kheti portal.\n3. Receive organic inputs and certification.',
      official_url: 'https://pgsindia-ncof.gov.in/',
      source_info_url: 'https://agricoop.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'PM-KMY',
      name: 'Pradhan Mantri Kisan Maandhan Yojana (PM-KMY)',
      description: 'Voluntary pension scheme providing social security to small and marginal farmers in their old age.',
      level: 'Central',
      department: 'Ministry of Agriculture & LIC of India',
      category: 'Pension & Welfare',
      states: '',
      districts: '',
      benefits: 'Guaranteed minimum pension of ₹3,000 per month upon attaining 60 years of age. Monthly contribution of ₹55–200 matched 1:1 by Central Govt.',
      min_land: 0,
      max_land: 5.0,
      crops: '',
      farmer_types: ['landowner'],
      min_age: 18,
      max_age: 40,
      requires_pattadar_passbook: true,
      requires_field_verification: true,
      exclusion_rules: [
        'Farmers owning cultivable land exceeding 5 acres (2 hectares)',
        'Farmers covered under NPS, ESIC, EPFO, or income tax payers'
      ],
      documents: ['Aadhaar Card', 'Pattadar Passbook / Land Record', 'Aadhaar-linked Savings Bank Account Passbook'],
      conditions: [
        'Must be a small/marginal landowning farmer aged 18 to 40 years',
        'Monthly contribution auto-debited from bank account or PM-KISAN funds'
      ],
      instructions: '1. Visit nearest CSC center or pmkmy.gov.in.\n2. Submit Aadhaar and land details.\n3. Complete auto-debit bank authorization.',
      official_url: 'https://pmkmy.gov.in/',
      source_info_url: 'https://agricoop.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'TG-RYTHUBHAROSA',
      name: 'Rythu Bharosa / Rythu Bandhu (Telangana)',
      description: 'Telangana state investment grant providing financial support per acre per season to eligible landowning farmers for farm inputs.',
      level: 'State',
      department: 'Telangana Department of Agriculture',
      category: 'Income support',
      states: 'Telangana',
      districts: '',
      benefits: 'Financial grant of ₹10,000 to ₹12,000 per acre per year (disbursed in two seasonal installments for Kharif & Rabi) directly via DBT.',
      min_land: 0,
      max_land: 99999,
      crops: '',
      farmer_types: ['landowner'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: true,
      requires_field_verification: true,
      exclusion_rules: [
        'Land outside Telangana State boundary',
        'Commercial non-agricultural plots or unverified non-agricultural land'
      ],
      documents: ['Telangana Pattadar Passbook / Dharani Khata Number', 'Aadhaar Card', 'Aadhaar-Seeded Bank Account Passbook'],
      conditions: [
        'Farmer must own cultivable land recorded in Telangana Dharani portal',
        'Must reside in Telangana or hold valid Telangana Pattadar passbook'
      ],
      instructions: '1. Verification happens via Dharani land portal.\n2. New passbook holders present bank passbook copy to local AEO.\n3. Funds deposited electronically before sowing season.',
      official_url: 'https://rythubandhu.telangana.gov.in/',
      source_info_url: 'https://agri.telangana.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'TG-RYTHUBIMA',
      name: 'Rythu Bima (Telangana Farmers Group Life Insurance Scheme)',
      description: 'Telangana state social security scheme providing ₹5.00 Lakh life insurance coverage to nominee families of landowning farmers.',
      level: 'State',
      department: 'Telangana Department of Agriculture & LIC of India',
      category: 'Insurance & Safety',
      states: 'Telangana',
      districts: '',
      benefits: '₹5,000,000 (₹5.00 Lakh) lump sum financial relief transferred to nominee bank account within 10 days of farmer death. 100% premium paid by State Govt.',
      min_land: 0,
      max_land: 99999,
      crops: '',
      farmer_types: ['landowner'],
      min_age: 18,
      max_age: 59,
      requires_pattadar_passbook: true,
      requires_field_verification: true,
      exclusion_rules: [
        'Farmers aged 60 years or above at the start of insurance year',
        'Non-landowning individuals without Pattadar passbook'
      ],
      documents: ['Telangana Pattadar Passbook', 'Farmer Aadhaar Card', 'Nominee Aadhaar Card & Bank Account Details'],
      conditions: [
        'Landowning farmer in Telangana aged 18 to 59 years',
        'Enrolment submitted during annual June-July window to AEO'
      ],
      instructions: '1. Fill Rythu Bima enrolment form with local AEO during June enrolment drive.\n2. Nominate immediate family member.\n3. Policy activated under LIC group master policy.',
      official_url: 'https://rythubima.telangana.gov.in/',
      source_info_url: 'https://agri.telangana.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'TG-SEED-SUB',
      name: 'Subsidized Seed Distribution Scheme (Telangana)',
      description: 'Provides high-yielding certified seeds (Paddy, Groundnut, Redgram, Maize, Pulses) to farmers at subsidized rates via PACS and Agros.',
      level: 'State',
      department: 'Telangana State Seeds Development Corporation (TSSDC)',
      category: 'Seeds & Inputs',
      states: 'Telangana',
      districts: '',
      benefits: '33% to 50% price subsidy on certified crop seed bags supplied through government distribution outlets.',
      min_land: 0,
      max_land: 99999,
      crops: 'Paddy,Groundnut,Maize,Bengal Gram,Soybean,Cotton',
      farmer_types: ['landowner', 'tenant_farmer'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: false,
      exclusion_rules: [],
      documents: ['Aadhaar Card', 'Pattadar Passbook or AEO Sowing Certificate', 'Mobile Number'],
      conditions: [
        'Seed quota calculated based on verified field acreage',
        'Distribution during seasonal pre-sowing window'
      ],
      instructions: '1. Visit nearest PACS, Agros Centre, or DCMS outlet in Telangana.\n2. Present Aadhaar / Passbook.\n3. Pay subsidized seed price and collect seed allotment.',
      official_url: 'https://agri.telangana.gov.in/',
      source_info_url: 'https://tssdc.telangana.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'TG-FARM-MECH',
      name: 'Telangana Farm Mechanization Subsidy Scheme',
      description: 'State financial subsidy for purchasing mini tractors, power tillers, rotavators, sprayers, and weeders in Telangana.',
      level: 'State',
      department: 'Telangana Department of Agriculture',
      category: 'Farm Machinery',
      states: 'Telangana',
      districts: '',
      benefits: '50% state subsidy on approved farm machinery models (mini tractors, power tillers, rotavators, sprayers).',
      min_land: 0,
      max_land: 99999,
      crops: '',
      farmer_types: ['landowner', 'tenant_farmer'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: true,
      exclusion_rules: [],
      documents: ['Aadhaar Card', 'Telangana Pattadar Passbook / Land Record', 'Caste Certificate (if SC/ST)', 'Bank Passbook', 'Vendor Quotation'],
      conditions: [
        'Selection made by District Level Sanctioning Committee',
        'Equipment purchased from empanelled dealers'
      ],
      instructions: '1. Submit application to local AEO or online portal.\n2. Committee reviews application and issues sanction order.\n3. Purchase machine and receive 50% subsidy transfer.',
      official_url: 'https://agri.telangana.gov.in/',
      source_info_url: 'https://agri.telangana.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    },
    {
      official_id: 'TGMIP-01',
      name: 'Telangana Micro Irrigation Project (TGMIP)',
      description: 'Specialized state project providing up to 100% subsidy for installing drip and sprinkler systems in Telangana fields.',
      level: 'State',
      department: 'Telangana Micro Irrigation Project (TGMIP)',
      category: 'Irrigation & Water',
      states: 'Telangana',
      districts: '',
      benefits: '100% subsidy for SC/ST farmers (up to 5 acres); 90% subsidy for Small & Marginal farmers (up to 5 acres); 80% subsidy for other farmers (up to 12.5 acres).',
      min_land: 0.5,
      max_land: 12.5,
      crops: 'Cotton,Chilli,Tomato,Sugarcane,Banana,Mango,Groundnut,Maize,Onion',
      farmer_types: ['landowner', 'tenant_farmer'],
      irrigation_methods: ['rainfed', 'canal_well', 'drip', 'sprinkler'],
      min_age: 18,
      max_age: 99,
      requires_pattadar_passbook: false,
      requires_field_verification: true,
      exclusion_rules: [
        'Fields without an existing water source (borewell / well / canal)',
        'Plots that received micro irrigation subsidy in last 7 years'
      ],
      documents: ['Telangana Pattadar Passbook / Land Record', 'Aadhaar Card', 'Water Source Certificate / Electricity Bill', 'Caste Certificate (for SC/ST 100% subsidy)', 'Bank Passbook'],
      conditions: [
        'Must possess an active water source in field',
        'Installation by empanelled TGMIP vendor after GPS survey'
      ],
      instructions: '1. Apply at District Micro Irrigation Officer office or online TGMIP portal.\n2. Company surveyor conducts field layout inspection.\n3. Drip system installed with state subsidy.',
      official_url: 'https://tgmip.telangana.gov.in/',
      source_info_url: 'https://agri.telangana.gov.in/',
      last_verified_date: '12 October 2026',
      status: 'active',
      rules_version: 'v2026.1'
    }
  ];

  for (const s of rawSchemes) {
    const id = schemeSeq++;
    schemes.set(id, { id, ...s });
  }
}

seedData();

// --------------------------------------------------------------------------
// Dict helper to support template `.get('field', 'default')` calls
// --------------------------------------------------------------------------
function makeDict(data: any = {}) {
  const d = { ...(data || {}) };
  Object.defineProperty(d, 'get', {
    value: function (k: string, def: any = '') {
      return (this[k] !== undefined && this[k] !== null) ? this[k] : def;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return d;
}

// --------------------------------------------------------------------------
// Gemini AI & Rule-Based Advisory Engine
// --------------------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

async function runAiCropAdvisory(data: {
  crop_name: string;
  growth_stage?: string;
  problem_category?: string;
  symptoms?: string;
  symptom_duration?: string;
  soil_type?: string;
  irrigation?: string;
  location?: string;
  preferred_language?: string;
  crop_photo?: string;
}) {
  if (!aiClient) return null;

  const targetLang = data.preferred_language || 'English';

  const systemInstruction = `You are a senior ICAR / Krishi Vigyan Kendra (KVK) Agronomist & Crop Protection Specialist in India.
Your mission is to provide detailed, practical, accurate, and actionable crop advisory to Indian farmers.
Diagnose the crop problem carefully using the crop name, growth stage, problem category, symptoms, duration, soil, irrigation, location, and optional crop photo.
CRITICAL REQUIREMENT: Write ALL JSON output field strings (title, summary, severity, organic_remedies, chemical_remedies, next_steps, preventive_measures, caution) DIRECTLY IN THE REQUESTED LANGUAGE: "${targetLang}".
For instance, if targetLang is Telugu (తెలుగు), write in proper Telugu script. If Hindi (हिन्दी), write in Hindi script. If Tamil, in Tamil. If Kannada, in Kannada. If Malayalam, in Malayalam. If Marathi, in Marathi. If English, in English.
Return valid JSON adhering strictly to the schema provided.`;

  const promptText = `
Crop Name: ${data.crop_name}
Growth Stage: ${data.growth_stage || 'Not specified'}
Problem Category: ${data.problem_category || 'Not specified'}
Reported Symptoms: ${data.symptoms || 'Visual or general query'}
Symptom Duration: ${data.symptom_duration || 'Not specified'}
Soil Type: ${data.soil_type || 'Not specified'}
Irrigation Status: ${data.irrigation || 'Not specified'}
Location/District: ${data.location || 'India'}
Preferred Response Language: ${targetLang}
`;

  try {
    const parts: any[] = [];
    if (data.crop_photo && typeof data.crop_photo === 'string' && data.crop_photo.includes('base64,')) {
      const partsMatch = data.crop_photo.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,(.+)$/);
      if (partsMatch) {
        parts.push({
          inlineData: {
            mimeType: partsMatch[1],
            data: partsMatch[2],
          },
        });
      }
    }
    parts.push({ text: promptText });

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: parts.length > 1 ? { parts } : promptText,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Diagnosis or problem name' },
            summary: { type: Type.STRING, description: 'Explanation of root cause and symptoms' },
            severity: { type: Type.STRING, description: 'Action severity e.g. Immediate Action Required / Monitor Closely' },
            organic_remedies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Organic and bio-friendly solutions e.g. Neem oil, Trichoderma'
            },
            chemical_remedies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Chemical treatments with dosage per liter of water'
            },
            next_steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Step-by-step immediate action plan'
            },
            preventive_measures: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Preventive steps for long term crop care'
            },
            caution: { type: Type.STRING, description: 'Pre-harvest interval and safety warnings' }
          },
          required: ['title', 'summary', 'severity', 'next_steps']
        }
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      return {
        no_match: false,
        title: parsed.title,
        summary: parsed.summary,
        rule_name: 'GEMINI-AI-3.8-FLASH',
        severity: parsed.severity || 'Act within 48 hours',
        organic_remedies: parsed.organic_remedies || [],
        chemical_remedies: parsed.chemical_remedies || [],
        recommendation: parsed.next_steps || [],
        next_steps: parsed.next_steps || [],
        preventive_measures: parsed.preventive_measures || [],
        caution: parsed.caution || DEFAULT_CAUTION,
        explanation: `AI Diagnostic Report generated using Gemini AI (${targetLang}).`,
        matched_conditions: [
          `Crop: ${data.crop_name}`,
          ...(data.growth_stage ? [`Stage: ${data.growth_stage}`] : []),
          ...(data.problem_category ? [`Category: ${data.problem_category}`] : []),
          ...(data.crop_photo ? ['Crop Photo Visual Diagnosis'] : [])
        ],
        is_ai_generated: true,
      };
    }
  } catch (err) {
    console.error('Gemini AI Crop Advisory Error:', err);
  }
  return null;
}

function runAdvisoryEngine(data: Record<string, string>) {
  const symptoms = (data.symptoms || '').toLowerCase();
  const category = (data.problem_category || '').toLowerCase();
  const crop = (data.crop_name || '').toLowerCase();

  let best: { rule: typeof ADVISORY_RULES[0]; matched: string[]; score: number } | null = null;
  let bestScore = 0;

  for (const rule of ADVISORY_RULES) {
    let score = 0;
    const matched: string[] = [];

    if (rule.keywords.some(k => symptoms.includes(k) || category.includes(k))) {
      score += 2;
      matched.push('Reported symptoms contain an indicator for this rule');
    }
    if (rule.crop && data.crop_name && rule.crop.some(c => crop.includes(c.toLowerCase()))) {
      score += 1;
      matched.push(`Crop: ${data.crop_name}`);
    }
    if (rule.stage && data.growth_stage && rule.stage.includes(data.growth_stage)) {
      score += 1;
      matched.push(`Growth stage: ${data.growth_stage}`);
    }
    if (rule.soil && data.soil_type && rule.soil.includes(data.soil_type)) {
      score += 1;
      matched.push(`Soil type: ${data.soil_type}`);
    }
    if (rule.irrigation && data.irrigation && rule.irrigation.includes(data.irrigation)) {
      score += 1;
      matched.push(`Irrigation: ${data.irrigation}`);
    }

    if (score > bestScore) {
      best = { rule, matched, score };
      bestScore = score;
    }
  }

  if (!best) {
    const cropTitle = data.crop_name || 'Crop Health';
    const categoryTitle = data.problem_category || 'General Assessment';
    return {
      no_match: false,
      title: `${categoryTitle} Advisory for ${cropTitle}`,
      summary: `Standard agricultural management guidance for ${cropTitle} at the ${data.growth_stage || 'current'} stage based on ICAR agronomic standards.`,
      recommendation: [
        `Inspect ${cropTitle} fields in a 'W' pattern to determine the exact proportion of affected plants.`,
        'Ensure balanced application of nitrogen, phosphorus, and potassium (NPK) without over-fertilizing.',
        'Maintain proper field drainage and clear weed growth along field boundaries.'
      ],
      rule_name: 'RULE-GENERAL-AGRONOMY',
      explanation: `General agronomic advisory generated for ${cropTitle}.`,
      matched_conditions: [
        `Crop: ${cropTitle}`,
        ...(data.growth_stage ? [`Stage: ${data.growth_stage}`] : []),
        ...(data.problem_category ? [`Category: ${data.problem_category}`] : [])
      ],
      organic_remedies: [
        'Apply Neem oil spray (5ml per liter of water with soft soap) every 10 days.',
        'Install yellow sticky traps or pheromone traps to monitor insect activity.'
      ],
      chemical_remedies: [
        'Consult your local Krishi Vigyan Kendra (KVK) for exact active chemical recommendations for your specific district.',
        'Follow recommended pre-harvest waiting periods (PHI) specified on product labels.'
      ],
      next_steps: [
        'Take clear photographs of the leaves and stem to show your local agricultural officer.',
        'Record the date symptoms started and monitor whether they spread across the field.',
        'Irrigate in early morning or late evening to prevent thermal stress on crops.'
      ],
      preventive_measures: [
        'Practice crop rotation with legumes to improve soil health.',
        'Use certified disease-resistant seed varieties in the next sowing season.'
      ],
      caution: DEFAULT_CAUTION,
      severity: 'Monitor closely',
      is_ai_generated: false,
    };
  }

  const { rule, matched, score } = best;
  return {
    no_match: false,
    title: rule.title,
    summary: `Matched rule ${rule.name} based on reported conditions for ${data.crop_name || 'crop'}.`,
    recommendation: rule.recommendation,
    rule_name: rule.name,
    explanation: `Rule ${rule.name} matched your answers on ${score} conditions.`,
    matched_conditions: matched,
    organic_remedies: [
      'Apply Neem oil 5ml/L spray during early morning or late evening.',
      'Maintain field hygiene and remove infested plant residues.'
    ],
    chemical_remedies: [
      'Apply recommended pesticide / fungicide strictly according to prescribed dosage.',
      'Do not mix incompatible chemical compounds without agricultural advice.'
    ],
    next_steps: rule.next_steps,
    preventive_measures: [
      'Scout field weekly to identify issues at early stage.',
      'Ensure balanced irrigation and proper field drainage.'
    ],
    caution: DEFAULT_CAUTION,
    severity: rule.severity || 'Act soon',
    is_ai_generated: false,
  };
}

// --------------------------------------------------------------------------
// Subsidy Scheme Eligibility Engine
// --------------------------------------------------------------------------
function matchSchemes(inputs: any) {
  const farmerState = (inputs.state || '').trim();
  const farmerDistrict = (inputs.district || '').trim();
  const farmerType = (inputs.farmer_type || 'landowner').trim();
  const landSize = parseFloat(inputs.land_size || '0') || 0;
  const docStatus = (inputs.land_document_status || 'pattadar_passbook').trim();
  const crop = (inputs.crop_type || '').trim();
  const irrigation = (inputs.irrigation_method || '').trim();
  const activity = (inputs.farming_activity || 'crop_cultivation').trim();
  const age = parseInt(inputs.age || '35', 10) || 35;
  const socialCategory = (inputs.social_category || 'General').trim();

  const docAadhaar = inputs.doc_aadhaar !== false && inputs.doc_aadhaar !== 'no' && inputs.doc_aadhaar !== 'false';
  const docBank = inputs.doc_bank !== false && inputs.doc_bank !== 'no' && inputs.doc_bank !== 'false';
  const docAadhaarSeeded = inputs.doc_aadhaar_seeded !== false && inputs.doc_aadhaar_seeded !== 'no' && inputs.doc_aadhaar_seeded !== 'false';
  const docPassbook = inputs.doc_passbook !== false && inputs.doc_passbook !== 'no' && inputs.doc_passbook !== 'false';

  const results: any[] = [];

  for (const s of schemes.values()) {
    const satisfied: string[] = [];
    const unmet: string[] = [];
    const missing: string[] = [];
    const nextSteps: string[] = [];
    let isMandatoryFailed = false;

    // 1. Unverified or closed scheme status check
    if (s.status === 'closed' || s.status === 'temporarily_unavailable' || s.status === 'unverified') {
      results.push({
        ...s,
        eligibility_status: 'needs_verification',
        eligibility_note: `Scheme status is currently ${s.status.replace('_', ' ')}. Guidelines or application window require official verification.`,
        match_score: 40,
        why_matched: ['Scheme listed in active government scheme directory'],
        unmet_conditions: ['Application window or funding limit requires official verification with the department'],
        missing_details: ['Seasonal opening date confirmation'],
        legitimate_next_steps: ['Check the official portal or contact your District Agriculture Office for current application status.'],
        required_documents: s.documents,
        application_instructions: s.instructions,
        official_url: s.official_url
      });
      continue;
    }

    // 2. Geographic Jurisdiction Check
    const schemeStates = (s.states || '').split(',').map(st => st.trim()).filter(Boolean);
    if (schemeStates.length === 0) {
      satisfied.push('Applicable across all Indian states and Union Territories.');
    } else if (farmerState && schemeStates.some(st => st.toLowerCase() === farmerState.toLowerCase())) {
      satisfied.push(`Geographic eligibility satisfied for state: ${farmerState}.`);
    } else if (farmerState) {
      isMandatoryFailed = true;
      unmet.push(`Scheme is restricted to farmers in ${schemeStates.join(', ')}. You selected ${farmerState}.`);
      nextSteps.push(`Check equivalent state-sponsored schemes available in ${farmerState}.`);
    }

    // 3. Farmer Classification Check (Landowner vs Tenant vs Labourer)
    if (s.farmer_types && s.farmer_types.length > 0) {
      if (s.farmer_types.includes(farmerType)) {
        satisfied.push(`Matches farmer classification: ${farmerType.replace('_', ' ')}.`);
      } else {
        isMandatoryFailed = true;
        unmet.push(`Scheme is available for ${s.farmer_types.map(f => f.replace('_', ' ')).join(', ')}. You selected ${farmerType.replace('_', ' ')}.`);
        if (s.requires_pattadar_passbook) {
          nextSteps.push('This scheme requires registered land ownership in revenue records (Pattadar passbook).');
        }
      }
    }

    // 4. Landholding Size Check
    if (s.min_land > 0 || s.max_land < 9999) {
      if (landSize >= s.min_land && landSize <= s.max_land) {
        satisfied.push(`Landholding size (${landSize} acres) is within eligible range (${s.min_land}–${s.max_land} acres).`);
      } else if (landSize > s.max_land) {
        isMandatoryFailed = true;
        unmet.push(`Landholding size (${landSize} acres) exceeds the maximum limit for this scheme (Max: ${s.max_land} acres).`);
      } else if (landSize < s.min_land) {
        isMandatoryFailed = true;
        unmet.push(`Landholding size (${landSize} acres) is below minimum requirement (${s.min_land} acres).`);
      }
    }

    // 5. Age Bracket Check
    if (s.min_age || s.max_age) {
      const minA = s.min_age || 18;
      const maxA = s.max_age || 99;
      if (age >= minA && age <= maxA) {
        satisfied.push(`Farmer age (${age} years) satisfies age criteria (${minA}–${maxA} years).`);
      } else {
        isMandatoryFailed = true;
        unmet.push(`Farmer age (${age} years) is outside mandatory age bracket (${minA}–${maxA} years).`);
      }
    }

    // 6. Crop Coverage Check
    const schemeCrops = (s.crops || '').split(',').map(c => c.trim()).filter(Boolean);
    if (schemeCrops.length > 0) {
      if (crop && schemeCrops.some(c => c.toLowerCase() === crop.toLowerCase())) {
        satisfied.push(`Cultivated crop (${crop}) is an officially notified crop under this scheme.`);
      } else if (crop) {
        unmet.push(`Scheme is restricted to notified crops: ${schemeCrops.join(', ')}. Your crop: ${crop}.`);
      } else {
        missing.push(`Specify your crop to confirm seasonal notification (${schemeCrops.join(', ')}).`);
      }
    }

    // 7. Documents Verification Check
    if (!docAadhaar) {
      missing.push('Aadhaar Card copy is required for identity verification.');
      nextSteps.push('Ensure your Aadhaar details match your land/bank records.');
    }
    if (!docBank) {
      missing.push('Active bank account details with IFSC code required.');
    }
    if (!docAadhaarSeeded) {
      missing.push('Bank account must be Aadhaar-seeded for Direct Benefit Transfer (DBT).');
      nextSteps.push('Visit your bank branch or Post Office to complete Aadhaar DBT seed linkage.');
    }
    if (s.requires_pattadar_passbook && !docPassbook) {
      missing.push('Pattadar Passbook / Registered Land Title Record.');
      nextSteps.push('Verify land records on the state revenue portal (e.g. Dharani in Telangana / Meebhoomi in AP).');
    }

    // Status Determination
    let status = 'likely_eligible';
    let score = 95;
    let note = 'All known mandatory eligibility conditions appear satisfied based on your answers.';

    if (isMandatoryFailed) {
      status = 'not_eligible';
      score = 20;
      note = 'One or more mandatory eligibility conditions (such as state, land ownership, or age) are not satisfied.';
    } else if (missing.length > 0 || unmet.length > 0 || s.requires_field_verification) {
      status = 'possibly_eligible';
      score = 75;
      note = 'Basic criteria met. Additional documents or official field verification required before approval.';
    }

    if (nextSteps.length === 0) {
      nextSteps.push('Apply through the official portal or your local Agriculture Extension Officer (AEO) before the deadline.');
    }

    results.push({
      ...s,
      eligibility_status: status,
      eligibility_note: note,
      match_score: score,
      why_matched: satisfied,
      unmet_conditions: unmet,
      missing_details: missing,
      legitimate_next_steps: nextSteps,
      required_documents: s.documents,
      application_instructions: s.instructions,
      official_url: s.official_url
    });
  }

  // Sort by match score and name
  results.sort((a, b) => b.match_score - a.match_score || a.name.localeCompare(b.name));
  return results;
}

// --------------------------------------------------------------------------
// Express App Setup
// --------------------------------------------------------------------------
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  cookieSession({
    name: 'agriconnect_session',
    keys: [process.env.AGRICONNECT_SECRET || 'agriconnect-session-secret-key'],
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }) as any
);

app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/src', express.static(path.join(__dirname, 'src')));

// --------------------------------------------------------------------------
// Flash Message Support
// --------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      flash: (message: string, category?: string) => void;
      currentUser?: User | null;
      csrfToken?: string;
    }
  }
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.session) req.session = {};
  if (!req.session._csrf_token) {
    req.session._csrf_token = crypto.randomBytes(24).toString('hex');
  }
  req.csrfToken = req.session._csrf_token;

  req.flash = (message: string, category = 'info') => {
    if (!req.session) return;
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push([category, message]);
  };

  const uid = req.session.user_id;
  if (uid && users.has(uid)) {
    req.currentUser = users.get(uid);
  } else {
    req.currentUser = null;
  }

  next();
});

// --------------------------------------------------------------------------
// CSRF Validation Middleware
// --------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST') {
    const expected = req.session?._csrf_token;
    const supplied = req.body?.csrf_token;
    if (expected && supplied && expected !== supplied) {
      req.flash('Your form session expired. Please submit the form again.', 'danger');
      return res.redirect(req.get('Referrer') || '/');
    }
  }
  next();
});

// --------------------------------------------------------------------------
// Nunjucks Environment Configuration
// --------------------------------------------------------------------------
const nunjucksEnv = nunjucks.configure(path.join(__dirname, 'templates'), {
  autoescape: true,
  express: app,
  watch: false,
});

nunjucksEnv.addGlobal('range', (start: number, stop: number) => {
  const arr: number[] = [];
  for (let i = start; i < stop; i++) arr.push(i);
  return arr;
});

nunjucksEnv.addGlobal('dict_merge', (a: any, b: any) => ({ ...(a || {}), ...(b || {}) }));

nunjucksEnv.addFilter('initials', (val: any) => {
  if (!val) return 'F';
  const str = String(val).trim();
  if (!str) return 'F';
  const parts = str.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return str.slice(0, 2).toUpperCase();
});

nunjucksEnv.addFilter('format_number', (val: any) => {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (!isNaN(num)) {
    return Math.round(num).toLocaleString('en-IN');
  }
  return String(val);
});

nunjucksEnv.addFilter('string', (val: any) => {
  return val !== null && val !== undefined ? String(val) : '';
});

nunjucksEnv.addFilter('t', (key: any, langCode?: string) => {
  if (!key) return '';
  const lang = langCode || 'en';
  return translateKey(lang, String(key));
});

// Helper function to build application URLs
function urlFor(endpoint: string, ...args: any[]): string {
  let opts: Record<string, any> = {};
  for (const arg of args) {
    if (arg && typeof arg === 'object') {
      opts = { ...opts, ...arg };
    }
  }

  if (endpoint === 'static') {
    const fn = opts.filename || '';
    return `/static/${fn.replace(/^\//, '')}`;
  }

  let basePath = '/';
  if (endpoint === 'index') basePath = '/';
  else if (endpoint === 'login') basePath = '/login';
  else if (endpoint === 'register') basePath = '/register';
  else if (endpoint === 'logout') basePath = '/logout';
  else if (endpoint === 'dashboard') basePath = '/dashboard';
  else if (endpoint === 'profile') basePath = '/profile';
  else if (endpoint === 'marketplace') basePath = '/marketplace';
  else if (endpoint === 'create_listing') basePath = '/listings/new';
  else if (endpoint === 'edit_listing') {
    const id = opts.listing_id || opts.id || '';
    basePath = `/listings/${id}/edit`;
    delete opts.listing_id;
    delete opts.id;
  } else if (endpoint === 'delete_listing') {
    const id = opts.listing_id || opts.id || '';
    basePath = `/listings/${id}/delete`;
    delete opts.listing_id;
    delete opts.id;
  } else if (endpoint === 'crop_advisory') basePath = '/crop-advisory';
  else if (endpoint === 'advisory_result') {
    const id = opts.query_id || opts.id || '';
    basePath = `/crop-advisory/${id}`;
    delete opts.query_id;
    delete opts.id;
  } else if (endpoint === 'subsidy_checker') basePath = '/subsidy-checker';
  else if (endpoint === 'subsidy_results') basePath = '/subsidy-results';
  else basePath = `/${endpoint}`;

  const queryParams = new URLSearchParams();
  for (const [key, val] of Object.entries(opts)) {
    if (val !== undefined && val !== null && val !== '') {
      queryParams.append(key, String(val));
    }
  }

  const qs = queryParams.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// --------------------------------------------------------------------------
// Custom View Rendering with Full Context Injection
// --------------------------------------------------------------------------
function renderView(
  req: Request,
  res: Response,
  viewName: string,
  viewData: Record<string, any> = {},
  status = 200
) {
  const current_user = req.currentUser
    ? {
        is_authenticated: true,
        id: req.currentUser.id,
        name: req.currentUser.name,
        email: req.currentUser.email,
        phone: req.currentUser.phone,
        state: req.currentUser.state,
        district: req.currentUser.district,
        land_size: req.currentUser.land_size,
        preferred_crop: req.currentUser.preferred_crop,
        created_at: req.currentUser.created_at,
        password_hash: req.currentUser.password_hash,
      }
    : {
        is_authenticated: false,
        id: null,
        name: null,
        email: null,
        phone: null,
        state: null,
        district: null,
        land_size: null,
        preferred_crop: null,
        created_at: null,
        password_hash: null,
      };

  const getFlashedMessages = (opts?: any) => {
    const msgs = req.session?.flash || [];
    if (req.session) req.session.flash = [];
    if (opts && opts.with_categories) {
      return msgs;
    }
    return msgs.map(([_, msg]: [string, string]) => msg);
  };

  const csrfToken = () => req.csrfToken || '';

  // Parse cookies from headers
  const reqCookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(c => {
      const parts = c.split('=');
      const name = parts.shift()?.trim();
      if (name) reqCookies[name] = decodeURIComponent(parts.join('='));
    });
  }

  const queryLang = req.query.lang as string;
  const sessionLang = req.session?.lang;
  const cookieLang = reqCookies.ag_lang;
  const userLang = (req.currentUser as any)?.preferred_language;

  const rawLang = queryLang || sessionLang || cookieLang || userLang || 'en';
  const current_lang = LANGUAGES.some(l => l.code === rawLang) ? rawLang : 'en';

  if (req.session) req.session.lang = current_lang;
  res.cookie('ag_lang', current_lang, { maxAge: 31536000000, httpOnly: false });

  const current_lang_obj = LANGUAGES.find(l => l.code === current_lang) || LANGUAGES[0];

  const context: Record<string, any> = {
    current_user,
    current_lang,
    current_lang_obj,
    languages: LANGUAGES,
    translations_json: JSON.stringify(TRANSLATIONS),
    t: (key: string, params?: Record<string, string>) => translateKey(current_lang, key, params),
    user: viewData.user || (current_user.is_authenticated ? current_user : null),
    request: {
      endpoint: viewData.endpoint || 'index',
      path: req.path,
      referrer: req.get('Referrer') || '/',
      args: makeDict(req.query),
      form: makeDict(req.body),
    },
    url_for: urlFor,
    get_flashed_messages: getFlashedMessages,
    csrf_token: csrfToken,
    app_name: 'AGRICONNECT',
    current_year: new Date().getFullYear(),
    today: formatDateLong(),
    states: STATES,
    districts: DISTRICTS,
    crops: CROPS,
    units: UNITS,
    growth_stages: GROWTH_STAGES,
    soil_types: SOIL_TYPES,
    irrigation_options: IRRIGATION_OPTIONS,
    weather_options: WEATHER_OPTIONS,
    categories: LANDHOLDING_CATEGORIES,
    sort_options: SORT_OPTIONS,
    history_enabled: true,
    demo_mode: false,
    demo_credentials: null,
    form_data: makeDict(viewData.form_data || {}),
    query_data: makeDict(viewData.query_data || {}),
    errors: viewData.errors || {},
    ...viewData,
  };

  res.status(status).render(viewName, context);
}

// --------------------------------------------------------------------------
// Auth Guard Middleware
// --------------------------------------------------------------------------
function loginRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    req.flash('Please log in to continue.', 'info');
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

// --------------------------------------------------------------------------
// Form Validation
// --------------------------------------------------------------------------
function validateListingForm(body: any) {
  const data = {
    crop_name: (body.crop_name || '').trim(),
    quantity: (body.quantity || '').trim(),
    unit: (body.unit || 'quintal').trim(),
    expected_price: (body.expected_price || '').trim(),
    state: (body.state || '').trim(),
    district: (body.district || '').trim(),
    availability_date: (body.availability_date || '').trim(),
    description: (body.description || '').trim(),
    contact_info: (body.contact_info || '').trim(),
  };

  const errors: Record<string, string> = {};

  if (!data.crop_name) {
    errors.crop_name = 'Please enter the crop name.';
  }
  if (!data.quantity) {
    errors.quantity = 'Please enter the quantity available.';
  } else {
    const q = parseFloat(data.quantity);
    if (isNaN(q)) {
      errors.quantity = 'Quantity must be a number.';
    } else if (q < 0) {
      errors.quantity = 'Quantity cannot be negative.';
    }
  }

  if (data.expected_price) {
    const p = parseFloat(data.expected_price);
    if (isNaN(p)) {
      errors.expected_price = 'Expected price must be a number.';
    }
  }

  if (!data.state) {
    errors.state = 'Please select the state.';
  }
  if (!data.district) {
    errors.district = 'Please enter the district.';
  }

  return { data, errors };
}

// ==========================================================================
// ROUTES
// ==========================================================================

// Homepage
app.get('/', (req, res) => {
  const availableListings = Array.from(listings.values()).filter(l => l.status === 'available');
  const distinctCrops = new Set(availableListings.map(l => l.crop_name));

  const public_stats = {
    listings: availableListings.length,
    crops: distinctCrops.size,
    schemes: schemes.size,
    farmers: users.size,
  };

  const featured = availableListings
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 3)
    .map(l => {
      const u = users.get(l.user_id);
      return {
        ...l,
        farmer_name: u ? u.name : 'Unknown Farmer',
      };
    });

  renderView(req, res, 'index.html', {
    endpoint: 'index',
    public_stats,
    featured_listings: featured,
  });
});

// Login
app.get('/login', (req, res) => {
  renderView(req, res, 'login.html', {
    endpoint: 'login',
  });
});

app.post('/login', (req, res) => {
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';

  let foundUser: User | undefined;
  for (const u of users.values()) {
    if (u.email.toLowerCase() === email.toLowerCase() || u.name.toLowerCase() === email.toLowerCase()) {
      foundUser = u;
      break;
    }
  }

  if (!foundUser || !bcrypt.compareSync(password, foundUser.password_hash)) {
    return renderView(
      req,
      res,
      'login.html',
      {
        endpoint: 'login',
        errors: { general: 'The email/username or password is not correct.' },
        form_data: { email, remember: req.body.remember },
      },
      401
    );
  }

  if (req.session) {
    req.session.user_id = foundUser.id;
  }

  req.flash(`Welcome back, ${foundUser.name.split(' ')[0]}!`, 'success');
  const userRole = (foundUser.role || 'farmer').toLowerCase();
  const defaultTarget = userRole === 'buyer' ? '/buyer/dashboard' : '/dashboard';
  const nextUrl = req.body.next || req.query.next || defaultTarget;
  res.redirect(nextUrl);
});

// Register Selection Page
app.get('/register', (req, res) => {
  renderView(req, res, 'register.html', {
    endpoint: 'register',
  });
});

// Register Farmer
app.get(['/register/farmer', '/register_farmer'], (req, res) => {
  renderView(req, res, 'register_farmer.html', {
    endpoint: 'register_farmer',
  });
});

app.post(['/register', '/register/farmer', '/register_farmer'], (req, res) => {
  const data = {
    full_name: (req.body.full_name || '').trim(),
    email: (req.body.email || '').trim(),
    phone: (req.body.phone || '').trim(),
    state: (req.body.state || '').trim(),
    district: (req.body.district || '').trim(),
    land_size: (req.body.land_size || '').trim(),
    preferred_crop: (req.body.preferred_crop || '').trim(),
  };

  const password = req.body.password || '';
  const confirm = req.body.confirm_password || '';
  const errors: Record<string, string> = {};

  if (!data.full_name) errors.full_name = 'Please enter your full name.';
  if (!data.email || !data.email.includes('@')) {
    errors.email = 'Please enter a valid email address.';
  } else {
    for (const u of users.values()) {
      if (u.email.toLowerCase() === data.email.toLowerCase()) {
        errors.email = 'This email is already registered. Try logging in.';
        break;
      }
    }
  }

  if (!data.state) errors.state = 'Please select your state.';
  if (!data.district) errors.district = 'Please enter your district.';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters long.';
  if (password !== confirm) errors.confirm_password = 'The two passwords do not match.';

  if (data.land_size) {
    const ls = parseFloat(data.land_size);
    if (isNaN(ls)) errors.land_size = 'Land size must be a number.';
  }

  if (Object.keys(errors).length > 0) {
    return renderView(
      req,
      res,
      'register_farmer.html',
      {
        endpoint: 'register_farmer',
        errors,
        form_data: data,
      },
      400
    );
  }

  const id = userSeq++;
  const pwdHash = bcrypt.hashSync(password, 10);
  users.set(id, {
    id,
    name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: 'farmer',
    state: data.state,
    district: data.district,
    land_size: data.land_size ? parseFloat(data.land_size) : null,
    preferred_crop: data.preferred_crop,
    password_hash: pwdHash,
    created_at: formatDateShort(),
  });

  if (req.session) {
    req.session.user_id = id;
  }

  req.flash('Your farmer profile has been created. Welcome to AGRICONNECT!', 'success');
  res.redirect('/dashboard');
});

// Register Buyer
app.get(['/register_buyer', '/register-buyer', '/register/buyer'], (req, res) => {
  renderView(req, res, 'register_buyer.html', {
    endpoint: 'register_buyer',
  });
});

app.post(['/register_buyer', '/register-buyer', '/register/buyer'], (req, res) => {
  const data = {
    full_name: (req.body.full_name || '').trim(),
    email: (req.body.email || '').trim(),
    phone: (req.body.phone || '').trim(),
    buyer_type: (req.body.buyer_type || '').trim(),
    organisation_name: (req.body.organisation_name || '').trim(),
    state: (req.body.state || '').trim(),
    district: (req.body.district || '').trim(),
    crops_of_interest: (req.body.crops_of_interest || '').trim(),
  };

  const password = req.body.password || '';
  const confirm = req.body.confirm_password || '';
  const errors: Record<string, string> = {};

  if (!data.full_name) errors.full_name = 'Please enter your full name.';
  if (!data.email || !data.email.includes('@')) {
    errors.email = 'Please enter a valid email address.';
  } else {
    for (const u of users.values()) {
      if (u.email.toLowerCase() === data.email.toLowerCase()) {
        errors.email = 'This email is already registered. Try logging in.';
        break;
      }
    }
  }

  if (!data.phone) {
    errors.phone = 'Please enter your phone number.';
  } else if (!/^\d{10}$/.test(data.phone.replace(/[\s-]/g, ''))) {
    errors.phone = 'Please enter a valid 10-digit phone number.';
  }

  if (password.length < 6) errors.password = 'Password must be at least 6 characters long.';
  if (password !== confirm) errors.confirm_password = 'The two passwords do not match.';

  if (Object.keys(errors).length > 0) {
    return renderView(
      req,
      res,
      'register_buyer.html',
      {
        endpoint: 'register_buyer',
        errors,
        form_data: data,
      },
      400
    );
  }

  const id = userSeq++;
  const pwdHash = bcrypt.hashSync(password, 10);
  const now = formatDateShort();

  const newUser: User = {
    id,
    name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: 'buyer',
    state: data.state,
    district: data.district,
    buyer_type: data.buyer_type || 'Individual',
    organisation_name: data.organisation_name,
    crops_of_interest: data.crops_of_interest,
    password_hash: pwdHash,
    created_at: now,
  };

  users.set(id, newUser);
  if (req.session) {
    req.session.user_id = id;
  }

  req.flash('Your buyer profile has been created. Welcome to AGRICONNECT!', 'success');
  res.redirect('/buyer/dashboard');
});

// Language preference API endpoint
app.post('/api/user/language', (req, res) => {
  const lang = (req.body?.lang || '').trim();
  if (lang && LANGUAGES.some(l => l.code === lang)) {
    if (req.session) req.session.lang = lang;
    res.cookie('ag_lang', lang, { maxAge: 31536000000, httpOnly: false });
    if (req.currentUser) {
      req.currentUser.preferred_language = lang;
    }
    return res.json({ success: true, lang });
  }
  return res.status(400).json({ error: 'Invalid language code' });
});

// Logout
app.all('/logout', (req, res) => {
  if (req.session) {
    req.session = null;
  }
  req.flash('You have been logged out.', 'info');
  res.redirect('/');
});

// Buyer Dashboard
app.get('/buyer/dashboard', loginRequired, (req, res) => {
  const user = req.currentUser!;
  if (user.role !== 'buyer') {
    return renderView(req, res, '403.html', {
      message: 'This section is reserved for buyer accounts.',
      current_role: user.role || 'farmer',
    }, 403);
  }

  const userOrders = Array.from(orders.values()).filter(o => o.buyer_id === user.id);
  const totalOrders = userOrders.length;
  const pendingOrders = userOrders.filter(o => o.status === 'pending').length;
  const acceptedOrders = userOrders.filter(o => o.status === 'accepted').length;

  const userWishlist = Array.from(wishlists.values()).filter(w => w.buyer_id === user.id);
  const wishlistCount = userWishlist.length;

  const recentOrdersWithDetails = userOrders.sort((a, b) => b.id - a.id).slice(0, 5).map(o => {
    const listing = listings.get(o.listing_id);
    const farmer = listing ? users.get(listing.user_id) : null;
    return {
      ...o,
      crop_name: listing?.crop_name || 'Crop',
      unit: listing?.unit || 'quintal',
      state: listing?.state || '',
      district: listing?.district || '',
      farmer_name: farmer?.name || 'Farmer',
      farmer_phone: farmer?.phone || '',
    };
  });

  const recentListings = Array.from(listings.values()).slice(0, 6).map(l => {
    const farmer = users.get(l.user_id);
    return { ...l, farmer_name: farmer?.name || 'Farmer' };
  });

  const buyerFields = ['name', 'email', 'phone', 'buyer_type', 'organisation_name', 'state', 'district', 'crops_of_interest'];
  const filled = buyerFields.filter(f => (user as any)[f]).length;
  const profileCompletion = Math.round((filled / buyerFields.length) * 100);

  renderView(req, res, 'buyer_dashboard.html', {
    endpoint: 'buyer_dashboard',
    user,
    stats: {
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      accepted_orders: acceptedOrders,
      wishlist_count: wishlistCount,
      total_available_listings: listings.size,
      available_crops: new Set(Array.from(listings.values()).map(l => l.crop_name)).size,
    },
    recent_orders: recentOrdersWithDetails,
    recent_listings: recentListings,
    profile_completion: profileCompletion,
  });
});

// Listing Details & Order Placement
app.get(['/listing/:id', '/listings/:id'], (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  const listing = listings.get(listingId);
  if (!listing) {
    return renderView(req, res, '404.html', {}, 404);
  }

  const farmer = users.get(listing.user_id);
  const currentUser = req.currentUser;

  let isWishlisted = false;
  if (currentUser && currentUser.role === 'buyer') {
    isWishlisted = Array.from(wishlists.values()).some(w => w.buyer_id === currentUser.id && w.listing_id === listingId);
  }

  const listingWithFarmer = {
    ...listing,
    farmer_name: farmer?.name || 'Farmer',
  };

  renderView(req, res, 'listing_detail.html', {
    listing: listingWithFarmer,
    user: currentUser,
    is_wishlisted: isWishlisted,
  });
});

app.post('/order/place', loginRequired, (req, res) => {
  const user = req.currentUser!;
  if (user.role !== 'buyer') {
    req.flash('Only registered buyers can place purchase offers.', 'danger');
    return res.redirect('/marketplace');
  }

  const listingId = parseInt(req.body.listing_id, 10);
  const listing = listings.get(listingId);
  if (!listing) {
    req.flash('Listing not found.', 'danger');
    return res.redirect('/marketplace');
  }

  const quantity = parseFloat(req.body.quantity);
  const offeredPrice = parseFloat(req.body.offered_price);
  const notes = (req.body.notes || '').trim();

  if (isNaN(quantity) || quantity <= 0) {
    req.flash('Please enter a valid quantity.', 'danger');
    return res.redirect(`/listing/${listingId}`);
  }

  if (quantity > listing.quantity) {
    req.flash(`Quantity requested (${quantity}) exceeds available stock (${listing.quantity} ${listing.unit}).`, 'danger');
    return res.redirect(`/listing/${listingId}`);
  }

  if (isNaN(offeredPrice) || offeredPrice <= 0) {
    req.flash('Please enter a valid offered price.', 'danger');
    return res.redirect(`/listing/${listingId}`);
  }

  const newOrderId = orderSeq++;
  const now = formatDateShort();

  const newOrder: Order = {
    id: newOrderId,
    buyer_id: user.id,
    listing_id: listingId,
    quantity,
    offered_price: offeredPrice,
    notes,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  orders.set(newOrderId, newOrder);
  req.flash(`Your purchase offer for ${listing.crop_name} has been placed successfully!`, 'success');
  res.redirect('/buyer/orders');
});

// Buyer Orders List
app.get('/buyer/orders', loginRequired, (req, res) => {
  const user = req.currentUser!;
  if (user.role !== 'buyer') {
    return renderView(req, res, '403.html', { message: 'Reserved for buyer accounts.' }, 403);
  }

  const userOrders = Array.from(orders.values()).filter(o => o.buyer_id === user.id).sort((a, b) => b.id - a.id);
  const detailedOrders = userOrders.map(o => {
    const listing = listings.get(o.listing_id);
    const farmer = listing ? users.get(listing.user_id) : null;
    return {
      ...o,
      crop_name: listing?.crop_name || 'Crop',
      unit: listing?.unit || 'quintal',
      state: listing?.state || '',
      district: listing?.district || '',
      farmer_name: farmer?.name || 'Farmer',
      farmer_phone: farmer?.phone || '',
    };
  });

  const stats = {
    total: userOrders.length,
    pending: userOrders.filter(o => o.status === 'pending').length,
    accepted: userOrders.filter(o => o.status === 'accepted').length,
    completed: userOrders.filter(o => o.status === 'completed').length,
  };

  renderView(req, res, 'buyer_orders.html', {
    user,
    orders: detailedOrders,
    stats,
  });
});

app.post('/order/cancel/:id', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const orderId = parseInt(req.params.id, 10);
  const order = orders.get(orderId);

  if (order && order.buyer_id === user.id && order.status === 'pending') {
    order.status = 'cancelled';
    order.updated_at = formatDateShort();
    req.flash('Order offer cancelled.', 'info');
  }

  res.redirect('/buyer/orders');
});

// Farmer Incoming Orders
app.get('/farmer/orders', loginRequired, (req, res) => {
  const user = req.currentUser!;
  if (user.role === 'buyer') {
    return renderView(req, res, '403.html', { message: 'Reserved for farmer accounts.' }, 403);
  }

  const farmerListings = Array.from(listings.values()).filter(l => l.user_id === user.id);
  const farmerListingIds = new Set(farmerListings.map(l => l.id));

  const incomingOrders = Array.from(orders.values()).filter(o => farmerListingIds.has(o.listing_id)).sort((a, b) => b.id - a.id);
  const detailedIncoming = incomingOrders.map(o => {
    const listing = listings.get(o.listing_id);
    const buyer = users.get(o.buyer_id);
    return {
      ...o,
      crop_name: listing?.crop_name || 'Crop',
      unit: listing?.unit || 'quintal',
      buyer_name: buyer?.name || 'Buyer',
      buyer_phone: buyer?.phone || '',
      organisation_name: buyer?.organisation_name || '',
    };
  });

  renderView(req, res, 'farmer_orders.html', {
    user,
    orders: detailedIncoming,
  });
});

app.post('/order/accept/:id', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const orderId = parseInt(req.params.id, 10);
  const order = orders.get(orderId);

  if (order) {
    const listing = listings.get(order.listing_id);
    if (listing && listing.user_id === user.id) {
      order.status = 'accepted';
      order.updated_at = formatDateShort();
      req.flash('Order offer accepted!', 'success');
    }
  }

  res.redirect('/farmer/orders');
});

app.post('/order/reject/:id', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const orderId = parseInt(req.params.id, 10);
  const order = orders.get(orderId);

  if (order) {
    const listing = listings.get(order.listing_id);
    if (listing && listing.user_id === user.id) {
      order.status = 'rejected';
      order.updated_at = formatDateShort();
      req.flash('Order offer rejected.', 'info');
    }
  }

  res.redirect('/farmer/orders');
});

// Wishlist Routes
app.post('/wishlist/toggle/:id', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const listingId = parseInt(req.params.id, 10);

  let existingKey: number | null = null;
  for (const [k, w] of wishlists.entries()) {
    if (w.buyer_id === user.id && w.listing_id === listingId) {
      existingKey = k;
      break;
    }
  }

  if (existingKey !== null) {
    wishlists.delete(existingKey);
    req.flash('Removed from wishlist.', 'info');
  } else {
    const wId = wishlistSeq++;
    wishlists.set(wId, {
      id: wId,
      buyer_id: user.id,
      listing_id: listingId,
      created_at: formatDateShort(),
    });
    req.flash('Saved to wishlist!', 'success');
  }

  res.redirect(req.get('Referrer') || '/wishlist');
});

app.get(['/wishlist', '/buyer/wishlist'], loginRequired, (req, res) => {
  const user = req.currentUser!;
  const userWishlist = Array.from(wishlists.values()).filter(w => w.buyer_id === user.id);

  const items = userWishlist.map(w => {
    const listing = listings.get(w.listing_id);
    const farmer = listing ? users.get(listing.user_id) : null;
    return {
      ...listing,
      saved_at: w.created_at,
      farmer_name: farmer?.name || 'Farmer',
    };
  }).filter(item => item.id !== undefined);

  renderView(req, res, 'wishlist.html', {
    user,
    items,
  });
});

// Buyer Profile
app.get('/buyer/profile', loginRequired, (req, res) => {
  res.redirect('/profile');
});

// Dashboard
app.get('/dashboard', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const uid = user.id;

  const userListings = Array.from(listings.values()).filter(l => l.user_id === uid);
  const activeListings = userListings.filter(l => l.status === 'available');
  const allAvailable = Array.from(listings.values()).filter(l => l.status === 'available');
  const availableCrops = new Set(allAvailable.map(l => l.crop_name));

  const userAdvisories = Array.from(advisoryQueries.values()).filter(a => a.user_id === uid);

  const matchedSchemes = matchSchemes({ state: user.state, district: user.district, land_size: user.land_size, crop: user.preferred_crop });

  const stats = {
    active_listings: activeListings.length,
    available_crops: availableCrops.size,
    advisory_queries: userAdvisories.length,
    scheme_matches: matchedSchemes.length,
  };

  const recent_listings = userListings
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 5)
    .map(l => ({
      ...l,
      farmer_name: user.name,
      is_owner: true,
    }));

  const recent_advisories = userAdvisories
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  const fields: Array<keyof User> = ['name', 'email', 'phone', 'state', 'district', 'land_size', 'preferred_crop'];
  const filled = fields.reduce((acc, f) => (user[f] ? acc + 1 : acc), 0);
  const profile_completion = Math.round((filled / fields.length) * 100);

  renderView(req, res, 'dashboard.html', {
    endpoint: 'dashboard',
    user,
    stats,
    recent_listings,
    recent_advisories,
    profile_completion,
  });
});

// Profile
app.get('/profile', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const edit_mode = req.query.edit === '1';

  const fields: Array<keyof User> = ['name', 'email', 'phone', 'state', 'district', 'land_size', 'preferred_crop'];
  const filled = fields.reduce((acc, f) => (user[f] ? acc + 1 : acc), 0);
  const profile_completion = Math.round((filled / fields.length) * 100);

  renderView(req, res, 'profile.html', {
    endpoint: 'profile',
    user,
    edit_mode,
    member_since: user.created_at,
    profile_completion,
  });
});

app.post('/profile', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const data = {
    full_name: (req.body.full_name || '').trim(),
    email: (req.body.email || '').trim(),
    phone: (req.body.phone || '').trim(),
    state: (req.body.state || '').trim(),
    district: (req.body.district || '').trim(),
    land_size: (req.body.land_size || '').trim(),
    preferred_crop: (req.body.preferred_crop || '').trim(),
  };

  const errors: Record<string, string> = {};

  if (!data.full_name) errors.full_name = 'Please enter your full name.';
  if (!data.email || !data.email.includes('@')) {
    errors.email = 'Please enter a valid email address.';
  } else {
    for (const u of users.values()) {
      if (u.id !== user.id && u.email.toLowerCase() === data.email.toLowerCase()) {
        errors.email = 'That email is already used by another account.';
        break;
      }
    }
  }

  if (!data.state) errors.state = 'Please select your state.';
  if (!data.district) errors.district = 'Please enter your district.';

  if (data.land_size) {
    const ls = parseFloat(data.land_size);
    if (isNaN(ls)) errors.land_size = 'Land size must be a number.';
  }

  if (Object.keys(errors).length > 0) {
    return renderView(
      req,
      res,
      'profile.html',
      {
        endpoint: 'profile',
        user,
        errors,
        form_data: data,
        edit_mode: true,
      },
      400
    );
  }

  user.name = data.full_name;
  user.email = data.email;
  user.phone = data.phone || null;
  user.state = data.state;
  user.district = data.district;
  user.land_size = data.land_size ? parseFloat(data.land_size) : null;
  user.preferred_crop = data.preferred_crop || null;

  if (req.body.preferred_language) {
    const lang = (req.body.preferred_language || '').trim();
    if (LANGUAGES.some(l => l.code === lang)) {
      user.preferred_language = lang;
      if (req.session) req.session.lang = lang;
      res.cookie('ag_lang', lang, { maxAge: 31536000000, httpOnly: false });
    }
  }

  req.flash('Your profile has been updated.', 'success');
  res.redirect('/profile');
});

// Marketplace
app.get('/marketplace', (req, res) => {
  const f = {
    q: String(req.query.q || '').trim(),
    state: String(req.query.state || '').trim(),
    district: String(req.query.district || '').trim(),
    min_price: String(req.query.min_price || '').trim(),
    max_price: String(req.query.max_price || '').trim(),
    sort: String(req.query.sort || 'newest'),
    mine: String(req.query.mine || ''),
  };

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const per_page = 9;

  let filtered = Array.from(listings.values());

  if (f.q) {
    const qLower = f.q.toLowerCase();
    const matchedCanonicalCrops: string[] = [];
    for (const [canonicalCrop, aliases] of Object.entries(CROP_ALIASES)) {
      if (aliases.some(a => a.toLowerCase().includes(qLower) || qLower.includes(a.toLowerCase()))) {
        matchedCanonicalCrops.push(canonicalCrop.toLowerCase());
      }
    }

    filtered = filtered.filter(l => {
      const cropLower = l.crop_name.toLowerCase();
      const matchesAlias = matchedCanonicalCrops.some(mc => cropLower.includes(mc) || mc.includes(cropLower));
      const matchesText = cropLower.includes(qLower) ||
                          (l.description && l.description.toLowerCase().includes(qLower)) ||
                          (l.state && l.state.toLowerCase().includes(qLower)) ||
                          (l.district && l.district.toLowerCase().includes(qLower));
      return matchesAlias || matchesText;
    });
  }

  if (f.state) {
    filtered = filtered.filter(l => l.state === f.state);
  }

  if (f.district) {
    filtered = filtered.filter(l => l.district === f.district);
  }

  if (f.min_price) {
    const min = parseFloat(f.min_price);
    if (!isNaN(min)) {
      filtered = filtered.filter(l => l.expected_price !== undefined && l.expected_price !== null && l.expected_price >= min);
    }
  }

  if (f.max_price) {
    const max = parseFloat(f.max_price);
    if (!isNaN(max)) {
      filtered = filtered.filter(l => l.expected_price !== undefined && l.expected_price !== null && l.expected_price <= max);
    }
  }

  if (f.mine && req.currentUser) {
    filtered = filtered.filter(l => l.user_id === req.currentUser!.id);
  }

  // Sorting
  if (f.sort === 'price_asc') {
    filtered.sort((a, b) => (a.expected_price || 0) - (b.expected_price || 0));
  } else if (f.sort === 'price_desc') {
    filtered.sort((a, b) => (b.expected_price || 0) - (a.expected_price || 0));
  } else {
    // Newest
    filtered.sort((a, b) => b.id - a.id);
  }

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / per_page));
  const offset = (page - 1) * per_page;
  const pageItems = filtered.slice(offset, offset + per_page);

  const uid = req.currentUser ? req.currentUser.id : null;
  const items = pageItems.map(l => {
    const u = users.get(l.user_id);
    return {
      ...l,
      farmer_name: u ? u.name : 'Unknown Farmer',
      is_owner: uid !== null && l.user_id === uid,
    };
  });

  const pagination = {
    items,
    page,
    per_page,
    total,
    pages,
    has_prev: page > 1,
    has_next: page < pages,
    prev_num: page - 1,
    next_num: page + 1,
  };

  renderView(req, res, 'marketplace.html', {
    endpoint: 'marketplace',
    listings: items,
    filters: f,
    result_count: total,
    pagination,
  });
});

// Create Listing
app.get('/listings/new', loginRequired, (req, res) => {
  const user = req.currentUser!;
  renderView(req, res, 'create_listing.html', {
    endpoint: 'create_listing',
    user,
    form_data: {
      contact_info: user.phone || user.email,
    },
  });
});

app.post('/listings/new', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const { data, errors } = validateListingForm(req.body);

  if (Object.keys(errors).length > 0) {
    return renderView(
      req,
      res,
      'create_listing.html',
      {
        endpoint: 'create_listing',
        user,
        errors,
        form_data: data,
      },
      400
    );
  }

  const newId = listingSeq++;
  const newListing: Listing = {
    id: newId,
    user_id: user.id,
    crop_name: data.crop_name,
    quantity: parseFloat(data.quantity),
    unit: data.unit,
    expected_price: data.expected_price ? parseFloat(data.expected_price) : null,
    state: data.state,
    district: data.district,
    availability_date: data.availability_date || null,
    description: data.description || null,
    contact_info: data.contact_info || null,
    status: 'available',
    created_at: formatDateShort(),
  };

  listings.set(newId, newListing);
  req.flash('Your crop listing has been published.', 'success');
  res.redirect('/marketplace?mine=1');
});

// Edit Listing
app.get('/listings/:id/edit', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const id = parseInt(req.params.id, 10);
  const listing = listings.get(id);

  if (!listing) {
    return renderView(req, res, '404.html', { endpoint: 'not_found' }, 404);
  }

  if (listing.user_id !== user.id) {
    req.flash('You can only edit your own listings.', 'danger');
    return res.redirect('/marketplace');
  }

  renderView(req, res, 'edit_listing.html', {
    endpoint: 'edit_listing',
    listing,
    form_data: listing,
  });
});

app.post('/listings/:id/edit', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const id = parseInt(req.params.id, 10);
  const listing = listings.get(id);

  if (!listing) {
    return renderView(req, res, '404.html', { endpoint: 'not_found' }, 404);
  }

  if (listing.user_id !== user.id) {
    req.flash('You can only edit your own listings.', 'danger');
    return res.redirect('/marketplace');
  }

  const { data, errors } = validateListingForm(req.body);

  if (Object.keys(errors).length > 0) {
    return renderView(
      req,
      res,
      'edit_listing.html',
      {
        endpoint: 'edit_listing',
        listing,
        errors,
        form_data: data,
      },
      400
    );
  }

  listing.crop_name = data.crop_name;
  listing.quantity = parseFloat(data.quantity);
  listing.unit = data.unit;
  listing.expected_price = data.expected_price ? parseFloat(data.expected_price) : null;
  listing.state = data.state;
  listing.district = data.district;
  listing.availability_date = data.availability_date || null;
  listing.description = data.description || null;
  listing.contact_info = data.contact_info || null;
  listing.status = req.body.status || 'available';

  req.flash('Your listing has been updated.', 'success');
  res.redirect('/marketplace?mine=1');
});

// Delete Listing
app.post('/listings/:id/delete', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const id = parseInt(req.params.id, 10);
  const listing = listings.get(id);

  if (!listing) {
    return renderView(req, res, '404.html', { endpoint: 'not_found' }, 404);
  }

  if (listing.user_id !== user.id) {
    req.flash('You can only delete your own listings.', 'danger');
    return res.redirect('/marketplace');
  }

  listings.delete(id);
  req.flash('The listing has been deleted.', 'success');
  res.redirect('/marketplace?mine=1');
});

// Crop Advisory
app.get('/crop-advisory', (req, res) => {
  renderView(req, res, 'crop_advisory.html', {
    endpoint: 'crop_advisory',
    problem_categories: PROBLEM_CATEGORIES,
    symptom_durations: SYMPTOM_DURATIONS,
  });
});

app.post('/crop-advisory', async (req, res) => {
  const user = req.currentUser;
  const currentLocale = req.session?.language || 'en';

  const data = {
    crop_name: (req.body.crop_name || '').trim(),
    growth_stage: (req.body.growth_stage || '').trim(),
    problem_category: (req.body.problem_category || '').trim(),
    symptoms: (req.body.symptoms || '').trim(),
    symptom_duration: (req.body.symptom_duration || '').trim(),
    soil_type: (req.body.soil_type || '').trim(),
    irrigation: (req.body.irrigation || '').trim(),
    location: (req.body.location || (user ? `${user.district || ''}, ${user.state || ''}` : '')).trim(),
    preferred_language: (req.body.preferred_language || user?.preferred_language || currentLocale || 'English').trim(),
    crop_photo: (req.body.crop_photo || '').trim(),
    weather: (req.body.weather || '').trim(),
  };

  const errors: Record<string, string> = {};
  if (!data.crop_name) {
    errors.crop_name = 'Please specify or choose your crop name.';
  }
  if (!data.symptoms && !data.problem_category && !data.crop_photo) {
    errors.symptoms = 'Please describe your crop symptoms, select a problem category, or upload a photo.';
  }

  if (Object.keys(errors).length > 0) {
    return renderView(
      req,
      res,
      'crop_advisory.html',
      {
        endpoint: 'crop_advisory',
        errors,
        form_data: data,
        query_data: data,
        problem_categories: PROBLEM_CATEGORIES,
        symptom_durations: SYMPTOM_DURATIONS,
      },
      400
    );
  }

  // Try Gemini AI Advisory Engine first
  let advisory = await runAiCropAdvisory(data);

  // Fallback to Rule-based engine if AI engine is not available or errors out
  if (!advisory) {
    advisory = runAdvisoryEngine(data);
  }

  const newId = advisorySeq++;
  const queryRecord: AdvisoryQuery = {
    id: newId,
    user_id: user ? user.id : null,
    crop_name: data.crop_name,
    growth_stage: data.growth_stage,
    problem_category: data.problem_category,
    symptoms: data.symptoms,
    symptom_duration: data.symptom_duration,
    soil_type: data.soil_type,
    irrigation: data.irrigation,
    location: data.location,
    preferred_language: data.preferred_language,
    crop_photo: data.crop_photo,
    weather: data.weather,
    created_at: formatDateTime(),
    no_match: advisory.no_match,
    result_title: advisory.title,
    recommendation: advisory.recommendation,
    summary: advisory.summary,
    rule_name: advisory.rule_name,
    explanation: advisory.explanation,
    matched_conditions: advisory.matched_conditions,
    organic_remedies: advisory.organic_remedies,
    chemical_remedies: advisory.chemical_remedies,
    next_steps: advisory.next_steps,
    preventive_measures: advisory.preventive_measures,
    caution: advisory.caution,
    severity: advisory.severity,
    is_ai_generated: advisory.is_ai_generated,
  };

  advisoryQueries.set(newId, queryRecord);
  res.redirect(`/crop-advisory/${newId}`);
});

app.get('/crop-advisory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const q = advisoryQueries.get(id);

  if (!q) {
    return renderView(
      req,
      res,
      'advisory_result.html',
      {
        endpoint: 'advisory_result',
        query: null,
        advisory: null,
      },
      404
    );
  }

  const advisory = {
    no_match: q.no_match,
    title: q.result_title,
    recommendation: q.recommendation,
    summary: q.summary,
    rule_name: q.rule_name,
    explanation: q.explanation,
    matched_conditions: q.matched_conditions,
    organic_remedies: q.organic_remedies,
    chemical_remedies: q.chemical_remedies,
    next_steps: q.next_steps,
    preventive_measures: q.preventive_measures,
    caution: q.caution,
    severity: q.severity,
    is_ai_generated: q.is_ai_generated,
  };

  renderView(req, res, 'advisory_result.html', {
    endpoint: 'advisory_result',
    query: q,
    advisory,
  });
});

// Subsidy Checker
app.get('/subsidy-checker', (req, res) => {
  const user = req.currentUser;
  renderView(req, res, 'subsidy_checker.html', {
    endpoint: 'subsidy_checker',
    states: STATES,
    districts: DISTRICTS,
    crops: CROPS,
    user: user || null,
  });
});

app.post('/subsidy-checker', (req, res) => {
  const user = req.currentUser;

  const criteria = {
    state: (req.body.state || (user ? user.state : '') || '').trim(),
    district: (req.body.district || (user ? user.district : '') || '').trim(),
    farmer_type: (req.body.farmer_type || 'landowner').trim(),
    land_size: (req.body.land_size || (user ? String(user.land_size || '') : '') || '').trim(),
    land_document_status: (req.body.land_document_status || 'pattadar_passbook').trim(),
    crop_type: (req.body.crop_type || (user ? user.preferred_crop : '') || '').trim(),
    irrigation_method: (req.body.irrigation_method || 'canal_well').trim(),
    farming_activity: (req.body.farming_activity || 'crop_cultivation').trim(),
    age: (req.body.age || '35').trim(),
    social_category: (req.body.social_category || 'General').trim(),
    doc_aadhaar: req.body.doc_aadhaar === 'yes' || req.body.doc_aadhaar === 'true' || req.body.doc_aadhaar === '1',
    doc_bank: req.body.doc_bank === 'yes' || req.body.doc_bank === 'true' || req.body.doc_bank === '1',
    doc_aadhaar_seeded: req.body.doc_aadhaar_seeded === 'yes' || req.body.doc_aadhaar_seeded === 'true' || req.body.doc_aadhaar_seeded === '1',
    doc_passbook: req.body.doc_passbook === 'yes' || req.body.doc_passbook === 'true' || req.body.doc_passbook === '1',
    existing_benefits: Array.isArray(req.body.existing_benefits) ? req.body.existing_benefits : (req.body.existing_benefits ? [req.body.existing_benefits] : []),
  };

  const errors: Record<string, string> = {};

  if (!criteria.state) {
    errors.state = 'Please select your state.';
  }
  if (!criteria.land_size) {
    errors.land_size = 'Please enter your landholding size in acres.';
  } else {
    const ls = parseFloat(criteria.land_size);
    if (isNaN(ls)) {
      errors.land_size = 'Land size must be a valid number.';
    } else if (ls < 0) {
      errors.land_size = 'Land size cannot be negative.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return renderView(
      req,
      res,
      'subsidy_checker.html',
      {
        endpoint: 'subsidy_checker',
        errors,
        form_data: criteria,
        states: STATES,
        districts: DISTRICTS,
        crops: CROPS,
        user: user || null,
      },
      400
    );
  }

  const matched = matchSchemes(criteria);
  if (req.session) {
    req.session.last_subsidy_check = {
      criteria,
      matched,
      checked_at: formatDateTime()
    };
  }

  renderView(req, res, 'subsidy_results.html', {
    endpoint: 'subsidy_results',
    schemes: matched,
    criteria,
    match_count: matched.length,
    schemes_checked: schemes.size,
    checked_at: formatDateTime(),
  });
});

app.get('/subsidy-results', (req, res) => {
  const lastCheck = req.session?.last_subsidy_check;
  if (!lastCheck) {
    return renderView(req, res, 'subsidy_results.html', {
      endpoint: 'subsidy_results',
      schemes: [],
      criteria: null,
      match_count: 0,
      schemes_checked: schemes.size,
      checked_at: null,
    });
  }

  renderView(req, res, 'subsidy_results.html', {
    endpoint: 'subsidy_results',
    schemes: lastCheck.matched || [],
    criteria: lastCheck.criteria,
    match_count: (lastCheck.matched || []).length,
    schemes_checked: schemes.size,
    checked_at: lastCheck.checked_at,
  });
});

// Save Scheme Assessment (Logged-in farmers)
app.post('/subsidy-checker/save', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const lastCheck = req.session?.last_subsidy_check;

  if (!lastCheck || !lastCheck.criteria) {
    req.flash('No recent eligibility check found to save. Please run a check first.', 'warning');
    return res.redirect('/subsidy-checker');
  }

  const newId = assessmentSeq++;
  const assessmentRecord: SavedAssessment = {
    id: newId,
    user_id: user.id,
    criteria: lastCheck.criteria,
    results: lastCheck.matched || [],
    match_count: (lastCheck.matched || []).length,
    created_at: formatDateTime(),
  };

  savedAssessments.set(newId, assessmentRecord);
  req.flash('Your scheme eligibility assessment has been saved securely to your account.', 'success');
  res.redirect('/my-saved-schemes');
});

// View My Saved Scheme Assessments
app.get('/my-saved-schemes', loginRequired, (req, res) => {
  const user = req.currentUser!;
  const myAssessments = Array.from(savedAssessments.values()).filter(a => a.user_id === user.id);
  myAssessments.sort((a, b) => b.id - a.id);

  renderView(req, res, 'saved_schemes.html', {
    endpoint: 'my_saved_schemes',
    assessments: myAssessments,
    user,
  });
});

// Error handlers
app.use((req: Request, res: Response) => {
  renderView(req, res, '404.html', { endpoint: 'not_found' }, 404);
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  renderView(req, res, '500.html', { endpoint: 'server_error' }, 500);
});

// --------------------------------------------------------------------------
// Start Server
// --------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`AGRICONNECT server running on http://${HOST}:${PORT}`);
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
});
