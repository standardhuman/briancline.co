import React from "react";
import { Link } from "react-router-dom";
import PageMeta from "../components/PageMeta";
import JsonLd from "../components/JsonLd";
import { Card } from "../components/ui/card";
import { formatCurrency } from "../lib/utils";
import { calculateEstimate, RATES, SURCHARGES, CONDITION_TIERS, RUNNING_GEAR_MULTIPLIER } from "../lib/diving-calculator";
import { BUSINESS, COST_PAGE_URL, PAGE_URL, PRICING_JSON_URL, QUOTE_API_URL, businessJsonLd } from "../lib/hull-cleaning-public";

/**
 * Answer-first cost guide for "how much does hull cleaning cost in Berkeley"
 * questions. Prerendered, so search engines and AI assistants read the same
 * numbers the estimator charges. Every price is computed from
 * diving-calculator.js; nothing on this page sets a price.
 */

const pct = (n) => `${Math.round(n * 100)}%`;
const money = (n) => formatCurrency(n);
// Rates come from the code at build time, so the build month is when they were last confirmed.
const AS_OF = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Los_Angeles" });

const LENGTHS = [26, 30, 35, 40, 45];

function price({ length, boatType = "sailboat", hullType = "monohull", frequency = "monthly", paintAge = "<6mo", lastCleaned = "<2" }) {
  return calculateEstimate({
    serviceKey: "cleaning",
    boatLength: length,
    boatType,
    hullType,
    frequency,
    propellerCount: 1,
    anodeCount: 0,
    paintAge,
    lastCleaned,
  }).total;
}

const COLUMNS = [
  { label: "Sailboat, recurring", args: {} },
  { label: "Powerboat, recurring", args: { boatType: "powerboat" } },
  { label: "Catamaran, recurring", args: { hullType: "catamaran" } },
  { label: "Sailboat, one-time", args: { frequency: "onetime" } },
];

const heavy = CONDITION_TIERS.find((t) => t.key === "heavy");
const severe = CONDITION_TIERS.find((t) => t.key === "severe");
const example35 = RATES.recurring * 35;

export const COST_FAQS = [
  {
    q: "How much does it cost to have a diver clean my hull in Berkeley?",
    a: `At Berkeley Marina, Brian Cline Diving and Hull Cleaning charges ${money(RATES.recurring)} per foot on a recurring plan and ${money(RATES.onetime)} per foot for a one-time cleaning, with a ${money(RATES.minimum)} minimum per visit. A 35 ft sailboat on a monthly plan with light growth is ${money(example35)} per visit.`,
  },
  {
    q: "Is there a minimum charge?",
    a: `Yes. The minimum is ${money(RATES.minimum)} per visit for cleaning, running gear, inspection and anode service, so boats under about ${Math.ceil(RATES.minimum / RATES.recurring)} ft on a recurring plan pay the minimum.`,
  },
  {
    q: "How much more does a powerboat, catamaran or trimaran cost?",
    a: `Powerboats add ${pct(SURCHARGES.powerboat)}, catamarans add ${pct(SURCHARGES.catamaran)} and trimarans add ${pct(SURCHARGES.trimaran)} to the base price (rate times length). Each propeller after the first adds 10%.`,
  },
  {
    q: "Why might my bill differ from the estimate?",
    a: `The final price depends on the marine growth found at service time. Light and moderate growth carry no surcharge. Heavy growth adds ${pct(heavy.surcharge)} and severe growth adds ${pct(severe.surcharge)} of the base price. Hulls with old paint or a long gap since the last cleaning are more likely to need a growth surcharge.`,
  },
  {
    q: "What does a recurring plan mean?",
    a: `The recurring rate of ${money(RATES.recurring)} per foot applies to monthly, every-2-months and quarterly plans. A single cleaning with no plan is ${money(RATES.onetime)} per foot.`,
  },
  {
    q: "Are anodes (zincs) included?",
    a: `Anode inspection is included with every cleaning. Replacing an anode is ${money(RATES.anode)} per anode in labor, plus the part: bring your own, or one is supplied at roughly chandlery prices plus tax.`,
  },
  {
    q: "Do you clean boats in Emeryville, Richmond, Alameda or Sausalito?",
    a: `Not at the moment. Service is currently Berkeley Marina only. For a boat at another Bay Area marina, email ${BUSINESS.email} with your marina and boat details for a referral to a trusted dive professional.`,
  },
  {
    q: "How do I get an exact quote for my boat?",
    a: `Use the instant estimator at ${PAGE_URL.replace("https://", "")}. Enter your boat length, type, cleaning frequency, paint age and when it was last cleaned, and it shows the estimate and the range across growth levels. You can order online from the same page.`,
  },
];

export default function HullCleaningCost() {
  return (
    <div className="min-h-screen bg-white">
      <PageMeta
        title={`Hull Cleaning Cost at Berkeley Marina (${AS_OF}): ${money(RATES.recurring)}/ft | Brian Cline Diving and Hull Cleaning`}
        description={`What it costs to have a diver clean your hull at Berkeley Marina: ${money(RATES.recurring)} per foot recurring, ${money(RATES.onetime)} per foot one-time, ${money(RATES.minimum)} minimum. Price table by boat length, surcharges, and an instant estimator.`}
        canonical="/hull-cleaning/cost"
      />
      <JsonLd data={businessJsonLd()} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        url: COST_PAGE_URL,
        mainEntity: COST_FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Hull Cleaning", item: PAGE_URL },
          { "@type": "ListItem", position: 2, name: "Cost", item: COST_PAGE_URL },
        ],
      }} />

      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-sm text-gray-500 mb-2">
          <Link to="/hull-cleaning" className="underline">Hull Cleaning</Link> / Cost
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          How much does hull cleaning cost at Berkeley Marina?
        </h1>
        <p className="text-lg text-gray-800 mb-4">
          Hull cleaning by a diver at Berkeley Marina costs <strong>{money(RATES.recurring)} per foot</strong> on a recurring plan
          and <strong>{money(RATES.onetime)} per foot</strong> for a one-time cleaning, with a <strong>{money(RATES.minimum)} minimum</strong> per
          visit. A 35 ft sailboat on a monthly plan with light growth is {money(RATES.recurring)} × 35 = <strong>{money(example35)}</strong> per visit.
        </p>
        <p className="text-gray-600 mb-6">
          These are the rates of {BUSINESS.name} ({BUSINESS.legalName}), current as of {AS_OF}. They are the same numbers
          the <Link to="/hull-cleaning" className="text-[#0073a8] underline">instant estimator</Link> and checkout use.
        </p>
        <p className="mb-10">
          <Link
            to="/hull-cleaning"
            className="inline-block rounded-lg bg-[#0073a8] px-5 py-3 font-semibold text-white hover:bg-[#005f8a]"
          >
            Get an instant estimate for your boat
          </Link>
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">Price per visit by boat length</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Light growth, one propeller, no anodes replaced. Recurring means a monthly, every-2-months or quarterly plan.
        </p>
        <Card className="p-0 mb-10 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Hull cleaning price per visit at Berkeley Marina by boat length and type</caption>
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="text-left font-semibold py-2 px-3">Length</th>
                {COLUMNS.map((c) => (
                  <th key={c.label} scope="col" className="text-right font-semibold py-2 px-3">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LENGTHS.map((length) => (
                <tr key={length} className="border-t border-gray-100">
                  <th scope="row" className="text-left font-medium py-2 px-3">{length} ft</th>
                  {COLUMNS.map((c) => (
                    <td key={c.label} className="text-right tabular-nums py-2 px-3">{money(price({ length, ...c.args }))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">What changes the price</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-10">
          <li><strong>Boat type:</strong> powerboat +{pct(SURCHARGES.powerboat)}, catamaran +{pct(SURCHARGES.catamaran)}, trimaran +{pct(SURCHARGES.trimaran)}.</li>
          <li><strong>Propellers:</strong> the first is included; each additional propeller adds 10%.</li>
          <li><strong>Marine growth:</strong> light and moderate growth add nothing; heavy growth adds {pct(heavy.surcharge)} and severe growth adds {pct(severe.surcharge)}. The amount billed reflects the growth found on the day.</li>
          <li><strong>Plan:</strong> {money(RATES.recurring)}/ft on a recurring plan versus {money(RATES.onetime)}/ft for a one-time cleaning.</li>
          <li><strong>Anodes:</strong> {money(RATES.anode)} labor per anode replaced, plus the part.</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">Other dive services</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-10">
          <li><strong>Underwater inspection:</strong> {money(RATES.inspection)} per foot.</li>
          <li><strong>Running gear only</strong> (props, shafts, anodes, thru-hulls): {pct(RUNNING_GEAR_MULTIPLIER)} of the full-clean price.</li>
          <li><strong>Propeller service:</strong> {money(RATES.propellerService)} per propeller.</li>
          <li><strong>Item recovery:</strong> from {money(RATES.itemRecovery)}.</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">What every cleaning includes</h2>
        <p className="text-gray-700 mb-10">
          A full hull scrub of the antifouling paint, running gear and zinc anode inspection, before and after GoPro video,
          and a digital service report. The diver is Brian Cline, a former high-speed ferry captain and US Sailing instructor.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
        <div className="space-y-6 mb-10">
          {COST_FAQS.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-gray-900 mb-1">{f.q}</h3>
              <p className="text-gray-700">{f.a}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500">
          Questions? Call <a href={`tel:${BUSINESS.telephone}`} className="underline">(415) 529-0272</a> or
          email <a href={`mailto:${BUSINESS.email}`} className="underline">{BUSINESS.email}</a>. Machine-readable
          rate card: <a href={PRICING_JSON_URL} className="underline">{PRICING_JSON_URL.replace("https://", "")}</a>.
          Read-only quote API: <a href={`${QUOTE_API_URL}?service=cleaning&length=35`} className="underline">{QUOTE_API_URL.replace("https://", "")}</a>.
        </p>
      </div>
    </div>
  );
}
