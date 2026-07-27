import React from "react";
import { Waves } from "lucide-react";
import { cn, formatCurrency } from "../lib/utils";
import { conditionDisplayRows } from "../lib/diving-calculator";

/**
 * Explains that a hull-cleaning price depends on the marine growth actually
 * found at service time, and shows what each condition would cost. Renders the
 * output of conditionPriceRange() — pass `range={null}` (or a null result) and
 * it renders nothing, so callers can drop it in unconditionally.
 *
 * The same panel is used by the public estimator and the order page. When the
 * range carries a prediction (paint-age / last-cleaned known) it highlights the
 * expected condition and frames a "most boats land between" range; without one
 * (organic visitor) it shows the full Light–Severe ladder and no highlight.
 */
export default function ConditionsPricing({ range, className }) {
  if (!range) return null;

  const rows = conditionDisplayRows(range.tiers);
  const perVisit = range.isOneTime ? "" : " per visit";
  const rangeIsSpan = range.rangeHigh > range.rangeLow + 0.001;

  return (
    <div className={cn("flex gap-3", className)}>
      <Waves className="w-5 h-5 text-[#0073a8] flex-shrink-0 mt-0.5" />
      <div className="w-full text-sm text-gray-600">
        <p className="font-medium text-gray-900 mb-1">What sets your final price</p>
        <p className="text-xs mb-3">
          The amount we bill is based on the marine growth we find on your hull at
          service time — not a flat rate. Here's what each condition would cost{perVisit}:
        </p>

        <div className="rounded-lg border border-gray-100 overflow-hidden">
          {rows.map((row) => {
            const isExpected =
              !!range.predictedTier && row.keys.includes(range.predictedTier.key);
            return (
              <div
                key={row.label}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2 text-sm border-b border-gray-100 last:border-b-0",
                  isExpected ? "bg-primary-50" : "bg-white"
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "font-medium",
                      isExpected ? "text-primary-700" : "text-gray-700"
                    )}
                  >
                    {row.label}
                  </span>
                  {isExpected && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-primary-700 bg-primary-100 rounded px-1.5 py-0.5">
                      Expected
                    </span>
                  )}
                  {row.surcharge > 0 && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      +{(row.surcharge * 100).toFixed(0)}%
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "tabular-nums whitespace-nowrap",
                    isExpected ? "font-semibold text-primary-700" : "text-gray-700"
                  )}
                >
                  {formatCurrency(row.total)}
                </span>
              </div>
            );
          })}
        </div>

        {range.predictedTier ? (
          rangeIsSpan ? (
            <p className="text-xs text-gray-500 mt-2">
              Based on what you entered, we'd expect{" "}
              <span className="font-medium text-gray-700">{formatCurrency(range.rangeLow)}</span>
              {"–"}
              <span className="font-medium text-gray-700">{formatCurrency(range.rangeHigh)}</span>
              {perVisit}. Severe growth can add up to +200% in rare, extreme cases.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-2">
              Based on what you entered, we'd expect around{" "}
              <span className="font-medium text-gray-700">{formatCurrency(range.rangeLow)}</span>
              {perVisit}. Heavier growth raises the price as shown above.
            </p>
          )
        ) : (
          <p className="text-xs text-gray-500 mt-2">
            Your price lands somewhere in this range depending on the growth we
            find. Severe growth can add up to +200% in rare, extreme cases.
          </p>
        )}
      </div>
    </div>
  );
}
