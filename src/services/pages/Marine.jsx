import React from "react";
import { Link } from "react-router-dom";
import { Waves, Sparkles, Sailboat, Navigation } from "lucide-react";
import PageMeta from "../components/PageMeta";
import JsonLd from "../components/JsonLd";
import OptImage from "../components/OptImage";

/* ── Captain's Brass palette (scoped to this page; see design-system/tokens.css) ── */
const c = {
  navy: "#0a1628",
  cyan: "#00bcd4",
  brassDark: "#7a5a22",
  brassLight: "#d4a85c",
  gradBrass: "linear-gradient(135deg,#c2933f,#8a6526)",
  gradNavy: "linear-gradient(135deg,#0a1628 0%,#0d2137 55%,#0a1628 100%)",
  paper: "#faf8f4",
  surface: "#ffffff",
  subtle: "#f3efe8",
  border: "#e7e1d6",
  text: "#0a1628",
  textSec: "#57534a",
  textMuted: "#8a857a",
  display: "'Space Grotesk', system-ui, sans-serif",
  sans: "'Inter', system-ui, sans-serif",
};

const services = [
  {
    to: "/hull-cleaning",
    Icon: Waves,
    title: "Hull Cleaning",
    body: "Subscription cleaning, inspections, propeller service, and item recovery — diving directed and inspected to a professional captain's standard.",
    cta: "Get an instant estimate",
  },
  {
    to: "/boat-detailing",
    Icon: Sparkles,
    title: "Boat Detailing",
    body: "Wash, wax, brightwork, teak, and interiors for sail and power — managed to one consistent, high standard of care.",
    cta: "Get a quote",
  },
  {
    to: "/sailing-lessons",
    Icon: Sailboat,
    title: "Sailing Lessons",
    body: "Private instruction on San Francisco Bay with a US Sailing Cruising Instructor — from docking and close-quarters to confident offshore passages.",
    cta: "Learn more",
  },
];

const credentials = [
  { n: "Ferry", l: "Former high-speed captain" },
  { n: "US Sailing", l: "Cruising Instructor" },
  { n: "~20 yrs", l: "On San Francisco Bay" },
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": "https://briancline.co/#vessel-management",
  "name": "Brian Cline Vessel Management",
  "url": "https://briancline.co/marine",
  "description":
    "Vessel management on San Francisco Bay — hull cleaning, boat detailing, sailing lessons, and vessel deliveries, directed to a professional captain's standard of care. Serving Berkeley Marina, Oakland, Alameda, Emeryville, Richmond, Sausalito, and San Francisco marinas.",
  "founder": {
    "@type": "Person",
    "@id": "https://briancline.co/#brian-cline",
    "name": "Brian Cline",
  },
  "areaServed": [
    { "@type": "City", "name": "Berkeley", "containedInPlace": { "@type": "State", "name": "California" } },
    { "@type": "City", "name": "Oakland" },
    { "@type": "City", "name": "Alameda" },
    { "@type": "City", "name": "Emeryville" },
    { "@type": "City", "name": "Richmond" },
    { "@type": "City", "name": "San Francisco" },
    { "@type": "City", "name": "Sausalito" },
  ],
  "geo": { "@type": "GeoCoordinates", "latitude": "37.8694", "longitude": "-122.3153" },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Berkeley",
    "addressRegion": "CA",
    "postalCode": "94710",
    "addressCountry": "US",
  },
  "priceRange": "$$",
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Vessel Management Services",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Hull Cleaning", "url": "https://briancline.co/hull-cleaning" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Boat Detailing", "url": "https://briancline.co/boat-detailing" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Sailing Lessons", "url": "https://briancline.co/sailing-lessons" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Vessel Deliveries", "url": "https://briancline.co/deliveries" } },
    ],
  },
};

const scopedCss = `
  .bcm-cta { transition: transform .14s ease, box-shadow .14s ease, filter .14s ease; }
  .bcm-cta:hover { transform: translateY(-1px); box-shadow: 0 14px 34px rgba(10,22,40,.18); filter: brightness(1.04); }
  .bcm-card { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
  .bcm-card:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(10,22,40,.12); border-color: #d8d0c0; }
  .bcm-card:hover .bcm-go { gap: 10px; }
  .bcm-go { transition: gap .16s ease; }
  .bcm-ghost:hover { border-color: #b8863b !important; background: rgba(184,134,59,.04) !important; }
  @media (max-width: 860px) {
    .bcm-hero-grid { grid-template-columns: 1fr !important; }
    .bcm-hero-photo { height: 280px !important; order: -1; }
    .bcm-h1 { font-size: 38px !important; }
    .bcm-pad { padding-left: 22px !important; padding-right: 22px !important; }
  }
`;

const cardBase = {
  display: "flex",
  flexDirection: "column",
  background: c.surface,
  border: `1px solid ${c.border}`,
  borderRadius: 16,
  padding: 26,
  boxShadow: "0 1px 3px rgba(10,22,40,.07)",
  textDecoration: "none",
  color: "inherit",
};

const iconChip = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: "rgba(184,134,59,.13)",
  color: c.brassDark,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 18,
};

const cardTitle = {
  fontFamily: c.display,
  fontWeight: 600,
  fontSize: 21,
  letterSpacing: "-0.02em",
  color: c.navy,
  margin: "0 0 8px",
};

const cardBody = {
  fontFamily: c.sans,
  fontSize: 15,
  lineHeight: 1.5,
  color: c.textSec,
  margin: "0 0 20px",
  flex: 1,
};

const cardGo = {
  fontFamily: c.display,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: c.brassDark,
};

export default function Marine() {
  return (
    <div style={{ fontFamily: c.sans, background: c.paper, color: c.text }}>
      <PageMeta
        title="Vessel Management on San Francisco Bay | Brian Cline"
        description="Hull cleaning, boat detailing, sailing lessons, and vessel deliveries on San Francisco Bay — directed to a professional captain's standard of care. Former high-speed ferry captain, US Sailing Cruising Instructor, nearly 20 years on the water."
      />
      <JsonLd data={localBusinessSchema} />
      <style>{scopedCss}</style>

      {/* HERO */}
      <header style={{ position: "relative", background: c.gradNavy, color: "#fff" }}>
        <div
          className="bcm-hero-grid bcm-pad"
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "60px 40px 66px",
            display: "grid",
            gridTemplateColumns: "1.08fr .92fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: c.display,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: ".16em",
                color: c.brassLight,
                margin: "0 0 18px",
              }}
            >
              Vessel management · San Francisco Bay
            </p>
            <h1
              className="bcm-h1"
              style={{
                fontFamily: c.display,
                fontSize: 50,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                margin: 0,
                maxWidth: "15ch",
              }}
            >
              A professional captain overseeing every job,{" "}
              <span style={{ color: c.cyan }}>above and below the waterline</span>.
            </h1>
            <p
              style={{
                fontFamily: c.sans,
                fontSize: 18,
                lineHeight: 1.55,
                color: "rgba(255,255,255,.74)",
                maxWidth: "48ch",
                margin: "22px 0 0",
              }}
            >
              Hull cleaning, detailing, sailing instruction, and vessel deliveries on San Francisco
              Bay — every job directed and held to a professional captain's standard of care.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "30px 0 0" }}>
              <Link
                to="/hull-cleaning"
                className="bcm-cta"
                style={{
                  fontFamily: c.display,
                  fontWeight: 600,
                  fontSize: 15,
                  padding: "15px 26px",
                  borderRadius: 8,
                  background: c.gradBrass,
                  color: "#fff",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(10,22,40,.18)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Get an instant estimate <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#services"
                style={{
                  fontFamily: c.display,
                  fontWeight: 600,
                  fontSize: 15,
                  padding: "15px 22px",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#fff",
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,.22)",
                }}
              >
                See all services
              </a>
            </div>
            <p
              style={{
                fontFamily: c.display,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: c.brassLight,
                margin: "28px 0 0",
              }}
            >
              Former Ferry Captain · US Sailing Cruising Instructor · ~20 Years on the Bay
            </p>
          </div>

          <div
            className="bcm-hero-photo"
            style={{
              width: "100%",
              height: 400,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 14px 34px rgba(10,22,40,.3)",
            }}
          >
            <OptImage
              src="/images/brian-sailing.png"
              alt="Brian Cline at the helm on San Francisco Bay"
              loading="eager"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        </div>
        <span
          aria-hidden="true"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: c.gradBrass }}
        />
      </header>

      {/* SERVICES */}
      <section
        id="services"
        className="bcm-pad"
        style={{ maxWidth: 1160, margin: "0 auto", padding: "58px 40px 46px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            margin: "0 0 26px",
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontFamily: c.display,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: c.brassDark,
              margin: 0,
            }}
          >
            What we manage
          </p>
          <span style={{ fontFamily: c.sans, fontSize: 14, color: c.textMuted }}>
            Three core services, plus deliveries
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(248px,1fr))", gap: 20 }}>
          {services.map(({ to, Icon, title, body, cta }) => (
            <Link key={to} to={to} className="bcm-card" style={cardBase}>
              <span style={iconChip}>
                <Icon size={24} strokeWidth={2} />
              </span>
              <h2 style={cardTitle}>{title}</h2>
              <p style={cardBody}>{body}</p>
              <span className="bcm-go" style={cardGo}>
                {cta} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Deliveries — secondary */}
        <Link
          to="/deliveries"
          className="bcm-card bcm-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            background: c.subtle,
            border: `1px solid ${c.border}`,
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "none",
            textDecoration: "none",
            color: "inherit",
            marginTop: 20,
          }}
        >
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(10,22,40,.06)",
              color: c.navy,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Navigation size={20} strokeWidth={2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: c.display, fontWeight: 600, fontSize: 16, color: c.navy, margin: "0 0 3px", display: "inline" }}>
              Vessel Deliveries
            </h2>
            <span style={{ fontFamily: c.sans, fontSize: 14, color: c.textSec }}>
              {" "}— professional delivery up and down the West Coast and beyond, captained personally by a former ferry captain.
            </span>
          </div>
          <span className="bcm-go" style={{ ...cardGo, flex: "none", color: c.textSec }}>
            Plan your delivery <span aria-hidden="true">→</span>
          </span>
        </Link>
      </section>

      {/* TRUST BAND */}
      <section className="bcm-pad" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 40px 46px" }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: c.navy,
            color: "#fff",
            borderRadius: 22,
            padding: "30px 34px",
            display: "flex",
            flexWrap: "wrap",
            gap: 32,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 14px 34px rgba(10,22,40,.12)",
          }}
        >
          <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: c.gradBrass }} />
          {credentials.map((cred, i) => (
            <React.Fragment key={cred.l}>
              {i > 0 && <span style={{ width: 1, height: 42, background: "rgba(255,255,255,.16)" }} />}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: c.display, fontSize: 24, fontWeight: 600, color: c.brassLight, letterSpacing: "-0.02em" }}>
                  {cred.n}
                </div>
                <div
                  style={{
                    fontFamily: c.sans,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,.66)",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    marginTop: 5,
                  }}
                >
                  {cred.l}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className="bcm-pad" style={{ maxWidth: 1160, margin: "0 auto", padding: "8px 40px 64px", textAlign: "center" }}>
        <h2 style={{ fontFamily: c.display, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: c.navy, margin: "0 0 8px" }}>
          Questions? Talk to the captain.
        </h2>
        <p style={{ fontFamily: c.sans, fontSize: 16, lineHeight: 1.55, color: c.textSec, maxWidth: "46ch", margin: "0 auto 20px" }}>
          Every inquiry reaches Brian directly — no forms, no call centers. Tell me about your boat
          and what it needs.
        </p>
        <a
          href="mailto:brian@briancline.co?subject=Vessel%20Management%20Inquiry"
          className="bcm-cta"
          style={{
            fontFamily: c.display,
            fontWeight: 600,
            fontSize: 15,
            padding: "14px 24px",
            borderRadius: 8,
            background: c.navy,
            color: "#fff",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Email Brian <span aria-hidden="true">→</span>
        </a>
      </section>
    </div>
  );
}
