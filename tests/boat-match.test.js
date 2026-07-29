/**
 * Unit tests for the pure boat-match decision used by the create-payment-intent
 * edge function. The edge fn itself is Deno + Stripe + supabase (no test harness
 * in this repo), so the id-first / heuristic-fallback decision is extracted into
 * supabase/functions/_shared/boat-match.ts and tested here.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeLeadBoatId,
  boatLookupPlan,
} from '../supabase/functions/_shared/boat-match.ts';

const PROVIDER = '11111111-1111-1111-1111-111111111111';

describe('normalizeLeadBoatId', () => {
  it('returns null for absent / empty / non-string values', () => {
    expect(normalizeLeadBoatId(undefined)).toBeNull();
    expect(normalizeLeadBoatId(null)).toBeNull();
    expect(normalizeLeadBoatId('')).toBeNull();
    expect(normalizeLeadBoatId('   ')).toBeNull();
    expect(normalizeLeadBoatId(42)).toBeNull();
  });

  it('trims and returns a real id', () => {
    expect(normalizeLeadBoatId('  boat-123 ')).toBe('boat-123');
  });
});

describe('boatLookupPlan', () => {
  it('with a leadBoatId: provider-scoped id lookup FIRST, heuristic fallback', () => {
    const plan = boatLookupPlan('boat-123', PROVIDER);
    expect(plan).toEqual([
      { kind: 'id', id: 'boat-123', providerOwnerUserId: PROVIDER },
      { kind: 'heuristic' },
    ]);
  });

  it('without a leadBoatId (old link / organic): heuristic only', () => {
    const plan = boatLookupPlan(null, PROVIDER);
    expect(plan).toEqual([{ kind: 'heuristic' }]);
  });

  it('the id lookup is always scoped to the resolved provider', () => {
    const [first] = boatLookupPlan('boat-xyz', PROVIDER);
    expect(first).toMatchObject({ kind: 'id', providerOwnerUserId: PROVIDER });
  });

  it('a stale/foreign id still has the heuristic as a fallback in the plan', () => {
    // The edge fn runs the id lookup (scoped to PROVIDER); a foreign id returns
    // no row and the loop falls through to this second entry.
    const plan = boatLookupPlan('foreign-boat', PROVIDER);
    expect(plan[plan.length - 1]).toEqual({ kind: 'heuristic' });
  });
});
