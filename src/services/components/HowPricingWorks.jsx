import React from "react";
import { Card } from "./ui/card";
import { formatCurrency } from "../lib/utils";
import {
  RATES,
  SURCHARGES,
  RUNNING_GEAR_MULTIPLIER,
  PAINT_AGE_OPTIONS,
  LAST_CLEANED_OPTIONS,
  lookupFouling,
} from "../lib/diving-calculator";
import { PROMOTION, PRICING_JSON_URL, QUOTE_API_URL, MCP_URL } from "../lib/hull-cleaning-public";

const pct = (n) => `${Math.round(n * 1000) / 10}%`;

/**
 * The full rate card in plain HTML. It is prerendered, so people without
 * JavaScript and AI assistants that read the page see the same rules the
 * calculator applies. Every number comes from diving-calculator.js.
 */
export default function HowPricingWorks() {
  const example = RATES.recurring * 35;
  return (
    <Card className="p-6 mb-8">
      <h3 id="how-pricing-works" className="font-bold text-foreground mb-4">How pricing works</h3>
      <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-600">
        <div className="min-w-0">
          <h4 className="font-semibold text-foreground mb-2">Rates</h4>
          <ul className="space-y-1.5">
            <li><strong className="text-foreground">Cleaning &amp; Anodes:</strong> {formatCurrency(RATES.recurring)}/ft on a recurring plan (monthly, every 2 months or quarterly), {formatCurrency(RATES.onetime)}/ft for a one-time cleaning.</li>
            <li><strong className="text-foreground">Running Gear &amp; Anodes:</strong> {Math.round(RUNNING_GEAR_MULTIPLIER * 100)}% of the full-clean price.</li>
            <li><strong className="text-foreground">Underwater Inspection:</strong> {formatCurrency(RATES.inspection)}/ft.</li>
            <li><strong className="text-foreground">Propeller Service:</strong> {formatCurrency(RATES.propellerService)} per propeller.</li>
            <li><strong className="text-foreground">Item Recovery:</strong> from {formatCurrency(RATES.itemRecovery)}.</li>
            <li><strong className="text-foreground">Anodes:</strong> {formatCurrency(RATES.anode)} per anode installed (labor). Parts are extra.</li>
            <li><strong className="text-foreground">Minimum charge:</strong> {formatCurrency(RATES.minimum)} per visit for cleaning, running gear, inspection and anode service.</li>
          </ul>
          <h4 className="font-semibold text-foreground mt-4 mb-2">Surcharges</h4>
          <p>
            Powerboat +{pct(SURCHARGES.powerboat)}, catamaran +{pct(SURCHARGES.catamaran)}, trimaran +{pct(SURCHARGES.trimaran)}, and +10% for each propeller after the first (cleaning and running gear). Surcharges are a percentage of the base (rate × length).
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Example:</strong> a 35 ft sailboat on a monthly plan with light growth is {formatCurrency(RATES.recurring)} × 35 = {formatCurrency(example)} per visit.
          </p>
          <p className="mt-3">
            <a className="underline text-[#0073a8]" href="/hull-cleaning/cost">Hull cleaning cost at Berkeley Marina</a>: price table by boat length and type.
          </p>
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-foreground mb-2">Growth surcharge</h4>
          <p className="mb-3">
            Cleaning adds a growth surcharge, as a percentage of the base, set by paint age and time since the last cleaning. The final price depends on the growth found at service time.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <caption className="sr-only">Growth surcharge by time since last cleaning (rows) and paint age (columns)</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-left font-medium text-gray-500 py-1 pr-2">Last cleaned \ Paint age</th>
                  {PAINT_AGE_OPTIONS.map((p) => (
                    <th key={p.value} scope="col" className="font-medium text-gray-500 py-1 px-1 text-right whitespace-nowrap">{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LAST_CLEANED_OPTIONS.map((l) => (
                  <tr key={l.value} className="border-t border-gray-100">
                    <th scope="row" className="text-left font-medium text-foreground py-1 pr-2 whitespace-nowrap">{l.label}</th>
                    {PAINT_AGE_OPTIONS.map((p) => {
                      const s = lookupFouling(p.value, l.value).surcharge;
                      return <td key={p.value} className="py-1 px-1 text-right tabular-nums">{s ? `+${pct(s)}` : "0%"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4">
            <strong className="text-foreground">Offer:</strong> code {PROMOTION.code}, {PROMOTION.description.charAt(0).toLowerCase() + PROMOTION.description.slice(1)} {PROMOTION.terms}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-6">
        For AI assistants and tools: the same rate card is published as JSON at{" "}
        <a className="underline" href={PRICING_JSON_URL}>{PRICING_JSON_URL.replace("https://", "")}</a>, and{" "}
        <a className="underline" href={`${QUOTE_API_URL}?service=cleaning&length=35`}>{QUOTE_API_URL.replace("https://", "")}</a>{" "}
        returns a read-only estimate. Assistants that support MCP connectors can add the read-only MCP server at{" "}
        <span className="break-all">{MCP_URL.replace("https://", "")}</span>.
      </p>
    </Card>
  );
}
