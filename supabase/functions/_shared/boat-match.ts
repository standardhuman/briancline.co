// Boat-match decision for create-payment-intent — which existing boat (if any)
// an incoming order attaches to.
//
// Background: the field-capture flow (SailorSkills Pro) creates a `pending` lead
// boat, then hands the customer a checkout link. When the customer completes
// checkout the order must attach to THAT boat, not create a duplicate. The
// historical match was `(customer_id, name) OR (customer_email, name)`, but Pro
// never sets customer_id and a phone-only lead has no email — so phone-only or
// placeholder-named leads always stranded (a duplicate boat was created and the
// pending lead orphaned). Pro's link now carries an explicit `leadBoatId`.
//
// This module is the PURE decision layer (no Deno / Stripe / supabase imports)
// so it is unit-testable from the site's vitest suite. The edge function runs
// the actual queries the plan describes and feeds the rows back through
// `chooseExistingBoat`.

/** Normalize a client-supplied leadBoatId. Empty / non-string / whitespace ⇒
 *  null, which the plan treats as "no id, use the heuristic only". */
export function normalizeLeadBoatId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** A single lookup the edge function should attempt, in order. */
export type BoatLookup =
  | {
      /** Exact lead-boat id, scoped to the resolved provider so a stale/foreign
       *  id returns no row (and falls through to the heuristic). */
      kind: 'id';
      id: string;
      providerOwnerUserId: string;
    }
  | {
      /** Legacy heuristic: (customer_id, name) OR (customer_email, name). */
      kind: 'heuristic';
    };

/**
 * The ordered lookups to attempt. When a leadBoatId is present, the
 * provider-scoped id lookup goes FIRST; the heuristic is always the fallback, so
 * old links (no leadBoatId) and a stale/foreign id both resolve exactly as they
 * did before. The caller runs each lookup in order and takes the first that
 * returns a row. Pure — no I/O.
 */
export function boatLookupPlan(
  leadBoatId: string | null,
  providerOwnerUserId: string,
): BoatLookup[] {
  const plan: BoatLookup[] = [];
  if (leadBoatId) plan.push({ kind: 'id', id: leadBoatId, providerOwnerUserId });
  plan.push({ kind: 'heuristic' });
  return plan;
}
