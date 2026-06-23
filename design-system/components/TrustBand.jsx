import React from "react";

/**
 * BC Marine — TrustBand (Captain's Brass)
 *
 * Navy band with brass left-edge and brass stat numbers — credentials treated
 * as earned, not a footnote.
 *
 * Props:
 *   stats  Array<{ n: string, l: string }>  e.g. [{ n: "20 years", l: "on San Francisco Bay" }]
 */

const bandWrap = {
  position: "relative",
  overflow: "hidden",
  background: "var(--navy)",
  color: "#fff",
  borderRadius: "var(--r-xl)",
  padding: "34px",
  display: "flex",
  flexWrap: "wrap",
  gap: "32px",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "var(--shadow-lg)",
};

const bandEdge = {
  content: '""',
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: "4px",
  background: "var(--grad-brass)",
};

const statN = {
  fontFamily: "var(--font-display)",
  fontSize: "26px",
  fontWeight: 600,
  color: "var(--brass-light)",
  letterSpacing: "-0.02em",
};

const statL = {
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  fontWeight: 500,
  color: "rgba(255,255,255,.66)",
  textTransform: "uppercase",
  letterSpacing: ".08em",
  marginTop: "5px",
};

const bandDivider = {
  width: "1px",
  height: "42px",
  background: "rgba(255,255,255,.16)",
};

export default function TrustBand({ stats = [] }) {
  return (
    <div style={bandWrap} className="bcm-trust-band">
      <span style={bandEdge} aria-hidden="true" />
      {stats.map((s, i) => (
        <React.Fragment key={s.l}>
          {i > 0 ? <span style={bandDivider} aria-hidden="true" /> : null}
          <div style={{ textAlign: "center" }}>
            <div style={statN}>{s.n}</div>
            <div style={statL}>{s.l}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
