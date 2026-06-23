import React from "react";

/**
 * BC Marine — CredentialPill (Captain's Brass)
 *
 * Small rounded label. Variants:
 *   "cred"     white + warm border (credentials)
 *   "brass"    brass tint (BC Marine's own accent)
 *   "cyan"     cyan tint (family "tell" — sparingly)
 *   "success"  booking/availability
 */

const pillBase = {
  fontFamily: "var(--font-display)",
  fontSize: "12px",
  fontWeight: 600,
  padding: "7px 14px",
  borderRadius: "var(--r-pill)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  lineHeight: 1,
};

const pillVariants = {
  cred: {
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    color: "var(--navy)",
    boxShadow: "var(--shadow-xs)",
  },
  brass: {
    background: "rgba(184,134,59,.13)",
    color: "var(--brass-dark)",
  },
  cyan: {
    background: "rgba(0,188,212,.12)",
    color: "var(--cyan-deep)",
  },
  success: {
    background: "var(--success-bg)",
    color: "var(--success)",
  },
};

export default function CredentialPill({ variant = "cred", children }) {
  const style = { ...pillBase, ...(pillVariants[variant] || pillVariants.cred) };
  return (
    <span style={style} className={`bcm-pill bcm-pill--${variant}`}>
      {children}
    </span>
  );
}
