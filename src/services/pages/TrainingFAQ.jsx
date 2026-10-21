import React from "react";
import { Link } from "react-router-dom";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";
import PageCTA from "../components/PageCTA";
import PageMeta from "../components/PageMeta";

const faqs = [
  {
    q: "What do I do first?",
    a: `Your training starts with a free consultation. During this 1-hour session, we meet at your boat and get to know one another. I'll want to hear about your experience and your goals, and I'll answer any questions you might have. We'll also go over your boat, and I'll make you a list of any recommended improvements and equipment.

If we decide we'd like to work together, you'll receive an email containing a complete vessel assessment and training application. The Vessel Assessment will include any items specific to your vessel that need to be remedied prior to our first lesson, as well as recommended items.`,
  },
  {
    q: "What if I don't like your instruction style?",
    a: "Consider our first 3 hours of training together an evaluation period. If you aren't happy with your training and do not wish to continue, those 3 hours are on me. No charge and no hard feelings. Seriously.",
  },
  {
    q: "How much training do I need?",
    a: `It depends — and for good reason: this is one of the most asked questions. It's also one of the hardest to answer before we've sailed together. That's why I offer both an hour-long consultation followed by a guarantee-clad first 3 hours.

The biggest prepaid block I offer is 24 hours, about 4 days, which is also the maximum length I'll trust a weather forecast. After the first session, we'll both know more about what the next session should look like, and we'll be in constant conversation about it throughout.`,
  },
  {
    q: "What are your rates?",
    a: `Lessons are $150 per hour, as single sessions or prepaid hour blocks. Rates are independent of the number of students, so you can share with friends and save. Add 3% for credit card payments.

Single sessions: Half-day (3 hours) $450 + tax · Full-day (6.5 hours) $975 + tax

Prepaid hours: 12 hours for $1,620 + tax (save $180) · 24 hours for $3,060 + tax (save $540). Use them in any mix of half and full days. Only your actual time on the water is deducted, so a day that runs long or short is counted exactly.

Returning students: lessons through December 31, 2026 stay at your previous rate.`,
  },
  {
    q: "How do I book or cancel a session?",
    a: "Use the scheduling link on this page to book a free consultation or your first session — you'll pick a time that works and we'll both get a confirmation. For cancellations or reschedules, email or text me.",
  },
  {
    q: "What's the cancellation policy?",
    a: `December–March: Cancel or reschedule for any reason up to 12 hours prior.
April–November: Cancel or reschedule for any reason up to 48 hours prior.

Wind: Either of us may cancel if observed or predicted conditions in our training area exceed 25 knots sustained, 30 knots gusting, or AQI of 100. Your training time will be pro-rated with no minimum.

Rain: If you want to go out in the rain, we will and I'll be there 100%. If you prefer to book another time, we can do that instead. Learning tends to plummet when students are miserable, and I'm not running a production operation — my lessons cater to you.

Vessel/Crew: I reserve the right to terminate a session due to vessel, equipment, or crew unreadiness. Your time will be pro-rated with a minimum of 1 hour billed.`,
  },
  {
    q: "Do I need insurance?",
    a: `You need liability insurance at a minimum. If you've met your marina's requirements, you're probably covered.

I require that I be added to your boat insurance as an additional insured or operator prior to getting underway. Depending on your carrier, this can be done online or with a phone call. Ask your carrier if they have an annual allowance for training — many policies have an exception of 40 hours underway annually for an additional insured instructor at no cost.`,
  },
  {
    q: "Can I bring other people aboard?",
    a: "No extra charge for additional people. I only ask that every person aboard completes the Training Application. Keep me in the loop on what you're thinking, and together we can consider factors like crew objectives, time constraints, cockpit size, and layout.",
  },
  {
    q: "Can I transfer time to another person?",
    a: `Yes — you can designate anyone to receive lessons you've purchased. A transfer (training aboard a different vessel, or the original vessel without the original student) requires: a 1-hour consultation and vessel assessment ($150, or one hour from your prepaid hours), a completed Training Application, the vessel meets safety requirements, and I'm added to the vessel's insurance.`,
  },
  {
    q: "Do the training hours expire?",
    a: "You have one calendar year from the date of purchase to use your lessons. After one year, I may opt to void remaining time and offer a refund at 30% of the purchased value. In practice, this hasn't come close to happening. It's common to underestimate how quickly even 4 days can pass.",
  },
  {
    q: "How do I pay?",
    a: `After the first 3 hours of training, you can: (1) Pay for your current session, (2) Buy a prepaid hour block — your current session counts toward it, or (3) Walk away and pay nothing (see the guarantee above).

Payment is made in person. There is a 10% discount for cash. I also accept Paypal, Venmo, Zelle, and credit cards. Please add 3% for credit card payments.

For deliveries and overnight voyages: Payment in full upon completion of the voyage.`,
  },
];

export default function TrainingFAQ() {
  return (
    <div>
      <PageMeta
        title="Sailing Lessons FAQ – Rates & Policies | Brian Cline"
        description="Rates, prepaid hours, cancellation policy, and insurance requirements for private sailing lessons on San Francisco Bay with Brian Cline."
      />
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-4">
            <Link to="/sailing-lessons" className="text-sm text-primary font-medium hover:underline">← Back to Sailing Lessons</Link>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">Training FAQ</h1>
          <p className="text-gray-600 mb-10">Everything you need to know about how lessons work — rates, cancellations, insurance, and more.</p>

          <Accordion type="single" collapsible className="space-y-0">
            {faqs.map(({ q, a }, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-base">{q}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <PageCTA
        title="Ready to Get Started?"
        subtitle="Book a free consultation — no obligation."
        buttonText="Schedule a Consultation"
        href="https://schedule.briancline.co/sailing"
      />
    </div>
  );
}
