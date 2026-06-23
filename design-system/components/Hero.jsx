import React from "react";

/**
 * BC Marine — Hero (Captain's Brass)
 *
 * Deep navy gradient (matches briancline.co), brass eyebrow + brass bottom edge,
 * one cyan-highlighted phrase as the family "tell".
 *
 * Props:
 *   eyebrow    string (uppercase brass label)
 *   title      string
 *   highlight  string — optional sub-phrase rendered in cyan within/after the title
 *   subtitle   string
 *   credline   string (USCG Master · US Sailing · years)
 *   children   optional CTA(s) — e.g. <Button variant="cta">…</Button>
 */

const heroWrap = {
  position: "relative",
  background: "var(--grad-navy)",
  color: "var(--on-navy)",
  padding: "76px 0 84px",
};

const heroEdge = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "3px",
  background: "var(--grad-brass)",
};

const heroInner = { maxWidth: "1080px", margin: "0 auto", padding: "0 24px" };

const heroEyebrow = {
  fontFamily: "var(--font-display)",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: ".16em",
  color: "var(--brass-light)",
  margin: "0 0 12px",
};

const heroTitle = {
  fontFamily: "var(--font-display)",
  color: "#fff",
  fontSize: "54px",
  fontWeight: 600,
  lineHeight: 1.03,
  letterSpacing: "-0.02em",
  margin: 0,
  maxWidth: "15ch",
};

const heroSub = {
  fontFamily: "var(--font-sans)",
  color: "rgba(255,255,255,.74)",
  fontSize: "18px",
  fontWeight: 400,
  maxWidth: "56ch",
  margin: "20px 0 0",
};

const heroCred = {
  fontFamily: "var(--font-display)",
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--brass-light)",
  margin: "24px 0 0",
};

export default function Hero({ eyebrow, title, highlight, subtitle, credline, children }) {
  return (
    <header style={heroWrap} className="bcm-hero">
      <div style={heroInner}>
        {eyebrow ? <p style={heroEyebrow}>{eyebrow}</p> : null}
        <h1 style={heroTitle}>
          {title}
          {highlight ? <span style={{ color: "var(--cyan)" }}> {highlight}</span> : null}
        </h1>
        {subtitle ? <p style={heroSub}>{subtitle}</p> : null}
        {children ? <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "28px" }}>{children}</div> : null}
        {credline ? <p style={heroCred}>{credline}</p> : null}
      </div>
      <span style={heroEdge} aria-hidden="true" />
    </header>
  );
}
