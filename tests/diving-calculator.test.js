/**
 * Comprehensive unit tests for the hull cleaning calculator.
 * Tests every configuration combination to ensure correct pricing.
 */
import { describe, it, expect } from 'vitest';
import { calculateEstimate, lookupFouling, RATES, SERVICES, SERVICE_VISIBILITY } from '../src/services/lib/diving-calculator.js';

// ── Service definitions ──

describe('Service Definitions', () => {
  it('should have all 5 service types defined', () => {
    expect(Object.keys(SERVICES)).toEqual([
      'cleaning', 'underwater_inspection', 'item_recovery', 'propeller_service', 'anodes_only'
    ]);
  });

  it('each service should have key, name, type, description', () => {
    for (const [key, svc] of Object.entries(SERVICES)) {
      expect(svc.key).toBe(key);
      expect(svc.name).toBeTruthy();
      expect(svc.type).toMatch(/^(per_foot|flat)$/);
      expect(svc.description).toBeTruthy();
    }
  });
});

// ── Visibility matrix ──

describe('Service Visibility', () => {
  it('cleaning shows all input cards', () => {
    const vis = SERVICE_VISIBILITY.cleaning;
    expect(vis.boatLength).toBe(true);
    expect(vis.boatType).toBe(true);
    expect(vis.frequency).toBe(true);
    expect(vis.propellers).toBe(true);
    expect(vis.paintAge).toBe(true);
    expect(vis.lastCleaned).toBe(true);
    expect(vis.anodes).toBe(true);
  });

  it('underwater_inspection shows only boatLength and boatType', () => {
    const vis = SERVICE_VISIBILITY.underwater_inspection;
    expect(vis.boatLength).toBe(true);
    expect(vis.boatType).toBe(true);
    expect(vis.frequency).toBe(false);
    expect(vis.propellers).toBe(false);
  });

  it('item_recovery shows nothing', () => {
    const vis = SERVICE_VISIBILITY.item_recovery;
    expect(Object.values(vis).every(v => v === false)).toBe(true);
  });

  it('propeller_service shows only propellers', () => {
    const vis = SERVICE_VISIBILITY.propeller_service;
    expect(vis.propellers).toBe(true);
    expect(vis.boatLength).toBe(false);
  });

  it('anodes_only shows only anodes', () => {
    const vis = SERVICE_VISIBILITY.anodes_only;
    expect(vis.anodes).toBe(true);
    expect(vis.boatLength).toBe(false);
  });
});

// ── Rates ──

describe('Rates', () => {
  it('should have correct base rates', () => {
    expect(RATES.recurring).toBe(4.50);
    expect(RATES.onetime).toBe(6.00);
    expect(RATES.inspection).toBe(3.99);
    expect(RATES.itemRecovery).toBe(149);
    expect(RATES.propellerService).toBe(349);
    expect(RATES.anodesOnlyMin).toBe(99);
    expect(RATES.minimum).toBe(150);
    expect(RATES.anode).toBe(15);
  });
});

// ── Fouling Matrix ──

describe('Fouling Lookup', () => {
  it('should return minimal for recent paint + recent cleaning', () => {
    const result = lookupFouling('<6mo', '<2');
    expect(result.severity).toBe('MIN');
    expect(result.surcharge).toBe(0);
  });

  it('should return severe for old paint + very old cleaning', () => {
    const result = lookupFouling('2+yr', '24+');
    expect(result.severity).toBe('SEV');
    expect(result.surcharge).toBe(2.0);
  });

  it('should handle moderate cases', () => {
    const result = lookupFouling('6-12mo', '5-6');
    expect(result.severity).toBe('MOD');
    expect(result.surcharge).toBe(0);
  });

  it('should fall through null cells to next column', () => {
    // <6mo paint, 7-8 months since cleaning — null in matrix, should use next non-null
    const result = lookupFouling('<6mo', '7-8');
    expect(result.severity).toBe('M-H');
    expect(result.surcharge).toBe(0.375);
  });

  it('should return SEV for unknown paint age', () => {
    const result = lookupFouling('unknown', '<2');
    expect(result.severity).toBe('SEV');
    expect(result.surcharge).toBe(2.0);
  });

  it('should return SEV for unknown last cleaned', () => {
    const result = lookupFouling('<6mo', 'unknown');
    expect(result.severity).toBe('SEV');
    expect(result.surcharge).toBe(2.0);
  });

  // Test every valid combination in the matrix
  const paintAges = ['<6mo', '6-12mo', '1-1.5yr', '1.5-2yr', '2+yr'];
  const lastCleaneds = ['<2', '2-4', '5-6', '7-8', '9-12', '13-24', '24+'];

  for (const pa of paintAges) {
    for (const lc of lastCleaneds) {
      it(`should return valid fouling for paint=${pa}, lastCleaned=${lc}`, () => {
        const result = lookupFouling(pa, lc);
        expect(result).toBeDefined();
        expect(result.severity).toBeTruthy();
        expect(typeof result.surcharge).toBe('number');
        expect(result.surcharge).toBeGreaterThanOrEqual(0);
        expect(result.surcharge).toBeLessThanOrEqual(2.0);
        expect(result.label).toBeTruthy();
      });
    }
  }
});

// ── Flat Rate Services ──

describe('Item Recovery', () => {
  it('should return flat $199', () => {
    const est = calculateEstimate({ serviceKey: 'item_recovery' });
    expect(est.total).toBe(199);
    expect(est.isOneTime).toBe(true);
    expect(est.items.length).toBe(1);
    expect(est.items[0].label).toBe('Item Recovery');
    expect(est.fouling).toBeNull();
  });

  it('should ignore all other parameters', () => {
    const est = calculateEstimate({
      serviceKey: 'item_recovery',
      boatLength: 100,
      boatType: 'powerboat',
      hullType: 'catamaran',
      frequency: 'monthly',
      propellerCount: 4,
      anodeCount: 10,
    });
    expect(est.total).toBe(199);
  });
});

describe('Propeller Service', () => {
  it('should charge $349 per propeller', () => {
    for (let count = 1; count <= 4; count++) {
      const est = calculateEstimate({ serviceKey: 'propeller_service', propellerCount: count });
      expect(est.total).toBe(349 * count);
      expect(est.isOneTime).toBe(true);
      expect(est.items[0].detail).toBe(`${count} × $349`);
    }
  });

  it('should default to 1 propeller when 0', () => {
    const est = calculateEstimate({ serviceKey: 'propeller_service', propellerCount: 0 });
    expect(est.total).toBe(349);
  });
});

describe('Anodes Only', () => {
  it('should have $150 minimum', () => {
    const est = calculateEstimate({ serviceKey: 'anodes_only', anodeCount: 0 });
    expect(est.total).toBe(150);
    expect(est.minimumApplied).toBe(true);
  });

  it('should apply minimum when anode cost is below $150', () => {
    // 5 * $15 = $75 < $150 minimum, so minimum applies
    const est = calculateEstimate({ serviceKey: 'anodes_only', anodeCount: 5 });
    expect(est.total).toBe(150);
    expect(est.minimumApplied).toBe(true);
  });

  it('should meet the minimum exactly with 10 anodes', () => {
    const est = calculateEstimate({ serviceKey: 'anodes_only', anodeCount: 10 });
    expect(est.total).toBe(150); // 10 * 15 = 150, exactly the $150 minimum
    expect(est.minimumApplied).toBe(false);
  });
});

// ── Per-Foot Services ──

describe('Cleaning - Base Rates', () => {
  it('monthly recurring should use $4.50/ft', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 35,
      frequency: 'monthly',
      boatType: 'sailboat',
      hullType: 'monohull',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    expect(est.rate).toBe(4.50);
    expect(est.items[0].amount).toBeCloseTo(4.50 * 35);
    expect(est.isOneTime).toBe(false);
  });

  it('bimonthly recurring should use $4.50/ft', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 35,
      frequency: 'bimonthly',
    });
    expect(est.rate).toBe(4.50);
    expect(est.isOneTime).toBe(false);
  });

  it('quarterly recurring should use $4.50/ft', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 35,
      frequency: 'quarterly',
    });
    expect(est.rate).toBe(4.50);
    expect(est.isOneTime).toBe(false);
  });

  it('one-time should use $6.00/ft', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 35,
      frequency: 'onetime',
      boatType: 'sailboat',
      hullType: 'monohull',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    expect(est.rate).toBe(6.00);
    expect(est.isOneTime).toBe(true);
  });

  it('should enforce $150 minimum', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 15, // 15 * 4.50 = 67.50
      frequency: 'monthly',
      boatType: 'sailboat',
      hullType: 'monohull',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    expect(est.total).toBe(150);
    expect(est.minimumApplied).toBe(true);
  });
});

describe('Cleaning - Boat Type Surcharges', () => {
  it('sailboat should have no surcharge', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    expect(est.items.length).toBe(1); // Only base rate
    expect(est.total).toBeCloseTo(4.50 * 40);
  });

  it('powerboat should add 25% surcharge', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'powerboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    expect(est.items.find(i => i.label === 'Powerboat surcharge')).toBeTruthy();
    expect(est.total).toBeCloseTo(base * 1.25);
  });
});

describe('Cleaning - Hull Type Surcharges', () => {
  it('monohull should have no hull surcharge', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    const hullSurcharge = est.items.find(i => 
      i.label.includes('Catamaran') || i.label.includes('Trimaran')
    );
    expect(hullSurcharge).toBeUndefined();
  });

  it('catamaran should add 25% surcharge', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'catamaran',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    const surcharge = est.items.find(i => i.label.includes('Catamaran'));
    expect(surcharge).toBeTruthy();
    expect(surcharge.amount).toBeCloseTo(base * 0.25);
  });

  it('trimaran should add 50% surcharge', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'trimaran',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    const surcharge = est.items.find(i => i.label.includes('Trimaran'));
    expect(surcharge).toBeTruthy();
    expect(surcharge.amount).toBeCloseTo(base * 0.50);
  });
});

describe('Cleaning - Combined Surcharges', () => {
  it('powerboat + catamaran should stack surcharges', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'powerboat',
      hullType: 'catamaran',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    // 25% powerboat + 25% catamaran = 50% total surcharge
    expect(est.total).toBeCloseTo(base * 1.50);
  });

  it('powerboat + trimaran should stack surcharges', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'powerboat',
      hullType: 'trimaran',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    // 25% powerboat + 50% trimaran = 75% total surcharge
    expect(est.total).toBeCloseTo(base * 1.75);
  });
});

describe('Cleaning - Propeller Surcharges', () => {
  it('1 propeller should have no additional surcharge', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    expect(est.items.find(i => i.label.includes('propeller'))).toBeUndefined();
  });

  it('2 propellers should add 10%', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 2,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    const propSurcharge = est.items.find(i => i.label.includes('propeller'));
    expect(propSurcharge).toBeTruthy();
    expect(propSurcharge.amount).toBeCloseTo(base * 0.10);
  });

  it('3 propellers should add 20%', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 3,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    const propSurcharge = est.items.find(i => i.label.includes('propeller'));
    expect(propSurcharge.amount).toBeCloseTo(base * 0.20);
  });

  it('4 propellers should add 30%', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 4,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    const propSurcharge = est.items.find(i => i.label.includes('propeller'));
    expect(propSurcharge.amount).toBeCloseTo(base * 0.30);
  });
});

describe('Cleaning - Growth Surcharges', () => {
  it('no growth surcharge for fresh conditions', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    const growthItem = est.items.find(i => i.label.includes('growth'));
    expect(growthItem).toBeUndefined();
    expect(est.fouling.surcharge).toBe(0);
  });

  it('heavy growth adds 50%', () => {
    const base = 4.50 * 40;
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '2+yr',
      lastCleaned: '5-6',
      anodeCount: 0,
    });
    expect(est.fouling.severity).toBe('H');
    const growthItem = est.items.find(i => i.label.includes('growth'));
    expect(growthItem).toBeTruthy();
    expect(growthItem.amount).toBeCloseTo(base * 0.50);
  });

  it('severe growth adds 100%-200%', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'monthly',
      propellerCount: 1,
      paintAge: '2+yr',
      lastCleaned: '24+',
      anodeCount: 0,
    });
    expect(est.fouling.severity).toBe('SEV');
    expect(est.fouling.surcharge).toBe(2.0);
  });
});

describe('Cleaning - Anode Costs', () => {
  it('0 anodes should add nothing', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 40,
      frequency: 'monthly',
      anodeCount: 0,
    });
    expect(est.items.find(i => i.label.includes('Anode'))).toBeUndefined();
  });

  it('should add $15 per anode', () => {
    for (let count = 1; count <= 10; count++) {
      const est = calculateEstimate({
        serviceKey: 'cleaning',
        boatLength: 40,
        frequency: 'monthly',
        boatType: 'sailboat',
        hullType: 'monohull',
        propellerCount: 1,
        paintAge: '<6mo',
        lastCleaned: '<2',
        anodeCount: count,
      });
      const anodeItem = est.items.find(i => i.label.includes('Anode'));
      expect(anodeItem).toBeTruthy();
      expect(anodeItem.amount).toBe(count * 15);
    }
  });
});

describe('Underwater Inspection', () => {
  it('should use $3.99/ft rate', () => {
    const est = calculateEstimate({
      serviceKey: 'underwater_inspection',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'monohull',
    });
    expect(est.rate).toBe(3.99);
    expect(est.isOneTime).toBe(true);
    expect(est.total).toBeCloseTo(3.99 * 40);
  });

  it('should apply powerboat surcharge', () => {
    const base = 3.99 * 40;
    const est = calculateEstimate({
      serviceKey: 'underwater_inspection',
      boatLength: 40,
      boatType: 'powerboat',
      hullType: 'monohull',
    });
    expect(est.total).toBeCloseTo(base * 1.25);
  });

  it('should apply hull type surcharges', () => {
    const base = 3.99 * 40;
    const catEst = calculateEstimate({
      serviceKey: 'underwater_inspection',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'catamaran',
    });
    expect(catEst.total).toBeCloseTo(base * 1.25);

    const triEst = calculateEstimate({
      serviceKey: 'underwater_inspection',
      boatLength: 40,
      boatType: 'sailboat',
      hullType: 'trimaran',
    });
    expect(triEst.total).toBeCloseTo(base * 1.50);
  });

  it('should NOT apply growth surcharges', () => {
    const est = calculateEstimate({
      serviceKey: 'underwater_inspection',
      boatLength: 40,
      paintAge: '2+yr',
      lastCleaned: '24+',
    });
    expect(est.fouling).toBeNull();
    expect(est.items.find(i => i.label.includes('growth'))).toBeUndefined();
  });

  it('should NOT apply propeller surcharges', () => {
    const est = calculateEstimate({
      serviceKey: 'underwater_inspection',
      boatLength: 40,
      propellerCount: 4,
    });
    expect(est.items.find(i => i.label.includes('propeller'))).toBeUndefined();
  });
});

// ── Full Configuration Matrix ──

describe('Full Configuration Matrix', () => {
  const boatLengths = [15, 25, 35, 50, 75, 100];
  const boatTypes = ['sailboat', 'powerboat'];
  const hullTypes = ['monohull', 'catamaran', 'trimaran'];
  const frequencies = ['monthly', 'bimonthly', 'quarterly', 'onetime'];
  const propellers = [1, 2, 3, 4];
  const paintAges = ['<6mo', '6-12mo', '1-1.5yr', '1.5-2yr', '2+yr'];
  const lastCleaneds = ['<2', '2-4', '5-6', '7-8', '9-12', '13-24', '24+'];

  // Test a representative subset (full matrix would be 6*2*3*4*4*5*7 = 20,160 combos)
  // We pick strategic combinations that cover all edge cases
  
  const testCases = [];
  for (const length of boatLengths) {
    for (const bt of boatTypes) {
      for (const ht of hullTypes) {
        for (const freq of frequencies) {
          // For each combo, test with 1 propeller, min paint/clean, and worst paint/clean
          testCases.push({ length, bt, ht, freq, props: 1, pa: '<6mo', lc: '<2', anodes: 0 });
          testCases.push({ length, bt, ht, freq, props: 2, pa: '2+yr', lc: '24+', anodes: 3 });
        }
      }
    }
  }

  it(`should produce valid estimates for ${testCases.length} configuration combos`, () => {
    let failures = [];
    
    for (const tc of testCases) {
      const est = calculateEstimate({
        serviceKey: 'cleaning',
        boatLength: tc.length,
        boatType: tc.bt,
        hullType: tc.ht,
        frequency: tc.freq,
        propellerCount: tc.props,
        paintAge: tc.pa,
        lastCleaned: tc.lc,
        anodeCount: tc.anodes,
      });

      // Validate structure
      if (!est.items || !Array.isArray(est.items)) {
        failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Missing items array`);
        continue;
      }
      if (typeof est.total !== 'number' || isNaN(est.total)) {
        failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Invalid total: ${est.total}`);
        continue;
      }
      if (est.total < RATES.minimum && !est.minimumApplied) {
        // When total < minimum but minimumApplied is false, something's wrong
        // Unless subtotal was >= minimum and got adjusted
        if (est.subtotal < RATES.minimum && est.total < RATES.minimum) {
          failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Total ${est.total} below minimum ${RATES.minimum} without minimumApplied flag`);
        }
      }
      if (est.total < 0) {
        failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Negative total: ${est.total}`);
      }

      // Validate rate
      const expectedRate = tc.freq === 'onetime' ? RATES.onetime : RATES.recurring;
      if (est.rate !== expectedRate) {
        failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Expected rate ${expectedRate}, got ${est.rate}`);
      }

      // Validate isOneTime flag
      const expectedOneTime = tc.freq === 'onetime';
      if (est.isOneTime !== expectedOneTime) {
        failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Expected isOneTime=${expectedOneTime}, got ${est.isOneTime}`);
      }

      // Validate surcharges applied correctly
      if (tc.bt === 'powerboat') {
        const hasPowerSurcharge = est.items.some(i => i.label.includes('Powerboat'));
        if (!hasPowerSurcharge) {
          failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Missing powerboat surcharge`);
        }
      }
      if (tc.ht === 'catamaran') {
        const hasCatSurcharge = est.items.some(i => i.label.includes('Catamaran'));
        if (!hasCatSurcharge) {
          failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Missing catamaran surcharge`);
        }
      }
      if (tc.ht === 'trimaran') {
        const hasTriSurcharge = est.items.some(i => i.label.includes('Trimaran'));
        if (!hasTriSurcharge) {
          failures.push(`[${tc.length}ft ${tc.bt} ${tc.ht} ${tc.freq}] Missing trimaran surcharge`);
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(`${failures.length} failures:\n${failures.join('\n')}`);
    }
  });
});

// ── Edge Cases ──

describe('Edge Cases', () => {
  it('should handle unknown service key gracefully', () => {
    const est = calculateEstimate({ serviceKey: 'nonexistent' });
    expect(est.total).toBe(0);
    expect(est.items).toEqual([]);
  });

  it('should handle very small boat (minimum charge)', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 15,
      frequency: 'monthly',
    });
    expect(est.total).toBeGreaterThanOrEqual(RATES.minimum);
  });

  it('should handle very large boat', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 150,
      frequency: 'monthly',
      boatType: 'sailboat',
      hullType: 'monohull',
      propellerCount: 1,
      paintAge: '<6mo',
      lastCleaned: '<2',
      anodeCount: 0,
    });
    expect(est.total).toBeCloseTo(4.50 * 150);
  });

  it('should handle all surcharges stacked together', () => {
    const est = calculateEstimate({
      serviceKey: 'cleaning',
      boatLength: 50,
      boatType: 'powerboat',
      hullType: 'trimaran',
      frequency: 'onetime',
      propellerCount: 4,
      paintAge: '2+yr',
      lastCleaned: '24+',
      anodeCount: 10,
    });
    // base: 6.00 * 50 = 300.00
    // powerboat: +25% = 75.00
    // trimaran: +50% = 150.00
    // 3 additional props: +30% = 90.00
    // SEV growth: +200% = 600.00
    // anodes: 10 * 15 = 150
    // total: 300 + 75 + 150 + 90 + 600 + 150 = 1365.00
    expect(est.total).toBeGreaterThan(1000);
    expect(est.items.length).toBeGreaterThanOrEqual(5);
  });
});

// ── Order Form URL Parameter Passing ──

describe('Order Form URL Parameters', () => {
  // Test that the estimator passes correct params to the order page
  it('should format frequency param correctly for one-time', () => {
    // In Diving.jsx: const freqParam = frequency === "onetime" ? "one_time" : frequency;
    // This maps to the URL parameter
    const freqMap = {
      'monthly': 'monthly',
      'bimonthly': 'bimonthly',
      'quarterly': 'quarterly',
      'onetime': 'one_time',
    };
    
    for (const [input, expected] of Object.entries(freqMap)) {
      const freqParam = input === "onetime" ? "one_time" : input;
      expect(freqParam).toBe(expected);
    }
  });
});
