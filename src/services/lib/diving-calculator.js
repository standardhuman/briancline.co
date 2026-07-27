/**
 * Diving calculator - ported from sailorskills-estimator
 * Supports all 6 service types with correct pricing logic.
 */

// ── Service Definitions ──
export const SERVICES = {
  cleaning: {
    key: "cleaning",
    name: "Cleaning & Anodes",
    type: "per_foot",
    description: "Hull cleaning with anode inspection.",
  },
  underwater_inspection: {
    key: "underwater_inspection",
    name: "Underwater Inspection",
    type: "per_foot",
    description: "Photo/video documentation for insurance, surveys, or damage assessment.",
  },
  item_recovery: {
    key: "item_recovery",
    name: "Item Recovery",
    type: "flat",
    description: "Recovery of lost items. Up to 45 min search.",
  },
  propeller_service: {
    key: "propeller_service",
    name: "Propeller Service",
    type: "flat",
    description: "Professional propeller removal or installation.",
  },
  anodes_only: {
    key: "anodes_only",
    name: "Anodes Only",
    type: "flat",
    description: "Anode inspection and replacement only.",
  },
};

// ── Rates (legacy export) ──
const RATES = {
  recurring: 4.50,
  onetime: 6.00,
  inspection: 3.99,
  itemRecovery: 149,
  propellerService: 349,
  anodesOnlyMin: 99,
  minimum: 150.00,
  anode: 15.00,
};

const SURCHARGES = {
  powerboat: 0.25,
  catamaran: 0.25,
  trimaran: 0.50,
};

// ── Which input cards to show per service ──
export const SERVICE_VISIBILITY = {
  cleaning:              { boatLength: true, boatType: true, frequency: true, propellers: true, paintAge: true, lastCleaned: true, anodes: true },
  underwater_inspection: { boatLength: true, boatType: true, frequency: false, propellers: false, paintAge: false, lastCleaned: false, anodes: false },
  item_recovery:         { boatLength: false, boatType: false, frequency: false, propellers: false, paintAge: false, lastCleaned: false, anodes: false },
  propeller_service:     { boatLength: false, boatType: false, frequency: false, propellers: true, paintAge: false, lastCleaned: false, anodes: false },
  anodes_only:           { boatLength: false, boatType: false, frequency: false, propellers: false, paintAge: false, lastCleaned: false, anodes: true },
};

// ── Hull fouling matrix (v2.0) ──
const SEVERITY = {
  "MIN":   { label: "Minimal",          surcharge: 0 },
  "M-MOD": { label: "Minimal-Moderate", surcharge: 0 },
  "MOD":   { label: "Moderate",         surcharge: 0 },
  "M-H":   { label: "Moderate-Heavy",   surcharge: 0.375 },
  "H":     { label: "Heavy",            surcharge: 0.50 },
  "H-S":   { label: "Heavy-Severe",     surcharge: 0.75 },
  "S":     { label: "Severe",           surcharge: 1.00 },
  "SEV":   { label: "Severe (Maximum)", surcharge: 2.00 },
};

const PAINT_COLS = ["<6mo", "6-12mo", "1-1.5yr", "1.5-2yr", "2+yr"];

const MATRIX = {
  "<2":    ["MIN",  "MIN",   "MIN",  "MOD",  "M-H"],
  "2-4":   ["MIN",  "M-MOD", "M-MOD","MOD",  "M-H"],
  "5-6":   ["MOD",  "MOD",   "MOD",  "M-H",  "H"],
  "7-8":   [null,   "M-H",   "M-H",  "H",    "H-S"],
  "9-12":  [null,   null,    "H",    "H-S",  "SEV"],
  "13-24": [null,   null,    "H-S",  "S",    "SEV"],
  "24+":   [null,   null,    null,   "S",    "SEV"],
};

export function lookupFouling(paintAge, lastCleaned) {
  const colIdx = PAINT_COLS.indexOf(paintAge);
  if (colIdx === -1) return { severity: "SEV", ...SEVERITY.SEV };
  const row = MATRIX[lastCleaned];
  if (!row) return { severity: "SEV", ...SEVERITY.SEV };
  let code = row[colIdx];
  if (code === null) {
    for (let i = colIdx + 1; i < row.length; i++) {
      if (row[i] !== null) {
        return { severity: row[i], ...SEVERITY[row[i]] };
      }
    }
    return { severity: "SEV", ...SEVERITY.SEV };
  }
  return { severity: code, ...(SEVERITY[code] || SEVERITY.SEV) };
}

// ── Main calculator ──
export function calculateEstimate({
  serviceKey = "cleaning",
  boatLength = 35,
  boatType = "sailboat",
  hullType = "monohull",
  frequency = "monthly",
  propellerCount = 1,
  paintAge = "<6mo",
  lastCleaned = "<2",
  anodeCount = 0,
}) {
  const service = SERVICES[serviceKey];
  if (!service) return { items: [], subtotal: 0, total: 0, minimumApplied: false, rate: 0, isOneTime: true, fouling: null };

  // ── Flat-rate services ──
  if (serviceKey === "item_recovery") {
    return {
      items: [{ label: "Item Recovery", detail: "Flat rate", amount: 149 }],
      subtotal: 199,
      total: 199,
      minimumApplied: false,
      rate: 199,
      isOneTime: true,
      fouling: null,
    };
  }

  if (serviceKey === "propeller_service") {
    const count = Math.max(1, propellerCount);
    const total = 349 * count;
    return {
      items: [{ label: "Propeller Service", detail: `${count} × $349`, amount: total }],
      subtotal: total,
      total,
      minimumApplied: false,
      rate: 349,
      isOneTime: true,
      fouling: null,
    };
  }

  if (serviceKey === "anodes_only") {
    const count = Math.max(0, anodeCount);
    const anodeCost = count * 15;
    const total = Math.max(RATES.minimum, anodeCost);
    const items = [];
    if (count > 0) {
      items.push({ label: "Anode installation", detail: `${count} × $15`, amount: anodeCost });
    }
    const minimumApplied = anodeCost < RATES.minimum;
    if (minimumApplied) {
      items.push({ label: "Minimum service charge", detail: "", amount: RATES.minimum });
    }
    return {
      items,
      subtotal: anodeCost || 149,
      total,
      minimumApplied,
      rate: 15,
      isOneTime: true,
      fouling: null,
    };
  }

  // ── Per-foot services (cleaning, inspection) ──
  const isOneTime = serviceKey === "underwater_inspection" || frequency === "onetime";
  let rate;
  if (serviceKey === "underwater_inspection") rate = RATES.inspection;
  else if (frequency === "onetime") rate = RATES.onetime;
  else rate = RATES.recurring;

  const baseCost = rate * boatLength;
  const items = [];

  items.push({
    label: "Base rate",
    detail: `$${rate}/ft × ${boatLength}ft`,
    amount: baseCost,
  });

  let surchargeTotal = 0;

  // Boat type surcharge (powerboat)
  if (boatType === "powerboat") {
    const pct = SURCHARGES.powerboat;
    const amt = baseCost * pct;
    surchargeTotal += amt;
    items.push({
      label: "Powerboat surcharge",
      detail: `+${(pct * 100).toFixed(0)}%`,
      amount: amt,
    });
  }

  // Hull type surcharge (catamaran / trimaran)
  if (hullType === "catamaran") {
    const pct = SURCHARGES.catamaran;
    const amt = baseCost * pct;
    surchargeTotal += amt;
    items.push({
      label: "Catamaran surcharge",
      detail: `+${(pct * 100).toFixed(0)}%`,
      amount: amt,
    });
  } else if (hullType === "trimaran") {
    const pct = SURCHARGES.trimaran;
    const amt = baseCost * pct;
    surchargeTotal += amt;
    items.push({
      label: "Trimaran surcharge",
      detail: `+${(pct * 100).toFixed(0)}%`,
      amount: amt,
    });
  }

  // Propeller surcharge (cleaning services only)
  if ((serviceKey === "cleaning") && propellerCount > 1) {
    const additional = propellerCount - 1;
    const pct = additional * 0.10;
    const amt = baseCost * pct;
    surchargeTotal += amt;
    items.push({
      label: `Additional propeller${additional > 1 ? "s" : ""}`,
      detail: `+${(pct * 100).toFixed(0)}%`,
      amount: amt,
    });
  }

  // Growth surcharge (cleaning services only)
  let fouling = null;
  if (serviceKey === "cleaning") {
    fouling = lookupFouling(paintAge, lastCleaned);
    if (fouling.surcharge > 0) {
      const amt = baseCost * fouling.surcharge;
      surchargeTotal += amt;
      items.push({
        label: `Est. growth (${fouling.label})`,
        detail: `+${(fouling.surcharge * 100).toFixed(0)}%`,
        amount: amt,
      });
    }
  }

  // Anode installation (cleaning services only)
  let anodeCost = 0;
  if ((serviceKey === "cleaning") && anodeCount > 0) {
    anodeCost = anodeCount * RATES.anode;
    items.push({
      label: "Anode installation",
      detail: `${anodeCount} × $${RATES.anode}`,
      amount: anodeCost,
    });
  }

  const subtotal = baseCost + surchargeTotal + anodeCost;
  const minimumApplied = subtotal > 0 && subtotal < RATES.minimum;
  const total = minimumApplied ? RATES.minimum : subtotal;

  return {
    items,
    subtotal,
    total,
    minimumApplied,
    rate,
    isOneTime,
    fouling,
  };
}

// ── Public-facing hull-condition tiers ─────────────────────────────────────
// The internal fouling matrix has eight severity codes with fine-grained
// surcharges. For customer-facing display we collapse them onto four plain
// tiers a boat owner can reason about. Light and Moderate are both 0% growth
// (they price identically) and are shown together as "Light–Moderate". These
// surcharges are a strict subset of the SEVERITY table above — no new rates.
export const CONDITION_TIERS = [
  { key: "light",    label: "Light",    surcharge: 0 },
  { key: "moderate", label: "Moderate", surcharge: 0 },
  { key: "heavy",    label: "Heavy",    surcharge: 0.50 },
  { key: "severe",   label: "Severe",   surcharge: 1.00 },
];

// Which display tier a predicted matrix severity lands in. The in-between
// matrix codes (M-H 37.5%, H-S 75%, and the rare Severe-Maximum 200%) round to
// the nearest plain tier so we can point the customer at one expected condition.
const SEVERITY_TO_TIER = {
  "MIN": 0, "M-MOD": 1, "MOD": 1, "M-H": 2, "H": 2, "H-S": 3, "S": 3, "SEV": 3,
};

/**
 * Build the conditions-based price range for a hull cleaning. Returns null for
 * any non-cleaning service (nothing else carries a growth surcharge) or an
 * unusable boat length. The math mirrors calculateEstimate exactly: growth is
 * the only axis that varies, applied as a percentage of the base rate on top of
 * the fixed base + boat-type/prop/anode charges. No new rates are introduced.
 *
 * When paintAge/lastCleaned identify a matrix cell, `predictedTier` is the
 * expected condition and rangeLow/rangeHigh span that tier ± one tier. When
 * they don't (e.g. an organic visitor with no condition inputs), there is no
 * prediction and the range spans the full Light–Severe ladder.
 */
export function conditionPriceRange({
  serviceKey = "cleaning",
  boatLength = 35,
  boatType = "sailboat",
  hullType = "monohull",
  frequency = "monthly",
  propellerCount = 1,
  paintAge = "<6mo",
  lastCleaned = "<2",
  anodeCount = 0,
} = {}) {
  if (serviceKey !== "cleaning") return null;

  const len = parseInt(boatLength, 10);
  if (!len || len < 1) return null;

  // Everything except growth, computed once by forcing the cleanest matrix cell
  // (Minimal = 0% growth). `base` is the amount the growth percentage applies to.
  const clean = calculateEstimate({
    serviceKey, boatLength: len, boatType, hullType, frequency,
    propellerCount, paintAge: "<6mo", lastCleaned: "<2", anodeCount,
  });
  const base = clean.rate * len;
  const subtotalNoGrowth = clean.subtotal;

  const tiers = CONDITION_TIERS.map((tier) => {
    const subtotal = subtotalNoGrowth + base * tier.surcharge;
    const minimumApplied = subtotal > 0 && subtotal < RATES.minimum;
    return {
      key: tier.key,
      label: tier.label,
      surcharge: tier.surcharge,
      total: minimumApplied ? RATES.minimum : subtotal,
      minimumApplied,
    };
  });

  const hasPrediction =
    PAINT_COLS.includes(paintAge) &&
    Object.prototype.hasOwnProperty.call(MATRIX, lastCleaned);
  const fouling = hasPrediction ? lookupFouling(paintAge, lastCleaned) : null;
  const predictedIndex = hasPrediction ? (SEVERITY_TO_TIER[fouling.severity] ?? 1) : null;

  const lowIndex = predictedIndex == null ? 0 : Math.max(0, predictedIndex - 1);
  const highIndex = predictedIndex == null
    ? CONDITION_TIERS.length - 1
    : Math.min(CONDITION_TIERS.length - 1, predictedIndex + 1);

  return {
    tiers,
    isOneTime: clean.isOneTime,
    hasPrediction,
    fouling,
    predictedIndex,
    predictedTier: predictedIndex == null ? null : tiers[predictedIndex],
    lowIndex,
    highIndex,
    rangeLow: tiers[lowIndex].total,
    rangeHigh: tiers[highIndex].total,
  };
}

/**
 * Collapse the four condition tiers into display rows, merging adjacent tiers
 * that share a surcharge (Light + Moderate, both 0%) into one labeled row so
 * the customer never sees two identically-priced rows. Returns rows in
 * ascending price, each carrying the tier keys it represents.
 */
export function conditionDisplayRows(tiers) {
  const rows = [];
  for (const tier of tiers) {
    const last = rows[rows.length - 1];
    if (last && last.surcharge === tier.surcharge) {
      last.keys.push(tier.key);
      last.labelHigh = tier.label;
    } else {
      rows.push({
        keys: [tier.key],
        labelLow: tier.label,
        labelHigh: tier.label,
        surcharge: tier.surcharge,
        total: tier.total,
        minimumApplied: tier.minimumApplied,
      });
    }
  }
  return rows.map((r) => ({
    keys: r.keys,
    label: r.labelLow === r.labelHigh ? r.labelLow : `${r.labelLow}–${r.labelHigh}`,
    surcharge: r.surcharge,
    total: r.total,
    minimumApplied: r.minimumApplied,
  }));
}

export { RATES };
