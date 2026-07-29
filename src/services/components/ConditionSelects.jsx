import React from "react";
import { Label } from "./ui/label";
import { cn } from "../lib/utils";
import { PAINT_AGE_OPTIONS, LAST_CLEANED_OPTIONS } from "../lib/diving-calculator";

// Mirrors the ui/input styling so the selects sit flush with the rest of the
// form's fields (native <select> — there is no shadcn Select primitive here).
const SELECT_CLASS =
  "flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 " +
  "focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Two OPTIONAL condition selects for the order form: Bottom Paint Age and Last
 * Cleaned. Uses the SAME vocabulary + labels as the /hull-cleaning estimator
 * (shared option arrays in diving-calculator), so the two surfaces can't drift.
 *
 * A "Not sure" choice (empty value, the default) means "unknown": the caller
 * feeds "" into conditionPriceRange / estimateScale, which drop the prediction
 * and render the full Light–Severe span with NO marker (#17). Selecting real
 * values narrows the estimate live and marks the predicted price.
 *
 * Presentational only — value + change handlers are owned by the form. Values
 * are the matrix codes ("<6mo"…"2+yr", "<2"…"24+") or "" for Not sure.
 */
export default function ConditionSelects({
  paintAge,
  lastCleaned,
  onPaintAgeChange,
  onLastCleanedChange,
  className,
}) {
  return (
    <div className={cn("space-y-2", className)} data-testid="condition-selects">
      <Label className="text-sm font-medium text-gray-700">Hull condition (optional)</Label>
      <p className="text-xs text-gray-500">
        Tell us the bottom-paint age and how long since the last cleaning to
        narrow your estimate. Not sure? Leave these and we'll assess at service
        time.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paint-age" className="text-xs font-medium text-gray-600">
            Bottom paint age
          </Label>
          <div className="mt-1.5">
            <select
              id="paint-age"
              data-testid="paint-age-select"
              className={SELECT_CLASS}
              value={paintAge}
              onChange={(e) => onPaintAgeChange(e.target.value)}
            >
              <option value="">Not sure</option>
              {PAINT_AGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="last-cleaned" className="text-xs font-medium text-gray-600">
            Last cleaned
          </Label>
          <div className="mt-1.5">
            <select
              id="last-cleaned"
              data-testid="last-cleaned-select"
              className={SELECT_CLASS}
              value={lastCleaned}
              onChange={(e) => onLastCleanedChange(e.target.value)}
            >
              <option value="">Not sure</option>
              {LAST_CLEANED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
