import React, { useRef, useState, useMemo } from "react";
import PageHero from "../components/PageHero";
import PageCTA from "../components/PageCTA";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  Sparkles, Droplets, Shield, Camera, MessageSquare,
  CheckCircle2, Send, Ship, Sailboat, TreePine,
} from "lucide-react";
import PageMeta from "../components/PageMeta";
import JsonLd from "../components/JsonLd";

/* ═══════════════════════════════════════════
   Pricing Engine
   ═══════════════════════════════════════════ */

const SAIL_SHAPE = 0.70;
const POWER_SHAPE = 0.85;
const POWER_SINGLE_SURCHARGE = 1.35;
const POWER_MULTI_SURCHARGE = 1.70;
const SPRING_POWER_SINGLE_SURCHARGE = 1.10;
const SPRING_POWER_MULTI_SURCHARGE = 1.35;
const MIN_CHARGE = 99;
const COMFORT_MARGIN = 1.15; // estimates run ~15% high so we only lower in person

// Per-sq-ft rates
const WASH_RATE = 1.40;
const POLISH_RATE = 1.20;
const SPRING_WASH_RATE = 0.84;

// Metal polishing per-foot
const METAL_SAIL_PER_FT = 2.50;
const METAL_POWER_PER_FT = 1.80;

// Oxidation multipliers
const OXIDATION = {
  "lt6mo": { label: "Less than 6 months", mult: 1.0 },
  "6to12": { label: "6–12 months", mult: 1.3 },
  "1to2yr": { label: "1–2 years", mult: 1.7 },
  "2plus": { label: "2+ years", mult: 2.2 },
  "never": { label: "Never / don't know", mult: 2.2 },
};

function getArea(length, beam, boatType) {
  const l = parseFloat(length);
  const b = parseFloat(beam);
  if (!l || !b || l <= 0 || b <= 0) return null;
  return l * b * (boatType === "power" ? POWER_SHAPE : SAIL_SHAPE);
}

function getPowerMult(boatType, multiDeck) {
  if (boatType !== "power") return 1;
  return multiDeck ? POWER_MULTI_SURCHARGE : POWER_SINGLE_SURCHARGE;
}

function calcLineItems({ length, beam, boatType, multiDeck, services, oxidation }) {
  const area = getArea(length, beam, boatType);
  if (!area) return null;

  const l = parseFloat(length);
  const pMult = getPowerMult(boatType, multiDeck);
  const items = [];

  if (services.springWash) {
    const springMult = boatType === "power"
      ? (multiDeck ? SPRING_POWER_MULTI_SURCHARGE : SPRING_POWER_SINGLE_SURCHARGE)
      : 1;
    items.push({
      label: "🌿 Spring Pressure Wash",
      desc: "Includes dock box & dock cleaning",
      price: Math.max(MIN_CHARGE, Math.round(area * SPRING_WASH_RATE * springMult * COMFORT_MARGIN)),
    });
  }

  if (services.washDry) {
    items.push({
      label: "Wash & Dry",
      desc: "Complete exterior wash, deck scrub, dry",
      price: Math.max(MIN_CHARGE, Math.round(area * WASH_RATE * pMult * COMFORT_MARGIN)),
    });
  }

  if (services.polishWax) {
    const oxMult = OXIDATION[oxidation]?.mult || 1.0;
    items.push({
      label: "Polish & Wax",
      desc: `Includes gelcoat stain & oxidation removal (${OXIDATION[oxidation]?.label || "—"})`,
      price: Math.max(MIN_CHARGE, Math.round(area * POLISH_RATE * oxMult * pMult * COMFORT_MARGIN)),
    });
  }

  if (services.metal) {
    const rate = boatType === "power" ? METAL_POWER_PER_FT : METAL_SAIL_PER_FT;
    items.push({
      label: "Metal Polishing",
      desc: "Stainless, aluminum, chrome brightwork",
      price: Math.max(MIN_CHARGE, Math.round(l * rate * COMFORT_MARGIN)),
    });
  }

  if (services.teak) {
    items.push({
      label: "Teak & Brightwork",
      desc: "Quoted on-site — varies by scope",
      price: null,
    });
  }

  return items;
}

/* ═══════════════════════════════════════════
   Toggle Button Component
   ═══════════════════════════════════════════ */

function Toggle({ active, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-gray-200 text-gray-600 hover:border-gray-300"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════
   Detailing Estimator
   ═══════════════════════════════════════════ */

function DetailingEstimator({ onStateChange }) {
  // Boat info
  const [boatType, setBoatType] = useState("sail");
  const [multiDeck, setMultiDeck] = useState(false);
  const [length, setLength] = useState("");
  const [beam, setBeam] = useState("");

  // Services
  const [services, setServices] = useState({
    springWash: false,
    washDry: true,
    polishWax: false,
    metal: false,
    teak: false,
  });

  // Oxidation (only matters if polishWax is on)
  const [oxidation, setOxidation] = useState("6to12");

  function toggleSvc(key) {
    setServices((s) => ({ ...s, [key]: !s[key] }));
  }

  const lineItems = useMemo(
    () => calcLineItems({ length, beam, boatType, multiDeck, services, oxidation }),
    [length, beam, boatType, multiDeck, services, oxidation]
  );

  const pricedItems = lineItems?.filter((i) => i.price !== null) || [];
  const total = pricedItems.reduce((sum, i) => sum + i.price, 0);
  const hasTeak = services.teak;
  const hasAnyService = Object.values(services).some(Boolean);
  const hasDimensions = lineItems !== null;

  // Push calculator state up so the estimate form can pre-populate
  React.useEffect(() => {
    if (onStateChange) {
      onStateChange({ boatType, length, beam, services, lineItems, total });
    }
  }, [boatType, length, beam, services, lineItems, total, onStateChange]);

  return (
    <section className="py-12 md:py-20" id="estimator">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Build Your Estimate</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Pick your services, enter your boat's dimensions, and get an instant ballpark.
            Final pricing after an in-person walkthrough — estimates here are typically the same or lower.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* ── Left column: inputs (3/5) ── */}
          <div className="lg:col-span-3 space-y-8">

            {/* Boat Type */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <Label className="text-base font-semibold block">Your Boat</Label>
                <div className="flex gap-2">
                  <Toggle
                    active={boatType === "sail"}
                    onClick={() => { setBoatType("sail"); setMultiDeck(false); }}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Sailboat className="w-5 h-5" /> Sailboat
                  </Toggle>
                  <Toggle
                    active={boatType === "power"}
                    onClick={() => setBoatType("power")}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Ship className="w-5 h-5" /> Powerboat
                  </Toggle>
                </div>

                {boatType === "power" && (
                  <div className="flex gap-2">
                    <Toggle active={!multiDeck} onClick={() => setMultiDeck(false)} className="flex-1">
                      Single Deck
                    </Toggle>
                    <Toggle active={multiDeck} onClick={() => setMultiDeck(true)} className="flex-1">
                      Flybridge / Multi-Deck
                    </Toggle>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-1 block">Length (ft)</Label>
                    <Input type="number" min="10" max="100" value={length} onChange={(e) => setLength(e.target.value)} placeholder="e.g. 32" />
                    <p className="text-xs text-gray-400 mt-1">Model name length</p>
                  </div>
                  <div>
                    <Label className="text-sm mb-1 block">Beam (ft)</Label>
                    <Input type="number" min="4" max="30" value={beam} onChange={(e) => setBeam(e.target.value)} placeholder="e.g. 10" />
                    <p className="text-xs text-gray-400 mt-1">Widest point of hull</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <Label className="text-base font-semibold block">Services</Label>

                {/* Spring Special — featured */}
                <button
                  type="button"
                  onClick={() => toggleSvc("springWash")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    services.springWash
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🌿</span>
                      <div>
                        <span className="font-semibold text-foreground">Spring Pressure Wash</span>
                        <span className="ml-2 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">SEASONAL</span>
                        <p className="text-sm text-gray-500 mt-0.5">Blast off winter algae &amp; grime. Dock box &amp; dock cleaning included.</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      services.springWash ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                    }`}>
                      {services.springWash && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                </button>

                {/* Regular services */}
                {[
                  { key: "washDry", icon: Droplets, label: "Wash & Dry", desc: "Complete exterior wash, deck scrub, and hand dry" },
                  { key: "polishWax", icon: Sparkles, label: "Polish & Wax", desc: "Restore shine and UV protection. Includes gelcoat stain & oxidation removal." },
                  { key: "metal", icon: Shield, label: "Metal Polishing", desc: "Stainless steel, aluminum, and chrome brightwork" },
                  { key: "teak", icon: TreePine, label: "Teak & Brightwork", desc: "Cleaning, oiling, or varnish work — quoted on-site due to wide variation" },
                ].map(({ key, icon: Icon, label, desc }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSvc(key)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      services[key]
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">{label}</span>
                          <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        services[key] ? "bg-primary border-primary" : "border-gray-300"
                      }`}>
                        {services[key] && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Oxidation — only shown when Polish & Wax is selected */}
            {services.polishWax && (
              <Card>
                <CardContent className="p-5 space-y-3">
                  <Label className="text-base font-semibold block">When was your boat last polished or waxed?</Label>
                  <p className="text-sm text-gray-500 -mt-1">This helps us estimate the oxidation level and effort required.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(OXIDATION).map(([key, { label }]) => (
                      <Toggle
                        key={key}
                        active={oxidation === key}
                        onClick={() => setOxidation(key)}
                        className="text-center"
                      >
                        {label}
                      </Toggle>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right column: estimate card (2/5) ── */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8">
              <Card className="border-0 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-br from-[#1565c0] to-[#0097a7] px-6 py-5">
                  <h3 className="text-lg font-bold text-white">Your Estimate</h3>
                  <p className="text-white/70 text-sm">
                    {services.springWash && !services.washDry && !services.polishWax && !services.metal && !services.teak
                      ? "Fixed price — no surprises"
                      : "Subject to in-person inspection"}
                  </p>
                </div>
                <CardContent className="p-6">
                  {!hasAnyService ? (
                    <p className="text-gray-400 text-sm text-center py-6">Select at least one service to see pricing.</p>
                  ) : !hasDimensions ? (
                    <p className="text-gray-400 text-sm text-center py-6">Enter your boat's length and beam for an estimate.</p>
                  ) : (
                    <div className="space-y-3">
                      {lineItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-start gap-4">
                          <div>
                            <p className="font-medium text-foreground text-sm">{item.label}</p>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                          </div>
                          <p className="font-semibold text-foreground text-sm whitespace-nowrap">
                            {item.price !== null ? `$${item.price}` : "TBD"}
                          </p>
                        </div>
                      ))}

                      <hr className="my-3" />

                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-600">Estimated total</span>
                        <div className="text-right">
                          <span className="text-3xl font-bold text-foreground">
                            {hasTeak ? "from " : ""}${total}
                          </span>
                          {hasTeak && <p className="text-xs text-gray-500">+ teak (quoted on-site)</p>}
                        </div>
                      </div>

                      {/* Only show ballpark notice when spring wash is NOT the sole service */}
                      {!(services.springWash && !services.washDry && !services.polishWax && !services.metal && !services.teak) && (
                        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-xs text-amber-800">
                            This is a ballpark estimate. We'll walk your boat together and dial in the final scope and price.
                            Actual cost is typically the same or lower.
                          </p>
                        </div>
                      )}

                      {/* Spring wash only — fixed price notice */}
                      {services.springWash && !services.washDry && !services.polishWax && !services.metal && !services.teak && (
                        <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                          <p className="text-xs text-emerald-800">
                            Spring pressure wash pricing is fixed — this is your price, not a ballpark.
                          </p>
                        </div>
                      )}

                      <a
                        href="#estimate"
                        className="mt-4 inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {services.springWash && !services.washDry && !services.polishWax && !services.metal && !services.teak
                          ? "Request This Service"
                          : "Request This Estimate"}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Estimate Request Form
   ═══════════════════════════════════════════ */

const ESTIMATE_API_URL = "/api/detailing-estimate";

function EstimateForm({ calculatorState, analytics }) {
  const {
    boatType: calcBoatType,
    length: calcLength,
    beam: calcBeam,
    services: calcServices,
    lineItems: calcLineItems,
    total: calcTotal,
  } = calculatorState || {};

  const springWashOnly = !!(
    calcServices?.springWash &&
    !calcServices?.washDry &&
    !calcServices?.polishWax &&
    !calcServices?.metal &&
    !calcServices?.teak
  );

  // Pre-populate from calculator selections
  const preSelectedServices = [];
  if (calcServices?.springWash) preSelectedServices.push("Spring Pressure Wash");
  if (calcServices?.washDry) preSelectedServices.push("Wash & Dry");
  if (calcServices?.polishWax) preSelectedServices.push("Polish & Wax");
  if (calcServices?.metal) preSelectedServices.push("Metal Polishing");
  if (calcServices?.teak) preSelectedServices.push("Teak & Brightwork");

  const [form, setForm] = useState({
    name: "", email: "", phone: "", marina: "", dockSlip: "", boatName: "",
    boatLength: calcLength || "",
    services: preSelectedServices,
    notes: "",
    anythingElse: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const contactStarted = useRef(false);

  const markContactStarted = () => {
    if (contactStarted.current) return;
    contactStarted.current = true;
    analytics?.capture("contact_started", {
      surface: "services", service: "boat-detailing", step: "form",
    });
  };

  const serviceCheckboxes = [
    "Spring Pressure Wash",
    "Wash & Dry",
    "Polish & Wax",
    "Metal Polishing",
    "Teak & Brightwork",
    "Gelcoat & Paint Repair",
    "Decal Removal",
    "Other",
  ];

  function toggleService(svc) {
    setForm((f) => ({
      ...f,
      services: f.services.includes(svc)
        ? f.services.filter((s) => s !== svc)
        : [...f.services, svc],
    }));
  }

  const updateField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(ESTIMATE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          marina: form.marina,
          dockSlip: form.dockSlip,
          boatName: form.boatName,
          boatLength: form.boatLength || calcLength,
          services: form.services.join(", "),
          notes: form.notes,
          anythingElse: form.anythingElse,
          // Include calculator estimate data
          boatType: calcBoatType || "",
          beam: calcBeam || "",
          estimateTotal: calcTotal || null,
          estimateLineItems: calcLineItems?.map(i => `${i.label}: ${i.price !== null ? '$' + i.price : 'TBD'}`).join(", ") || "",
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setSubmitted(true);
      analytics?.capture("contact_submitted", {
        surface: "services", service: "boat-detailing", step: "submit", result: "success",
      });
    } catch {
      setError("Failed to send. Email detailing@briancline.co directly.");
      setSubmitting(false);
      analytics?.capture("contact_submitted", {
        surface: "services", service: "boat-detailing", step: "submit", result: "failed",
      });
    }
  }

  if (submitted) {
    return (
      <Card className="text-center p-10">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Request Sent!</h3>
        <p className="text-gray-600">Brian will get back to you within 24 hours to schedule a walkthrough and finalize your estimate.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{springWashOnly ? "Request This Service" : "Request an Estimate"}</CardTitle>
        <CardDescription>Tell me about your boat. I'll get back to you within 24 hours{springWashOnly ? " to schedule your spring pressure wash." : " to schedule a walkthrough."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} onChangeCapture={markContactStarted} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Name *</Label><Input required value={form.name} onChange={updateField("name")} /></div>
            <div><Label>Email *</Label><Input type="email" required value={form.email} onChange={updateField("email")} /></div>
            <div><Label>Phone</Label><Input type="tel" value={form.phone} onChange={updateField("phone")} placeholder="(510) 555-1234" /></div>
            <div><Label>Marina</Label><Input value={form.marina} onChange={updateField("marina")} placeholder="e.g. Berkeley Marina" /></div>
            <div><Label>Dock / Slip #</Label><Input value={form.dockSlip} onChange={updateField("dockSlip")} placeholder="e.g. F-12" /></div>
            <div><Label>Boat Name</Label><Input value={form.boatName} onChange={updateField("boatName")} /></div>
            <div><Label>Boat Length (ft)</Label><Input type="number" value={form.boatLength} onChange={updateField("boatLength")} /></div>
          </div>

          <div>
            <Label className="mb-3 block">Services Interested In</Label>
            <div className="grid grid-cols-2 gap-2">
              {serviceCheckboxes.map((svc) => (
                <label key={svc} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                  <Checkbox
                    checked={form.services.includes(svc)}
                    onCheckedChange={() => toggleService(svc)}
                  />
                  {svc}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Anything else you'd like us to look at?</Label>
            <Textarea value={form.anythingElse} onChange={updateField("anythingElse")} placeholder="Services not in the calculator? Specific problem areas? Special requests?" />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={updateField("notes")} placeholder="Timeline, access codes, preferred schedule, etc." />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
          )}

          <Button type="submit" disabled={submitting} className="w-full gap-2">
            <Send className="w-4 h-4" />
            {submitting ? "Sending..." : springWashOnly ? "Request This Service" : "Request Estimate"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */

export default function Detailing({ analytics }) {
  // Lift calculator state so we can pass it to the estimate form
  const [calculatorState, setCalculatorState] = useState(null);

  return (
    <div>
      <PageMeta
        title="Boat Detailing – San Francisco Bay Area | Brian Cline"
        description="Professional boat detailing on San Francisco Bay. Wash, wax, polish, metal polishing, teak care, and gelcoat restoration. Serving Berkeley, Emeryville, Richmond, and Oakland marinas. Instant estimates."
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Boat Detailing - San Francisco Bay",
        "description": "Complete above-waterline boat detailing services including wash, wax, polish, metal polishing, teak care, and gelcoat restoration throughout San Francisco Bay marinas.",
        "provider": { "@id": "https://briancline.co/#vessel-management" },
        "areaServed": { "@type": "Place", "name": "San Francisco Bay Area" },
        "serviceType": "Boat Detailing",
        "url": "https://briancline.co/boat-detailing"
      }} />
      <PageHero
        title="Boat Detailing"
        subtitle="Above-the-waterline care for your boat — wash, polish, wax, metal work, and brightwork, managed to one consistent standard of care across the East Bay."
        price=""
        credentials="Serving Berkeley, Emeryville, Richmond, and Oakland marinas"
        cta="Get an Estimate"
        ctaHref="#estimator"
        image="/images/detailing/diving-hero.jpg"
        imageAlt="Boat hull and waterline — professional detailing on San Francisco Bay"
      />

      <DetailingEstimator onStateChange={setCalculatorState} />

      {/* What to Expect */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground mb-10 text-center">What to Expect</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: "Satisfaction Guarantee", desc: "Not happy? We'll make it right." },
              { icon: MessageSquare, title: "Clear Communication", desc: "You'll know exactly what's happening and when." },
              { icon: Camera, title: "Before & After Photos", desc: "Documentation of every job." },
              { icon: CheckCircle2, title: "Service Log", desc: "Track what's been done and when it's due again." },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="text-center p-6">
                <Icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Estimate Request Form */}
      <section className="py-16 md:py-24" id="estimate">
        <div className="max-w-2xl mx-auto px-6">
          <EstimateForm calculatorState={calculatorState} analytics={analytics} />
        </div>
      </section>

      <PageCTA
        title="Get Your Boat Looking Its Best"
        subtitle="Use the calculator above for an instant estimate, or fill out the form and I'll get back to you within 24 hours."
        buttonText="Build Your Estimate"
        href="#estimator"
      />
    </div>
  );
}
