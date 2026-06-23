import React from "react";

/**
 * BC Marine — ServiceCard (Captain's Brass)
 *
 * The core landing-page pattern: brass icon chip + title + tagline + CTA link.
 * Pass `secondary` for the de-emphasized Deliveries treatment.
 *
 * Props:
 *   icon      ReactNode (e.g. a Lucide <Anchor /> at 24px)
 *   title     string
 *   tagline   string
 *   note      string (optional small caveat line)
 *   cta       string (link label)
 *   href      string
 *   secondary bool — smaller, lower-emphasis (Vessel Deliveries)
 */

const cardBase = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "26px",
  boxShadow: "var(--shadow-sm)",
  textDecoration: "none",
  color: "inherit",
  transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
};

const cardIcon = {
  width: "48px",
  height: "48px",
  borderRadius: "var(--r-md)",
  background: "rgba(184,134,59,.13)",
  color: "var(--brass-dark)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "18px",
};

const cardTitle = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  color: "var(--text)",
  margin: "0 0 8px",
  letterSpacing: "-0.02em",
};

const cardTagline = {
  fontFamily: "var(--font-sans)",
  margin: "0 0 18px",
  color: "var(--text-secondary)",
};

const cardNote = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--text-muted)",
  fontStyle: "italic",
  margin: "-8px 0 16px",
};

const cardGo = {
  fontFamily: "var(--font-display)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--brass-dark)",
};

export default function ServiceCard({
  icon,
  title,
  tagline,
  note,
  cta,
  href,
  secondary = false,
}) {
  return (
    <a href={href} style={cardBase} className="bcm-service-card">
      <span style={{ ...cardIcon, ...(secondary ? { width: "40px", height: "40px" } : null) }}>
        {icon}
      </span>
      <h3 style={{ ...cardTitle, fontSize: secondary ? "18px" : "21px" }}>{title}</h3>
      <p style={{ ...cardTagline, fontSize: secondary ? "14px" : "15px" }}>{tagline}</p>
      {note ? <p style={cardNote}>{note}</p> : null}
      <span style={cardGo}>
        {cta}
        <span aria-hidden="true">&rarr;</span>
      </span>
    </a>
  );
}
