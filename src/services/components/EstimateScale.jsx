import React from "react";
import { cn, formatCurrency } from "../lib/utils";

/**
 * The graphical estimate scale — a horizontal min → worst-case bar with a marker
 * at OUR predicted estimate. Renders the output of estimateScale() (ported from
 * SailorSkills Pro's calculateEstimateRange), the same range the field-capture
 * flow texts a customer before they land here. Pass `scale={null}` and it renders
 * nothing, so callers can drop it in unconditionally.
 *
 * `markerPrice` (optional) overrides the marked value with the estimate we
 * actually quoted — the `estimate` query param the checkout link carries — so the
 * number on the page matches the number the customer was texted, even if the two
 * estimators drift on a growth cell. When absent, the local prediction is used.
 * With no prediction at all (organic visitor), the bar shows the full span and no
 * marker.
 */
export default function EstimateScale({ scale, markerPrice, className }) {
  if (!scale || scale.single) return null;

  const perVisit = scale.isOneTime ? "" : " per visit";
  const span = scale.maxPrice - scale.minPrice;

  // Prefer the quoted estimate (URL param) for the marker; fall back to the local
  // prediction. Only show a marker when we have one of the two.
  const quoted = Number.isFinite(markerPrice) && markerPrice > 0 ? markerPrice : null;
  const markerValue = quoted ?? (scale.hasPrediction ? scale.predictedPrice : null);
  const showMarker = markerValue != null;

  const markerFraction =
    quoted != null
      ? Math.min(1, Math.max(0, span > 0 ? (quoted - scale.minPrice) / span : 0))
      : scale.markerFraction;
  const pct = Math.round(markerFraction * 100);

  return (
    <div className={cn("w-full", className)} data-testid="estimate-scale">
      <p className="font-medium text-gray-900 text-sm mb-1">Where your estimate falls</p>
      <p className="text-xs text-gray-500 mb-4">
        The final price depends on the marine growth we find at service time. Your
        estimate sits on this range from a freshly-cleaned hull to the worst case.
      </p>

      {/* Marker callout */}
      {showMarker && (
        <div className="relative h-9 mb-1">
          <div
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${pct}%` }}
          >
            <span className="inline-block rounded-md bg-[#0073a8] px-2 py-1 text-xs font-semibold text-white shadow-sm tabular-nums">
              Our estimate: {formatCurrency(markerValue)}
            </span>
            <span className="block mx-auto h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-[#0073a8]" />
          </div>
        </div>
      )}

      {/* Track: calm (freshly cleaned) → intense (worst case) */}
      <div className="relative">
        <div
          className="h-3 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #a7f3d0 0%, #fde68a 55%, #fecaca 100%)",
          }}
        />
        {showMarker && (
          <span
            className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0073a8] ring-2 ring-white"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>

      {/* Endpoint labels */}
      <div className="mt-2 flex items-start justify-between text-xs">
        <div className="text-left">
          <p className="font-semibold text-gray-700 tabular-nums">
            {formatCurrency(scale.minPrice)}
          </p>
          <p className="text-gray-400">Freshly cleaned</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-gray-700 tabular-nums">
            {formatCurrency(scale.maxPrice)}
          </p>
          <p className="text-gray-400">Worst case</p>
        </div>
      </div>
    </div>
  );
}
