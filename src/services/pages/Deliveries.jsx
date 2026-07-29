import React, { useState } from "react";
import PageHero from "../components/PageHero";
import PageCTA from "../components/PageCTA";
import OptImage from "../components/OptImage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  ClipboardCheck, Ship, Route, MapPin, Handshake,
  DollarSign, Clock, Users, Send, CheckCircle2,
} from "lucide-react";
import PageMeta from "../components/PageMeta";
import JsonLd from "../components/JsonLd";

const steps = [
  { icon: ClipboardCheck, title: "Consultation", desc: "Free discussion about your delivery — origin, destination, timeline, any special requirements." },
  { icon: Ship, title: "Vessel Inspection", desc: "I'll review your boat's systems, safety gear, and readiness for the passage." },
  { icon: Route, title: "Route Planning", desc: "Weather windows, fuel stops, harbor entries — all planned before we leave the dock." },
  { icon: MapPin, title: "Delivery", desc: "Professional, careful transit. Regular updates along the way." },
  { icon: Handshake, title: "Handoff", desc: "Walk-through at the destination. Everything documented." },
];

/* ═══════════════════════════════════════════
   Delivery Inquiry Form
   ═══════════════════════════════════════════ */

const DELIVERY_API_URL = "/api/delivery-inquiry";

function DeliveryInquiryForm() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    vesselMake: "", vesselModel: "", vesselLength: "", vesselYear: "", vesselCondition: "",
    currentMarina: "", currentCity: "",
    destMarina: "", destCity: "",
    schedule: "", deadline: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(DELIVERY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send");
      setSubmitted(true);
    } catch {
      setError("Failed to send. Email deliveries@briancline.co directly.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="text-center p-10">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Inquiry Sent!</h3>
        <p className="text-gray-600">Brian will review your delivery details and get back to you within 24 hours to discuss the plan.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Request a Delivery Quote</CardTitle>
        <CardDescription>Tell me about your vessel and where it needs to go. I'll get back to you within 24 hours.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vessel Details */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Vessel Details</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Make</Label><Input value={form.vesselMake} onChange={updateField("vesselMake")} placeholder="e.g. Beneteau" /></div>
              <div><Label>Model</Label><Input value={form.vesselModel} onChange={updateField("vesselModel")} placeholder="e.g. Oceanis 40.1" /></div>
              <div><Label>Length (ft)</Label><Input type="number" value={form.vesselLength} onChange={updateField("vesselLength")} placeholder="e.g. 40" /></div>
              <div><Label>Year</Label><Input type="number" value={form.vesselYear} onChange={updateField("vesselYear")} placeholder="e.g. 2019" /></div>
            </div>
            <div className="mt-4">
              <Label>Overall Condition</Label>
              <Input value={form.vesselCondition} onChange={updateField("vesselCondition")} placeholder="Good — well-maintained, all systems operational" />
            </div>
          </div>

          {/* Current Location */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Current Location</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Marina</Label><Input value={form.currentMarina} onChange={updateField("currentMarina")} placeholder="e.g. Berkeley Marina" /></div>
              <div><Label>City</Label><Input value={form.currentCity} onChange={updateField("currentCity")} placeholder="e.g. Berkeley, CA" /></div>
            </div>
          </div>

          {/* Destination */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Destination</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Marina</Label><Input value={form.destMarina} onChange={updateField("destMarina")} placeholder="e.g. Channel Islands Harbor" /></div>
              <div><Label>City</Label><Input value={form.destCity} onChange={updateField("destCity")} placeholder="e.g. Oxnard, CA" /></div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Schedule</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>When does it need to happen?</Label><Input value={form.schedule} onChange={updateField("schedule")} placeholder="e.g. April 2026, flexible on dates" /></div>
              <div><Label>Deadline (if any)</Label><Input value={form.deadline} onChange={updateField("deadline")} placeholder="e.g. Must arrive by April 15" /></div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Contact Information</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input required value={form.name} onChange={updateField("name")} /></div>
              <div><Label>Email *</Label><Input type="email" required value={form.email} onChange={updateField("email")} /></div>
              <div className="md:col-span-2"><Label>Phone</Label><Input type="tel" value={form.phone} onChange={updateField("phone")} placeholder="(510) 555-1234" /></div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Additional Notes</Label>
            <Textarea value={form.notes} onChange={updateField("notes")} placeholder="Anything else — crew preferences, insurance details, vessel quirks, etc." rows={4} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
          )}

          <Button type="submit" disabled={submitting} className="w-full gap-2">
            <Send className="w-4 h-4" />
            {submitting ? "Sending..." : "Submit Delivery Inquiry"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Deliveries() {
  return (
    <div>
      <PageMeta
        title="Vessel Deliveries – West Coast & Beyond | Brian Cline"
        description="Professional vessel delivery along the West Coast and beyond. Former high-speed ferry captain with extensive coastal and offshore passage experience. Free consultation."
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Vessel Deliveries - West Coast",
        "description": "Professional vessel delivery along the US West Coast and beyond. Former high-speed ferry captain with extensive coastal and offshore passage experience.",
        "provider": { "@id": "https://briancline.co/#vessel-management" },
        "areaServed": { "@type": "Place", "name": "US West Coast" },
        "serviceType": "Vessel Delivery",
        "url": "https://briancline.co/deliveries"
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "What about weather delays?", "acceptedAnswer": { "@type": "Answer", "text": "Standby rate applies when we're waiting for a safe weather window. I won't push through unsafe conditions to save money. Good route planning minimizes delays — most deliveries go smoothly." }},
          { "@type": "Question", "name": "Can I come along on the delivery?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. Many owners join for all or part of the trip. It's a great way to learn your boat on a real passage. You're welcome aboard as long as you're comfortable with the conditions." }},
          { "@type": "Question", "name": "What about insurance?", "acceptedAnswer": { "@type": "Answer", "text": "I carry professional liability insurance. Your boat should be covered under your own marine insurance policy for the transit. I'll ask for a copy of your policy before departure." }},
          { "@type": "Question", "name": "What areas do you cover?", "acceptedAnswer": { "@type": "Answer", "text": "Primarily the West Coast — San Francisco Bay to Alaska, Mexico, and everything in between. Deliveries to Hawaii and through the Canal are also available." }}
        ]
      }} />
      <PageHero
        title="Vessel Deliveries"
        subtitle="Safe, professional boat delivery along the West Coast and beyond. Your boat gets there in the same condition it left — or better."
        credentials="Former Ferry Captain · Experienced offshore and coastal passages"
        cta="Plan Your Delivery"
        ctaHref="#inquiry"
        image="/images/deliveries/boat.jpg"
        imageAlt="View from the cockpit of a sailboat underway"
      />

      {/* Process */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground mb-12 text-center">The Process</h2>
          <div className="grid md:grid-cols-5 gap-6">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1 text-sm">{title}</h3>
                <p className="text-gray-600 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rates */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground mb-10 text-center">Rates</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">On-Duty (Underway)</h3>
                  <p className="text-xs text-gray-500">Captain actively navigating</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Captain rate</span>
                  <span className="font-semibold">$100/hr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Daily maximum</span>
                  <span className="font-semibold">$1,200/day</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Standby</h3>
                  <p className="text-xs text-gray-500">Waiting for weather, parts, etc.</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Captain rate</span>
                  <span className="font-semibold">$50/hr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Daily maximum</span>
                  <span className="font-semibold">$600/day</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="mt-6 p-4 bg-primary/5 border-primary/10">
            <p className="text-sm text-gray-600">
              <strong className="text-foreground">Additional costs:</strong> Fuel, provisioning, dockage, and return travel are billed at cost. Crew rates available for larger vessels or longer passages. Free initial consultation to discuss your specific needs.
            </p>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Common Questions</h2>
          <Accordion type="single" collapsible>
            {[
              { q: "What about weather delays?", a: "Standby rate applies when we're waiting for a safe weather window. I won't push through unsafe conditions to save money. That said, good route planning minimizes delays — most deliveries go smoothly." },
              { q: "Can I come along on the delivery?", a: "Absolutely. Many owners join for all or part of the trip. It's a great way to learn your boat on a real passage. You're welcome aboard as long as you're comfortable with the conditions." },
              { q: "What about insurance?", a: "I carry professional liability insurance. Your boat should be covered under your own marine insurance policy for the transit. I'll ask for a copy of your policy before departure." },
              { q: "Who makes safety decisions during the delivery?", a: "I do. As captain, I have final authority on route, timing, and go/no-go decisions. That's non-negotiable and it's for the safety of the crew and your vessel." },
              { q: "What areas do you cover?", a: "Primarily the West Coast — San Francisco Bay to Alaska, Mexico, and everything in between. I've done deliveries to Hawaii and through the Canal. Reach out with your route and I'll let you know." },
            ].map(({ q, a }, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-base">{q}</AccordionTrigger>
                <AccordionContent>{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Delivery Inquiry Form */}
      <section className="py-16 md:py-24 bg-gray-50" id="inquiry">
        <div className="max-w-2xl mx-auto px-6">
          <DeliveryInquiryForm />
        </div>
      </section>

      <PageCTA
        title="Let's Plan Your Delivery"
        subtitle="Fill out the form above or reach out directly."
        buttonText="Request a Quote"
        href="#inquiry"
      />
    </div>
  );
}
