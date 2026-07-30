/**
 * Decide which price the estimate-scale marker ("Our estimate: $X") should show,
 * or null for NO marker. This is the source the order page feeds to
 * EstimateScale's `markerPrice`.
 *
 * The quoted `estimate` URL param reflects the conditions the diver quoted
 * against — the URL's paintAge/lastCleaned. We keep showing it ONLY while the
 * customer has NOT changed the condition selects away from those URL values AND
 * a matrix prediction exists, so that on first load the pill matches the number
 * we texted the customer. The moment they edit the selects (or there is no
 * prediction), this returns null and EstimateScale falls back to the LIVE local
 * prediction (which moves with the selects) or hides the marker entirely.
 *
 * Fixes the shipped bug (#18 + #17 in play): the static quoted param won the
 * marker forever, so after the customer picked a condition the bar endpoints and
 * tier table reacted but the pill stayed pinned at the quoted value's position —
 * e.g. a $189 quote (the light-growth minimum) stuck at the far left (fraction 0)
 * while the true prediction sat at ~2/3 of the bar.
 *
 * @param {object}  args
 * @param {number|null} args.estimateAmount     The URL `estimate` param (dollars) or null.
 * @param {boolean} args.hasPrediction          Whether the CURRENT selects identify a matrix cell.
 * @param {boolean} args.conditionsMatchQuote   Whether the current selects still equal the URL's.
 * @returns {number|null} the quoted price to mark, or null to defer to the local prediction / hide.
 */
export function resolveScaleMarkerPrice({ estimateAmount, hasPrediction, conditionsMatchQuote }) {
  // Customer changed the conditions the quote was for → the quoted number no
  // longer describes the selection; let the live local prediction win.
  if (!conditionsMatchQuote) return null;
  // No matrix cell (e.g. "Not sure") → never mark a stale quote; show no marker.
  if (!hasPrediction) return null;
  return estimateAmount ?? null;
}
