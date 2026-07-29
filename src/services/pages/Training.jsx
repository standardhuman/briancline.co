import React from "react";
import { Link } from "react-router-dom";
import PageHero from "../components/PageHero";
import PageCTA from "../components/PageCTA";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  GraduationCap, Compass, Anchor, Radio, Navigation,
  ShieldCheck, BookOpen, User, Ship, LifeBuoy, Quote,
} from "lucide-react";
import PageMeta from "../components/PageMeta";
import JsonLd from "../components/JsonLd";
import OptImage from "../components/OptImage";

const skills = [
  { icon: Anchor, label: "Line Handling & Docking" },
  { icon: LifeBuoy, label: "Emergency Procedures" },
  { icon: Navigation, label: "Navigation & Chart Work" },
  { icon: Radio, label: "VHF Communications" },
  { icon: Ship, label: "Singlehanding" },
  { icon: Compass, label: "Seamanship & Local Knowledge" },
];

const testimonials = [
  {
    name: "Emily Richards",
    title: "Film Producer",
    image: "/images/training/emily.jpg",
    quote: "Brian is the best kind of instructor there is. He quickly observed how I learned and adapted his style for me. He is extremely patient and incredibly knowledgeable about all aspects of sailing. The thing I loved the most about taking lessons with Brian is that I felt he had complete confidence in me. He allowed me to make (safe) mistakes and work through what went wrong, which is how I like to learn.",
  },
  {
    name: "Evan McDonald",
    title: "Three-time Bay Area Multihull Champion",
    image: "/images/training/evan.jpg",
    quote: "Brian is an effective teacher, with a style that builds confidence and mastery in his students. Unlike other teachers who tell you too exactly what to do, or don't assist when a student really needs help, Brian knows just how much to guide a student to maximize learning by doing. Brian's students learn to be sailors who think for themselves and sail with confidence with a proper safety mindset.",
  },
  {
    name: "Aimee P",
    title: "Adult Educator",
    image: "/images/training/aimee.png",
    quote: "Brian is the most patient and skilled teacher I have met in all of my 37 years of any subject both in person and online. He is incredibly organized with his content and has a gift in quickly assessing which teaching methods are most compatible with each individual student's needs. I would highly recommend him for any student seeking sailing instruction.",
  },
];

export default function Training() {
  return (
    <div>
      <PageMeta
        title="Sailing Lessons on San Francisco Bay | Brian Cline"
        description="Learn to sail on San Francisco Bay directly with a US Sailing Cruising Instructor and former high-speed ferry captain. Private and small-group sailing lessons from basic keelboat to offshore passage making. Nearly 20 years of teaching experience."
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Sailing Lessons - San Francisco Bay",
        "description": "Private and small-group sailing instruction on San Francisco Bay, taught directly by a US Sailing Cruising Instructor and former high-speed ferry captain with nearly 20 years of experience. Beginner through advanced offshore passage making.",
        "provider": { "@id": "https://briancline.co/#vessel-management" },
        "areaServed": { "@type": "Place", "name": "San Francisco Bay Area" },
        "serviceType": "Sailing Instruction",
        "url": "https://briancline.co/sailing-lessons"
      }} />
      <PageHero
        title="Private Sailing and Powerboat Lessons"
        subtitle="One-on-one instruction on your boat, tailored to your goals. No group classes, no strangers — just you, your boat, and a decade of teaching experience."
        credentials="Former Ferry Captain · US Sailing Cruising Instructor"
        cta="Book a Free Consultation"
        ctaHref="https://schedule.briancline.co/sailing"
        image="/images/brian-sailing.png"
        imageAlt="Brian Cline at the helm on San Francisco Bay"
      />

      {/* The Approach */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Your Boat. Your Goals.</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Every lesson happens on your boat, in your slip, on the water you actually sail. No classrooms, no shared boats with strangers. You learn the systems you'll actually use.
                </p>
                <p>
                  I teach you to think through situations, not just follow a checklist. That means you'll handle the unexpected — an engine that won't start, a sudden wind shift, a tight dock under pressure — because you understand what's happening, not just what to do.
                </p>
                <p>
                  Singlehanding is part of every lesson plan. Even if you usually sail with crew, knowing you can handle the boat alone changes everything about your confidence on the water.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <OptImage
                src="/images/training/brian-sailing.jpg"
                alt="Brian teaching on San Francisco Bay"
                className="rounded-2xl shadow-lg max-h-96 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground mb-10 text-center">Skills Covered</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {skills.map(({ icon: Icon, label }) => (
              <Card key={label} className="p-5 flex items-center gap-3">
                <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="font-medium text-foreground text-sm">{label}</span>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground mb-10 text-center">What Students Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="p-6">
                <Quote className="w-6 h-6 text-primary/30 mb-3" />
                <p className="text-gray-600 text-sm leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                  <OptImage src={t.image} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <div className="font-semibold text-foreground text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.title}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground mb-10 text-center">What's Included</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: User, title: "Free Consultation", desc: "We'll talk through your experience, goals, and what you want to get out of lessons." },
              { icon: ShieldCheck, title: "Vessel Inspection", desc: "Before your first lesson, I'll look over your boat's safety gear and systems." },
              { icon: GraduationCap, title: "Satisfaction Guarantee", desc: "If a lesson doesn't meet your expectations, I'll make it right." },
              { icon: BookOpen, title: "Online Resources", desc: "Access to reference materials and guides between sessions." },
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

      {/* About the Instructor */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center">
              <OptImage
                src="/images/training/brian-headshot.png"
                alt="Brian Cline, US Sailing Cruising Instructor"
                className="rounded-2xl shadow-lg max-h-96 object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">About Your Instructor</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Over more than a decade of instructing, hundreds of students have entrusted me to develop their confidence as recreational and professional mariners in the most challenging conditions around. From fundamental sailing skills to long-distance cruising, I specialize in calm, high-quality training tailored to your specific goals.
                </p>
                <p>
                  Your training starts with a free 1-hour planning session and complimentary vessel inspection. Together we'll discuss your goals, go over your vessel, and develop a plan that works for you. You'll leave knowing how to move forward in a practical, actionable way — and you'll know exactly what your boat needs, if anything, to be a safe, functional vessel.
                </p>
              </div>
              <p className="mt-6 font-medium text-foreground">
                — Brian Cline<br />
                <span className="text-sm text-gray-500">Former Ferry Captain · US Sailing Cruising Instructor</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">Have Questions?</h2>
          <p className="text-gray-600 mb-6">Rates, cancellations, insurance, what to expect — it's all covered.</p>
          <Link
            to="/sailing-lessons/faq"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6"
          >
            Read the FAQ
          </Link>
        </div>
      </section>

      <PageCTA
        title="Schedule Your Free Consultation"
        subtitle="Tell me about your boat and what you'd like to learn. No obligation."
        buttonText="Get Started"
        href="https://schedule.briancline.co/sailing"
      />
    </div>
  );
}
