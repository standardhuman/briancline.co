import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { cn, formatCurrency } from "../lib/utils";
import { SERVICES } from "../lib/diving-calculator";
import PageMeta from "../components/PageMeta";
import {
  Ship, MapPin, User, Wrench, CreditCard, ArrowRight, Loader2,
  CheckCircle2, AlertCircle, Anchor, Calendar
} from "lucide-react";

// ── Config ──
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// Active terms version. Bump when terms_documents gets a new effective row.
// Server validates this matches an existing version before persisting consent.
const TERMS_VERSION = "2026-05-01";

// Berkeley-only service area: we only service boats berthed in Berkeley.
// Surfaced via <datalist> to nudge customers toward a recognized name.
// Keep in sync with isBerkeleyMarina() on the server (lead-validation.ts).
const BERKELEY_MARINAS = [
  "Berkeley Marina",
];

// Mirror of the server-side isBerkeleyMarina() gate: the boat must be berthed
// in Berkeley. Match any marina whose name contains "berkeley", plus any
// explicit Berkeley berths whose name omits the word.
const BERKELEY_MARINA_ALIASES = new Set([
  // Add Berkeley berths here whose name does NOT contain "berkeley".
]);
const isBerkeleyMarina = (marina) => {
  const n = (marina || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return false;
  return n.includes("berkeley") || BERKELEY_MARINA_ALIASES.has(n);
};

const BOAT_TYPES = [
  { value: "monohull_sailboat", label: "Monohull Sailboat", hull: "monohull", type: "sailboat" },
  { value: "monohull_powerboat", label: "Monohull Powerboat", hull: "monohull", type: "powerboat" },
  { value: "catamaran_sailboat", label: "Catamaran Sailboat", hull: "catamaran", type: "sailboat" },
  { value: "catamaran_powerboat", label: "Catamaran Powerboat", hull: "catamaran", type: "powerboat" },
  { value: "trimaran_sailboat", label: "Trimaran Sailboat", hull: "trimaran", type: "sailboat" },
  { value: "trimaran_powerboat", label: "Trimaran Powerboat", hull: "trimaran", type: "powerboat" },
];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Every 2 Months" },
  { value: "quarterly", label: "Every 3 Months" },
  { value: "one_time", label: "One-Time" },
];

// ── Stripe loader (singleton) ──
// Fetches publishable key from edge function to stay in sync with backend mode (test/live)
let stripePromise = null;

function getStripePromise() {
  if (stripePromise) return stripePromise;
  stripePromise = fetch(`${SUPABASE_URL}/functions/v1/get-stripe-config`, {
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
    .then((res) => res.json())
    .then(({ publishableKey }) => loadStripe(publishableKey));
  return stripePromise;
}

// ── Stripe Element Styling ──
const STRIPE_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      color: "#1f2937",
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#ef4444" },
  },
};

// ── Section Card ──
function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card className="border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#0073a8]" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Form Field ──
function Field({ label, required, children, className }) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// ── Floating Profile Card ──
function ProfileCard({ form, service, estimateAmount, isItemRecovery, showFrequency }) {
  const boatTypeInfo = BOAT_TYPES.find((t) => t.value === form.boatType);
  const frequencyInfo = FREQUENCIES.find((f) => f.value === form.frequency);

  const hasBoatName = form.boatName?.trim();
  const hasLocation = form.marina?.trim();
  const hasOwner = form.customerName?.trim();

  return (
    <Card className="bg-gradient-to-br from-[#1565c0] to-[#0097a7] text-white border-0 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Ship className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg text-white truncate">
              {hasBoatName || "Your Boat"}
            </CardTitle>
            <p className="text-white/60 text-sm truncate">
              {boatTypeInfo?.label || "—"}
              {form.boatLength && ` · ${form.boatLength}ft`}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-2">
        {/* Boat info */}
        {!isItemRecovery && (form.boatMake || form.boatModel) && (
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-0.5">Make / Model</p>
            <p className="text-sm font-medium">
              {[form.boatMake, form.boatModel].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
        )}

        {/* Location */}
        {!isItemRecovery && (
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <MapPin className="w-3 h-3 text-white/50" />
              <p className="text-white/50 text-xs uppercase tracking-wider">Location</p>
            </div>
            {hasLocation ? (
              <p className="text-sm font-medium">
                {form.marina}
                {(form.dock || form.slip) && (
                  <span className="text-white/70">
                    {form.dock && ` · Dock ${form.dock}`}
                    {form.slip && ` · Slip ${form.slip}`}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-white/40 italic">Not yet entered</p>
            )}
          </div>
        )}

        {/* Owner */}
        <div className="bg-white/10 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <User className="w-3 h-3 text-white/50" />
            <p className="text-white/50 text-xs uppercase tracking-wider">Owner</p>
          </div>
          {hasOwner ? (
            <div>
              <p className="text-sm font-medium">{form.customerName}</p>
              {form.customerEmail && (
                <p className="text-xs text-white/60">{form.customerEmail}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40 italic">Not yet entered</p>
          )}
        </div>

        {/* Service + Estimate */}
        <div className="border-t border-white/20 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="w-3 h-3 text-white/50" />
            <p className="text-white/50 text-xs uppercase tracking-wider">Service</p>
          </div>
          <p className="text-sm font-medium">
            {showFrequency && frequencyInfo
              ? `${frequencyInfo.label} ${service.name}`
              : service.name}
          </p>
        </div>

        {estimateAmount && (
          <div className="bg-white/15 rounded-xl p-4 text-center">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Estimated Cost</p>
            <p className="text-3xl font-bold">{formatCurrency(estimateAmount)}</p>
            <p className="text-white/50 text-xs mt-1">Charged after service completion</p>
          </div>
        )}

        <p className="text-xs text-white/40 text-center pt-1">
          Questions? Email{" "}
          <a href="mailto:diving@briancline.co" className="underline hover:text-white/60">
            diving@briancline.co
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

// ── Stripe-wrapped inner form ──
function OrderForm({ searchParams, navigate }) {
  const stripe = useStripe();
  const elements = useElements();

  // Pre-fill from URL params
  const serviceKey = searchParams.get("service") || "cleaning";
  const initialLength = searchParams.get("length") || "";
  const initialType = searchParams.get("type") || "sailboat";
  const initialHull = searchParams.get("hull") || "monohull";
  const initialFrequency = searchParams.get("frequency") || "monthly";
  const initialEstimate = searchParams.get("estimate") || "";
  const initialPropellers = searchParams.get("propellers") || "1";
  const initialPaintAge = searchParams.get("paintAge") || "";
  const initialLastCleaned = searchParams.get("lastCleaned") || "";
  const initialAnodes = searchParams.get("anodes") || "0";

  // Identity + owner pre-fill (SailorSkills boat-portal deep link). These mirror
  // the shared querystring contract defined in the marketplace repo at
  // src/lib/portal/orderPrefill.ts — when a one-time SailorSkills client books
  // from their boat portal, we already know their boat + contact, so we pre-fill
  // it here. Every value is an editable hint; nothing is trusted server-side.
  const initialBoatName = searchParams.get("boatName") || "";
  const initialBoatMake = searchParams.get("boatMake") || "";
  const initialBoatModel = searchParams.get("boatModel") || "";
  const initialMarina = searchParams.get("marina") || "";
  const initialDock = searchParams.get("dock") || "";
  const initialSlip = searchParams.get("slip") || "";
  const initialCustomerName = searchParams.get("customerName") || "";
  const initialCustomerEmail = searchParams.get("customerEmail") || "";
  const initialCustomerPhone = searchParams.get("customerPhone") || "";

  // Fall back to a REAL SERVICES key ('cleaning'); 'recurring_cleaning' is not a
  // defined key, so `service` was undefined and `service.name` blank-screened the
  // whole order form on the bare URL / any unknown service param.
  const service = SERVICES[serviceKey] || SERVICES.cleaning;

  // Combine hull + type into a single boat type value
  const initialBoatType = `${initialHull}_${initialType}`;
  // Validate it exists in our options, fall back to monohull_sailboat
  const validBoatType = BOAT_TYPES.some((t) => t.value === initialBoatType) ? initialBoatType : "monohull_sailboat";

  const isItemRecovery = serviceKey === "item_recovery";
  const isAnodesOnly = serviceKey === "anodes_only";
  const isPropellerService = serviceKey === "propeller_service";
  // "cleaning" is the recurring-capable service; check frequency to know if they chose one-time
  const isCleaningService = serviceKey === "cleaning" || serviceKey === "recurring_cleaning";
  const showBoatInfo = !isItemRecovery;
  const showFrequency = isCleaningService;

  // Form state
  const [form, setForm] = useState({
    boatName: initialBoatName,
    boatType: validBoatType,
    boatMake: initialBoatMake,
    boatModel: initialBoatModel,
    boatLength: initialLength,
    marina: initialMarina,
    dock: initialDock,
    slip: initialSlip,
    customerName: initialCustomerName,
    customerEmail: initialCustomerEmail,
    customerPhone: initialCustomerPhone,
    billingAddress: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    frequency: isCleaningService ? initialFrequency : "one_time",
    notes: "",
    // Item recovery fields
    recoveryLocation: "",
    itemDescription: "",
    dateLost: "",
    // Anodes only
    anodeInfo: "",
    // Propeller service
    propellerCount: searchParams.get("propellers") || "1",
    // Honeypot — must remain empty. Bots that auto-fill every field will trip this.
    websiteUrl: "",
  });

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToCharge, setAgreedToCharge] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cardState, setCardState] = useState({
    numberComplete: false,
    expiryComplete: false,
    cvcComplete: false,
  });
  // Per-field card errors. Each Stripe element owns its own slot so a field that
  // becomes valid clears its own message — and one field's error never overwrites
  // (or lingers past) another's. Previously a single shared string was only ever
  // cleared by the Number element, so a transient "expiration incomplete" message
  // stuck around even after the expiry field was filled correctly.
  const [cardErrors, setCardErrors] = useState({ number: null, expiry: null, cvc: null });
  const setFieldError = useCallback((field, message) => {
    setCardErrors((prev) => ({ ...prev, [field]: message || null }));
  }, []);
  const cardError = cardErrors.number || cardErrors.expiry || cardErrors.cvc;
  const [turnstileToken, setTurnstileToken] = useState("");

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const estimateAmount = initialEstimate ? parseInt(initialEstimate) : null;

  const allCardComplete = cardState.numberComplete && cardState.expiryComplete && cardState.cvcComplete;

  const turnstileOk = !TURNSTILE_SITE_KEY || !!turnstileToken;

  // Recurring iff cleaning + non-one-time frequency. Drives the wording of the
  // charge-authorization checkbox and whether we capture a recurring terms version.
  const isRecurring = isCleaningService && form.frequency !== "one_time";

  // Typed-name match is intentionally case- and whitespace-insensitive — chargeback
  // defense doesn't need exact casing, just evidence the customer actively typed
  // their own name. Empty typedName fails because customerName is required.
  const normalizedTyped = typedName.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedCustomer = (form.customerName || "").trim().toLowerCase().replace(/\s+/g, " ");
  const typedNameMatches = normalizedTyped.length > 0 && normalizedTyped === normalizedCustomer;

  // Berkeley-only: the boat must be berthed in Berkeley (the marina field).
  // Item recovery has no marina, so it's exempt. Mirrors the server gate.
  const boatBerthOk = isItemRecovery || isBerkeleyMarina(form.marina);

  const canSubmit =
    form.customerName &&
    form.customerEmail &&
    form.billingAddress &&
    form.billingCity &&
    form.billingState &&
    form.billingZip &&
    boatBerthOk &&
    agreedToTerms &&
    agreedToCharge &&
    typedNameMatches &&
    allCardComplete &&
    turnstileOk &&
    !isSubmitting;

  // Cloudflare Turnstile — load the script and render the widget when configured.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const scriptId = "cf-turnstile-script";
    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    const interval = setInterval(() => {
      const target = document.getElementById("cf-turnstile-widget");
      if (window.turnstile && target && !target.dataset.rendered) {
        window.turnstile.render("#cf-turnstile-widget", {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        });
        target.dataset.rendered = "1";
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !stripe || !elements) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const cardNumberElement = elements.getElement(CardNumberElement);

      // Split combined boat type back into hull + type
      const selectedBoatType = BOAT_TYPES.find((t) => t.value === form.boatType);
      const hullType = selectedBoatType?.hull || initialHull;
      const boatPropulsion = selectedBoatType?.type || initialType;

      const formData = {
        boatName: isItemRecovery ? "N/A - Item Recovery" : form.boatName,
        boatLength: isItemRecovery ? "0" : form.boatLength,
        boatMake: isItemRecovery ? "N/A" : form.boatMake,
        boatModel: isItemRecovery ? "N/A" : form.boatModel,
        boatType: boatPropulsion,
        hullType: hullType,
        marinaName: isItemRecovery ? "See recovery location" : form.marina,
        dock: isItemRecovery ? "N/A" : form.dock,
        slipNumber: isItemRecovery ? "N/A" : form.slip,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone,
        billingAddress: form.billingAddress,
        billingCity: form.billingCity,
        billingState: form.billingState,
        serviceInterval: isCleaningService ? form.frequency : "one-time",
        customerNotes: form.notes,
        estimate: estimateAmount || 0,
        service: service.name,
        billingZip: form.billingZip,
        websiteUrl: form.websiteUrl, // honeypot
        turnstileToken,
        serviceDetails: {
          serviceName: service.name,
          boatLength: form.boatLength || initialLength,
          boatType: boatPropulsion,
          hullType: hullType,
          frequency: isCleaningService ? form.frequency : "one-time",
          propellerCount: initialPropellers,
          paintAge: initialPaintAge,
          lastCleaned: initialLastCleaned,
          anodeCount: initialAnodes,
          includesAnodes: parseInt(initialAnodes) > 0,
        },
        // Consent / authorization audit fields — persisted by the edge function
        // into order_authorizations so we can defend chargebacks.
        authorization: {
          typedName: typedName.trim(),
          agreedToTerms,
          agreedToCharge,
          termsVersion: TERMS_VERSION,
          recurringTermsVersion: isRecurring ? TERMS_VERSION : null,
          isRecurring,
          authorizedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          referer: document.referrer || null,
        },
      };

      if (isItemRecovery) {
        formData.recoveryLocation = form.recoveryLocation;
        formData.itemDescription = form.itemDescription;
        formData.dropDate = form.dateLost;
      }
      if (isAnodesOnly) {
        formData.anodeDetails = form.anodeInfo;
      }
      if (isPropellerService) {
        formData.propellerCount = form.propellerCount;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ formData }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create payment intent");
      }

      const { clientSecret, intentType, orderNumber } = await res.json();

      const billingDetails = {
        name: form.customerName,
        email: form.customerEmail,
        phone: form.customerPhone,
        address: {
          line1: form.billingAddress,
          city: form.billingCity,
          state: form.billingState,
          postal_code: form.billingZip,
          country: "US",
        },
      };

      let result;
      if (intentType === "setup") {
        result = await stripe.confirmCardSetup(clientSecret, {
          payment_method: { card: cardNumberElement, billing_details: billingDetails },
        });
      } else {
        result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardNumberElement, billing_details: billingDetails },
        });
      }

      if (result.error) throw result.error;

      setSuccess({ orderNumber });
    } catch (err) {
      console.error("Order submission error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  // ── Success State ──
  if (success) {
    return (
      <div>
        <PageMeta title="Order Confirmed | Brian Cline" />
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600 mb-4">Thank you for your order.</p>
          <p className="text-lg font-medium mb-2">
            Order Number: <span className="font-mono bg-gray-100 px-3 py-1 rounded">{success.orderNumber}</span>
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Your card is securely saved and will be charged after service completion.
            You'll receive a confirmation email shortly.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/hull-cleaning")}>
              Back to Estimator
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div>
      <PageMeta
        title={`Schedule ${service.name} | Brian Cline`}
        description={`Schedule professional ${service.name.toLowerCase()} service on San Francisco Bay.`}
      />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-sky-50 px-6 pt-10 pb-14 mb-8">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 bg-primary-200 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-sky-200 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-sky-600 mb-4">
            <Ship className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Schedule {service.name}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Fill out the form below to get on the schedule.
            {estimateAmount && (
              <span className="block mt-1 font-medium text-[#0073a8]">
                Estimated cost: {formatCurrency(estimateAmount)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-16">
      {/* Mobile: Profile card at top */}
      <div className="lg:hidden mb-6">
        <ProfileCard
          form={form}
          service={service}
          estimateAmount={estimateAmount}
          isItemRecovery={isItemRecovery}
          showFrequency={showFrequency}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Left: Form */}
      <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
        {/* Boat Details (hidden for item recovery) */}
        {showBoatInfo && (
          <SectionCard icon={Ship} title="Boat Details" description="Tell us about your vessel">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Boat Name">
                <Input placeholder="Sea Spirit" value={form.boatName} onChange={(e) => updateField("boatName", e.target.value)} />
              </Field>
              <Field label="Boat Type">
                <select
                  className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                  value={form.boatType}
                  onChange={(e) => updateField("boatType", e.target.value)}
                >
                  {BOAT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Field label="Make">
                <Input placeholder="Beneteau" value={form.boatMake} onChange={(e) => updateField("boatMake", e.target.value)} />
              </Field>
              <Field label="Model">
                <Input placeholder="Oceanis 40.1" value={form.boatModel} onChange={(e) => updateField("boatModel", e.target.value)} />
              </Field>
              <Field label="Length (ft)">
                <Input type="number" placeholder="40" value={form.boatLength} onChange={(e) => updateField("boatLength", e.target.value)} />
              </Field>
            </div>

            {/* Propeller count for propeller service */}
            {isPropellerService && (
              <div className="mt-4">
                <Field label="Number of Propellers">
                  <Input type="number" min="1" max="4" value={form.propellerCount} onChange={(e) => updateField("propellerCount", e.target.value)} />
                </Field>
              </div>
            )}

            {/* Anode info for anodes only */}
            {isAnodesOnly && (
              <div className="mt-4">
                <Field label="Anode Information">
                  <Textarea
                    placeholder="Describe your anode needs — sizes, types, locations, how many you think need replacing..."
                    rows={3}
                    value={form.anodeInfo}
                    onChange={(e) => updateField("anodeInfo", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </SectionCard>
        )}

        {/* Item Recovery Section */}
        {isItemRecovery && (
          <SectionCard icon={MapPin} title="Recovery Location" description="Where did you lose the item?">
            <Field label="Location" required>
              <Textarea
                placeholder="Describe the location — marina name, dock, slip number, approximate area..."
                rows={3}
                value={form.recoveryLocation}
                onChange={(e) => updateField("recoveryLocation", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field label="Item Description" required>
                <Input
                  placeholder="What did you lose? (phone, keys, tool, etc.)"
                  value={form.itemDescription}
                  onChange={(e) => updateField("itemDescription", e.target.value)}
                />
              </Field>
              <Field label="Date Lost">
                <Input
                  type="date"
                  value={form.dateLost}
                  onChange={(e) => updateField("dateLost", e.target.value)}
                />
              </Field>
            </div>
          </SectionCard>
        )}

        {/* Boat Location (not for item recovery) */}
        {showBoatInfo && (
          <SectionCard icon={MapPin} title="Boat Location" description="Where is your boat kept? (Berkeley Marina only)">
            <Field label="Marina" required>
              <Input
                list="bay-area-marinas"
                placeholder="Berkeley Marina"
                value={form.marina}
                onChange={(e) => updateField("marina", e.target.value)}
              />
              <datalist id="bay-area-marinas">
                {BERKELEY_MARINAS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            {form.marina && !isBerkeleyMarina(form.marina) && (
              <p className="text-sm text-amber-700 mt-2">
                We currently only service boats berthed in Berkeley Marina. If your boat is berthed in Berkeley, double-check the marina name — otherwise email <a className="underline" href="mailto:diving@briancline.co">diving@briancline.co</a> and we'll point you to our referral network.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field label="Dock">
                <Input placeholder="C" value={form.dock} onChange={(e) => updateField("dock", e.target.value)} />
              </Field>
              <Field label="Slip">
                <Input placeholder="42" value={form.slip} onChange={(e) => updateField("slip", e.target.value)} />
              </Field>
            </div>
          </SectionCard>
        )}

        {/* Your Information */}
        <SectionCard icon={User} title="Your Information" description="Contact and billing details">
          <Field label="Full Name" required>
            <Input placeholder="John Smith" value={form.customerName} onChange={(e) => updateField("customerName", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Field label="Email" required>
              <Input type="email" placeholder="john@example.com" value={form.customerEmail} onChange={(e) => updateField("customerEmail", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input type="tel" placeholder="(510) 555-1234" value={form.customerPhone} onChange={(e) => updateField("customerPhone", e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Billing Address" required>
              <Input placeholder="123 Main St" value={form.billingAddress} onChange={(e) => updateField("billingAddress", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Field label="City" required>
              <Input placeholder="San Francisco" value={form.billingCity} onChange={(e) => updateField("billingCity", e.target.value)} />
            </Field>
            <Field label="State" required>
              <Input placeholder="CA" value={form.billingState} onChange={(e) => updateField("billingState", e.target.value)} />
            </Field>
            <Field label="ZIP" required>
              <Input placeholder="94107" value={form.billingZip} onChange={(e) => updateField("billingZip", e.target.value)} />
            </Field>
          </div>

          {/* Honeypot — keep this field empty. Bots that auto-fill every input will fail server validation. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: "1px", height: "1px", overflow: "hidden" }}>
            <label htmlFor="website_url">Website (leave blank)</label>
            <input
              type="text"
              id="website_url"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              value={form.websiteUrl}
              onChange={(e) => updateField("websiteUrl", e.target.value)}
            />
          </div>
        </SectionCard>

        {/* Service Details */}
        <SectionCard icon={Wrench} title="Service Details">
          {/* Service summary with frequency */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Service</p>
                <p className="text-base font-semibold text-gray-900">
                  {showFrequency
                    ? `${FREQUENCIES.find((f) => f.value === form.frequency)?.label || ""} ${service.name}`
                    : service.name}
                </p>
              </div>
              {showFrequency && (
                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm cursor-pointer hover:border-[#0073a8] transition-colors"
                    value={form.frequency}
                    onChange={(e) => updateField("frequency", e.target.value)}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {estimateAmount && (
              <p className="text-sm text-gray-500 mt-1">
                Estimated: {formatCurrency(estimateAmount)}{form.frequency !== "one_time" ? " per service" : ""}
              </p>
            )}
          </div>
          <div className="mt-4">
            <Field label="Additional Notes">
              <Textarea
                placeholder="Any special instructions, access codes, or things we should know..."
                rows={3}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </Field>
          </div>
        </SectionCard>

        {/* Payment — Separate Stripe Elements */}
        <SectionCard icon={CreditCard} title="Payment Information" description="Your card will be saved on file — not charged now">
          {/* Card Number */}
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Card Number</Label>
            <div className="border border-gray-200 rounded-md p-3 bg-white">
              <CardNumberElement
                options={STRIPE_ELEMENT_OPTIONS}
                onChange={(e) => {
                  setCardState((prev) => ({ ...prev, numberComplete: e.complete }));
                  setFieldError("number", e.error ? e.error.message : null);
                }}
              />
            </div>
          </div>

          {/* Expiry + CVC side by side */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Expiration</Label>
              <div className="border border-gray-200 rounded-md p-3 bg-white">
                <CardExpiryElement
                  options={STRIPE_ELEMENT_OPTIONS}
                  onChange={(e) => {
                    setCardState((prev) => ({ ...prev, expiryComplete: e.complete }));
                    setFieldError("expiry", e.error ? e.error.message : null);
                  }}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">CVC</Label>
              <div className="border border-gray-200 rounded-md p-3 bg-white">
                <CardCvcElement
                  options={STRIPE_ELEMENT_OPTIONS}
                  onChange={(e) => {
                    setCardState((prev) => ({ ...prev, cvcComplete: e.complete }));
                    setFieldError("cvc", e.error ? e.error.message : null);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Billing ZIP (plain input, already collected above but Stripe needs it too) */}
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Billing ZIP Code</Label>
            <Input
              placeholder="94107"
              value={form.billingZip}
              onChange={(e) => updateField("billingZip", e.target.value)}
              className="max-w-[200px]"
            />
          </div>

          {cardError && (
            <p className="text-red-500 text-sm mt-2">{cardError}</p>
          )}

          {/* Cloudflare Turnstile (renders only when VITE_TURNSTILE_SITE_KEY is configured). */}
          {TURNSTILE_SITE_KEY && (
            <div className="mt-4">
              <div id="cf-turnstile-widget" />
            </div>
          )}

          {/* Authorization & Service Agreement */}
          <div className="mt-6 border rounded-lg p-4 bg-gray-50 space-y-3">
            <h4 className="font-semibold text-gray-900">Authorization & Service Agreement</h4>

            <p className="text-sm text-gray-700">
              <strong>Billing:</strong> Your card will be charged only after service completion.
              {estimateAmount && (
                <> Today's estimate: <span className="font-medium">{formatCurrency(estimateAmount)}</span>.</>
              )}
            </p>

            <p className="text-sm text-gray-700">
              <strong>Estimate Notice:</strong> The final amount may vary from the estimate based on actual conditions found during service. Common variations include:
            </p>

            <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1">
              <li>Heavier marine growth than expected (+50% to +100%, up to +200% in rare, extreme cases)</li>
              <li>Additional anode replacements needed (per-anode pricing)</li>
            </ul>

            <p className="text-sm text-gray-700">
              All variations are documented in your service log and underwater video.
            </p>

            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="agree-terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="agree-terms" className="text-sm text-gray-700 cursor-pointer leading-snug">
                I have read and agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0073a8] underline">Terms of Service</a>
                {isRecurring && (
                  <>
                    {" "}and{" "}
                    <a href="/recurring-authorization" target="_blank" rel="noopener noreferrer" className="text-[#0073a8] underline">Recurring Authorization Agreement</a>
                  </>
                )}.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agree-charge"
                checked={agreedToCharge}
                onChange={(e) => setAgreedToCharge(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="agree-charge" className="text-sm text-gray-700 cursor-pointer leading-snug">
                {isRecurring ? (
                  <>
                    I authorize SailorSkills to charge my saved card for <strong>each scheduled service</strong> at the price documented in that service's report. I understand each charge may include surcharges for heavy growth or extra anodes, documented with photos. I can cancel any time before the next service by emailing diving@briancline.co.
                  </>
                ) : (
                  <>
                    I authorize SailorSkills to save my card and charge it for this service at the price documented in the service report (which may exceed the estimate based on conditions found).
                  </>
                )}
              </label>
            </div>

            <Field label="Type your full legal name to authorize" required>
              <Input
                id="typed-name"
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Must match the name above"
                aria-describedby="typed-name-help"
              />
              <p id="typed-name-help" className="mt-1 text-xs text-gray-500">
                Your typed name + click is treated as your electronic signature under federal E-SIGN and California UETA.
                {form.customerName && !typedNameMatches && typedName.length > 0 && (
                  <span className="block text-amber-700 mt-0.5">
                    Doesn't match "{form.customerName}" yet.
                  </span>
                )}
              </p>
            </Field>
          </div>
        </SectionCard>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Failed to submit order</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/*
         * Missing-fields callout — shown whenever the submit button is disabled.
         * Without this, users with incomplete forms see only a greyed-out button
         * and no explanation of what's still needed (the bug Craig Maurer hit
         * on 2026-04-08, where he replied "I was unable to submit info on the form").
         */}
        {!canSubmit && !isSubmitting && (() => {
          const missing = [];
          if (!form.customerName) missing.push("Full Name");
          if (!form.customerEmail) missing.push("Email");
          if (!form.billingAddress) missing.push("Billing Address");
          if (!form.billingCity) missing.push("City");
          if (!form.billingState) missing.push("State");
          if (!form.billingZip) missing.push("ZIP");
          if (!boatBerthOk) missing.push("Boat berthed in Berkeley Marina");
          if (!cardState.numberComplete) missing.push("Card number");
          if (!cardState.expiryComplete) missing.push("Card expiration");
          if (!cardState.cvcComplete) missing.push("Card CVC");
          if (!agreedToTerms) missing.push("Terms of Service checkbox");
          if (!agreedToCharge) missing.push("Charge authorization checkbox");
          if (form.customerName && !typedNameMatches) missing.push("Typed name matching the name above");
          if (TURNSTILE_SITE_KEY && !turnstileToken) missing.push("Verification");
          if (missing.length === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900">
                  Before you can submit, please complete:
                </p>
                <ul className="text-sm text-amber-800 list-disc ml-5 mt-1 space-y-0.5">
                  {missing.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="bg-[#0073a8] text-white hover:bg-[#005f8a] px-8 h-12 text-lg font-semibold rounded-xl disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Authorize & Save Card
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Right: Sticky profile card */}
      <div className="lg:col-span-2 hidden lg:block">
        <div
          className="lg:sticky"
          style={{
            top: "calc(50vh - 240px)",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
          }}
        >
          <ProfileCard
            form={form}
            service={service}
            estimateAmount={estimateAmount}
            isItemRecovery={isItemRecovery}
            showFrequency={showFrequency}
          />
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}

// ── Main Component (wraps in Elements provider) ──
export default function DivingOrder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [stripeReady, setStripeReady] = useState(null);

  useEffect(() => {
    getStripePromise().then((s) => setStripeReady(s));
  }, []);

  if (!stripeReady) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0073a8]" />
      </div>
    );
  }

  return (
    <Elements stripe={stripeReady}>
      <OrderForm searchParams={searchParams} navigate={navigate} />
    </Elements>
  );
}
