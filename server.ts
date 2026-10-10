import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction } from 'express';
import nunjucks from 'nunjucks';
import cookieSession from 'cookie-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
  state?: string | null;
  district?: string | null;
  land_size?: number | null;
  preferred_crop?: string | null;
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

interface Scheme {
  id: number;
  name: string;
  description: string;
  level: string;
  category: string;
  states: string;
  min_land: number;
  max_land: number;
  crops: string;
  requires_field_verification: number;
  documents: string[];
  conditions: string[];
  instructions: string;
  official_url: string;
}

interface AdvisoryQuery {
  id: number;
  user_id?: number | null;
  crop_name?: string | null;
  growth_stage?: string | null;
  soil_type?: string | null;
  symptoms?: string | null;
  irrigation?: string | null;
  weather?: string | null;
  created_at: string;
  no_match: boolean;
  result_title?: string | null;
  recommendation?: string | string[] | null;
  summary?: string | null;
  rule_name?: string | null;
  explanation?: string | null;
  matched_conditions: string[];
  next_steps: string[];
  caution?: string | null;
  severity?: string | null;
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

const users: Map<number, User> = new Map();
const listings: Map<number, Listing> = new Map();
const advisoryQueries: Map<number, AdvisoryQuery> = new Map();
const schemes: Map<number, Scheme> = new Map();

function seedData() {
  const now = formatDateShort();
  const demoHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const seedUsers: Array<Omit<User, 'id'>> = [
    {
      name: 'Ramesh Kumar',
      email: DEMO_EMAIL,
      phone: '9848012345',
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

  const rawSchemes = [
    {
      name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      description: 'Central income-support scheme for landholding farmer families, subject to the exclusion criteria published by the Government of India.',
      level: 'Central',
      category: 'Income support',
      states: '',
      min_land: 0,
      max_land: 99999,
      crops: '',
      requires_field_verification: 1,
      documents: ['Aadhaar card', 'Land ownership records (RoR / Khatauni)', 'Bank account details with IFSC', 'Mobile number'],
      conditions: ['Family definition and exclusion criteria must be checked on the official portal', 'Land records must be verified by the local revenue authority', 'Bank account must be Aadhaar-seeded for DBT transfer'],
      instructions: 'Apply through the PM-KISAN portal, the nearest Common Service Centre, or the local agriculture/revenue office. Keep the registration number for e-KYC and beneficiary status checks.',
      official_url: 'https://pmkisan.gov.in/',
    },
    {
      name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
      description: 'Crop insurance cover against notified natural risks for notified crops in notified areas, for both loanee and non-loanee farmers.',
      level: 'Central',
      category: 'Crop insurance',
      states: '',
      min_land: 0,
      max_land: 99999,
      crops: 'Paddy,Wheat,Cotton,Sugarcane,Groundnut,Soybean,Maize,Onion,Tomato,Chilli',
      requires_field_verification: 1,
      documents: ['Land records / tenancy certificate', 'Sowing certificate', 'Aadhaar card', 'Bank passbook', 'Crop details (survey number, area sown)'],
      conditions: ['The crop and the area must be notified for the season', 'Enrolment must happen before the cut-off date announced for the season', 'Loss must be intimated within the prescribed time limit'],
      instructions: 'Enrol through the PMFBY portal, your bank, a Common Service Centre, or an insurance intermediary before the seasonal cut-off date.',
      official_url: 'https://pmfby.gov.in/',
    },
    {
      name: 'Soil Health Card Scheme',
      description: 'Free soil testing and a soil health card with nutrient status and crop-wise fertiliser recommendations for your field.',
      level: 'Central',
      category: 'Soil health',
      states: '',
      min_land: 0,
      max_land: 99999,
      crops: '',
      requires_field_verification: 0,
      documents: ['Land records or farmer identity proof', 'Field survey number'],
      conditions: ['Soil samples must be collected following the prescribed procedure', 'Card validity and re-testing interval follow state guidelines'],
      instructions: 'Contact your nearest soil testing laboratory, Krishi Vigyan Kendra, or agriculture department office to have a sample collected and tested.',
      official_url: 'https://soilhealth.dac.gov.in/',
    },
    {
      name: 'Kisan Credit Card (KCC)',
      description: 'Short-term crop loan facility with a revolving credit limit for cultivation expenses, extended at concessional interest.',
      level: 'Central',
      category: 'Credit',
      states: '',
      min_land: 0,
      max_land: 99999,
      crops: '',
      requires_field_verification: 1,
      documents: ['Identity and address proof', 'Land documents', 'Crop pattern / cropping details', 'Passport-size photographs', 'Bank account details'],
      conditions: ['Credit assessment and documentation are done by the lending bank', 'Interest subvention depends on timely repayment as per scheme rules'],
      instructions: 'Apply at your nearest bank branch, regional rural bank, or cooperative society with land and identity documents.',
      official_url: 'https://www.myscheme.gov.in/',
    },
    {
      name: 'Rythu Bandhu / State Investment Support (illustrative state scheme)',
      description: 'Illustrative state-level investment support scheme for landholding farmers. Configuration, amount and eligibility differ by state — this record is a demonstration entry for the project database.',
      level: 'State',
      category: 'Investment support',
      states: 'Telangana',
      min_land: 0,
      max_land: 99999,
      crops: '',
      requires_field_verification: 1,
      documents: ['Passbook with land details', 'Aadhaar card', 'Bank account details'],
      conditions: ['Scheme is available only in the configured state', 'Land should not fall under the ineligible categories notified by the state', 'Benefit amount and schedule are decided by the state government'],
      instructions: 'Apply through the state agriculture department portal or the nearest revenue/agriculture office during the notified window.',
      official_url: '',
    },
    {
      name: 'Micro Irrigation / Drip & Sprinkler Support (illustrative)',
      description: 'Illustrative support for micro-irrigation systems that improve water-use efficiency. This record demonstrates a scheme with a land-size condition.',
      level: 'Central',
      category: 'Irrigation',
      states: '',
      min_land: 0.5,
      max_land: 99999,
      crops: 'Sugarcane,Banana,Mango,Tomato,Chilli,Cotton,Onion',
      requires_field_verification: 1,
      documents: ['Land records', 'Aadhaar card', 'Bank passbook', 'Quotation from an empanelled supplier', 'Field layout / crop plan'],
      conditions: ['Minimum land holding applies as configured in the database', 'Installation must be carried out by an empanelled supplier', 'Subsidy is released after field verification by the department'],
      instructions: 'Apply through the state horticulture/agriculture department or the national micro-irrigation portal, then complete installation through an empanelled vendor.',
      official_url: 'https://www.myscheme.gov.in/',
    },
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
// Rule-based Advisory Engine
// --------------------------------------------------------------------------
function runAdvisoryEngine(data: Record<string, string>) {
  const symptoms = (data.symptoms || '').toLowerCase();
  let best: { rule: typeof ADVISORY_RULES[0]; matched: string[]; score: number } | null = null;
  let bestScore = 0;

  for (const rule of ADVISORY_RULES) {
    let score = 0;
    const matched: string[] = [];

    if (rule.keywords.some(k => symptoms.includes(k))) {
      score += 2;
      matched.push('Reported symptoms contain an indicator for this rule');
    }
    if (rule.crop && data.crop_name && rule.crop.includes(data.crop_name)) {
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
    return {
      no_match: true,
      title: 'No matching advisory rule',
      summary: NO_MATCH_TEXT,
      recommendation: null as any,
      rule_name: null as any,
      explanation: null as any,
      matched_conditions: [],
      next_steps: [],
      caution: DEFAULT_CAUTION,
      severity: null as any,
    };
  }

  const { rule, matched, score } = best;
  return {
    no_match: false,
    title: rule.title,
    recommendation: rule.recommendation,
    summary: null as any,
    rule_name: rule.name,
    explanation: `Rule ${rule.name} matched your answers on ${score} of its conditions. Higher scores mean more of the rule's conditions were met.`,
    matched_conditions: matched,
    next_steps: rule.next_steps,
    caution: DEFAULT_CAUTION,
    severity: rule.severity,
  };
}

// --------------------------------------------------------------------------
// Subsidy Matcher
// --------------------------------------------------------------------------
function matchSchemes(state?: string | null, district?: string | null, landSize?: any, crop?: string | null) {
  let land: number | null = null;
  if (landSize !== undefined && landSize !== null && landSize !== '') {
    const parsed = parseFloat(landSize);
    if (!isNaN(parsed)) land = parsed;
  }

  const results: any[] = [];

  for (const s of schemes.values()) {
    const why: string[] = [];
    const verify: string[] = [];
    let score = 0;
    let possible = 3;

    const schemeStates = (s.states || '')
      .split(',')
      .map(st => st.trim())
      .filter(Boolean);

    if (schemeStates.length === 0) {
      why.push('Applicable across India (no state restriction configured)');
      score += 1;
    } else if (state && schemeStates.includes(state)) {
      why.push(`Configured for your state (${state})`);
      score += 1;
    } else {
      verify.push(`Scheme is configured for: ${schemeStates.join(', ') || 'other states'}`);
    }

    if (land !== null && s.min_land <= land && land <= s.max_land) {
      why.push(`Land size (${land} acres) is within the configured range`);
      score += 1;
    } else if (land === null) {
      verify.push('Add your land size to check the land-based condition');
    } else {
      verify.push(`Land condition applies (configured range: ${s.min_land}–${s.max_land} acres)`);
    }

    const schemeCrops = (s.crops || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    if (crop && schemeCrops.length > 0) {
      if (schemeCrops.includes(crop)) {
        why.push(`Your crop (${crop}) is covered by this scheme`);
        score += 1;
        possible += 1;
      } else {
        verify.push(`Crop coverage is limited to: ${schemeCrops.join(', ')}`);
      }
    } else if (schemeCrops.length > 0) {
      verify.push(`Crop coverage is limited to: ${schemeCrops.join(', ')}`);
    } else {
      why.push('No crop restriction configured');
      score += 1;
      possible += 1;
    }

    if (s.requires_field_verification) {
      verify.push('Official field verification is required before approval');
    }

    if (why.length === 0) continue;

    const ratio = score / Math.max(possible, 1);
    let status = 'check_conditions';
    if (s.requires_field_verification && ratio < 0.99) {
      status = ratio >= 0.6 ? 'verification_required' : 'check_conditions';
    } else {
      status = ratio >= 0.75 ? 'potential_match' : 'check_conditions';
    }

    results.push({
      id: s.id,
      name: s.name,
      description: s.description,
      level: s.level,
      category: s.category,
      geo_applicability: schemeStates.length > 0 ? schemeStates.join(', ') : 'All India (as configured)',
      eligibility_status: status,
      eligibility_note:
        status === 'potential_match'
          ? 'Your profile broadly matches the basic conditions stored for this scheme. Confirm the remaining conditions with the implementing department.'
          : 'Some conditions could not be confirmed from your profile. Review the listed conditions before applying.',
      match_score: Math.round(Math.min(ratio, 1) * 100),
      why_matched: why,
      conditions_to_verify: verify,
      documents_required: s.documents,
      application_instructions: s.instructions,
      official_url: s.official_url || '',
    });
  }

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
    keys: [process.env.AGRICONNECT_SECRET || 'agriconnect-secret-preview-key'],
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }) as any
);

app.use('/static', express.static(path.join(__dirname, 'static')));

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

  const context: Record<string, any> = {
    current_user,
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
    demo_mode: true,
    demo_credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
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
  const nextUrl = req.body.next || '/dashboard';
  res.redirect(nextUrl);
});

// Register
app.get('/register', (req, res) => {
  renderView(req, res, 'register.html', {
    endpoint: 'register',
  });
});

app.post('/register', (req, res) => {
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
      'register.html',
      {
        endpoint: 'register',
        errors,
        form_data: data,
      },
      400
    );
  }

  const newId = userSeq++;
  const newUser: User = {
    id: newId,
    name: data.full_name,
    email: data.email,
    phone: data.phone || null,
    state: data.state,
    district: data.district,
    land_size: data.land_size ? parseFloat(data.land_size) : null,
    preferred_crop: data.preferred_crop || null,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: formatDateShort(),
  };

  users.set(newId, newUser);
  if (req.session) {
    req.session.user_id = newId;
  }

  req.flash('Your farmer profile has been created. Welcome to AGRICONNECT!', 'success');
  res.redirect('/dashboard');
});

// Logout
app.all('/logout', (req, res) => {
  if (req.session) {
    req.session = null;
  }
  res.redirect('/');
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

  const matchedSchemes = matchSchemes(user.state, user.district, user.land_size, user.preferred_crop);

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
    filtered = filtered.filter(
      l =>
        l.crop_name.toLowerCase().includes(qLower) ||
        (l.description && l.description.toLowerCase().includes(qLower))
    );
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
  });
});

app.post('/crop-advisory', (req, res) => {
  const user = req.currentUser;
  const data = {
    crop_name: (req.body.crop_name || '').trim(),
    growth_stage: (req.body.growth_stage || '').trim(),
    soil_type: (req.body.soil_type || '').trim(),
    symptoms: (req.body.symptoms || '').trim(),
    irrigation: (req.body.irrigation || '').trim(),
    weather: (req.body.weather || '').trim(),
  };

  const errors: Record<string, string> = {};
  const fields = [
    { field: 'crop_name', label: 'crop name' },
    { field: 'growth_stage', label: 'growth stage' },
    { field: 'soil_type', label: 'soil type' },
    { field: 'symptoms', label: 'symptoms' },
    { field: 'irrigation', label: 'irrigation availability' },
  ];

  for (const f of fields) {
    if (!data[f.field as keyof typeof data]) {
      errors[f.field] = `Please provide the ${f.label}.`;
    }
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
      },
      400
    );
  }

  const advisory = runAdvisoryEngine(data);
  const newId = advisorySeq++;
  const queryRecord: AdvisoryQuery = {
    id: newId,
    user_id: user ? user.id : null,
    crop_name: data.crop_name,
    growth_stage: data.growth_stage,
    soil_type: data.soil_type,
    symptoms: data.symptoms,
    irrigation: data.irrigation,
    weather: data.weather,
    created_at: formatDateTime(),
    no_match: advisory.no_match,
    result_title: advisory.title,
    recommendation: advisory.recommendation,
    summary: advisory.summary,
    rule_name: advisory.rule_name,
    explanation: advisory.explanation,
    matched_conditions: advisory.matched_conditions,
    next_steps: advisory.next_steps,
    caution: advisory.caution,
    severity: advisory.severity,
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
    next_steps: q.next_steps,
    caution: q.caution,
    severity: q.severity,
  };

  renderView(req, res, 'advisory_result.html', {
    endpoint: 'advisory_result',
    query: q,
    advisory,
  });
});

// Subsidy Checker
app.get('/subsidy-checker', (req, res) => {
  renderView(req, res, 'subsidy_checker.html', {
    endpoint: 'subsidy_checker',
  });
});

app.post('/subsidy-checker', (req, res) => {
  const criteria = {
    state: (req.body.state || '').trim(),
    district: (req.body.district || '').trim(),
    land_size: (req.body.land_size || '').trim(),
    landholding_category: (req.body.landholding_category || '').trim(),
    crop_type: (req.body.crop_type || '').trim(),
  };

  const errors: Record<string, string> = {};

  if (!criteria.state) {
    errors.state = 'Please select your state.';
  }
  if (!criteria.land_size) {
    errors.land_size = 'Please enter your land size in acres.';
  } else {
    const ls = parseFloat(criteria.land_size);
    if (isNaN(ls)) {
      errors.land_size = 'Land size must be a number.';
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
      },
      400
    );
  }

  const matched = matchSchemes(criteria.state, criteria.district, criteria.land_size, criteria.crop_type);
  if (req.session) {
    req.session.last_subsidy_check = criteria;
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
  const criteria = req.session?.last_subsidy_check;
  if (!criteria) {
    return renderView(req, res, 'subsidy_results.html', {
      endpoint: 'subsidy_results',
      schemes: [],
      criteria: null,
      match_count: 0,
      schemes_checked: schemes.size,
      checked_at: null,
    });
  }

  const matched = matchSchemes(criteria.state, criteria.district, criteria.land_size, criteria.crop_type);

  renderView(req, res, 'subsidy_results.html', {
    endpoint: 'subsidy_results',
    schemes: matched,
    criteria,
    match_count: matched.length,
    schemes_checked: schemes.size,
    checked_at: formatDateTime(),
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
