import React from "react";

/**
 * BC Marine — Button (Captain's Brass)
 *
 * Variants:
 *   "cta"       brass gradient — the single highest-intent action per view (BC Marine's signature; keep it rare)
 *   "navy"      solid deep navy — secondary action
 *   "secondary" white + warm border — tertiary action
 *   "ghost"     low-emphasis
 *   "link-cyan" inline cyan link — the family "tell" (use sparingly)
 *
 * Renders an <a> when `href` is provided, otherwise a <button>.
 * Styling is token-driven (tokens.css must be loaded).
 */

const btnBase = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "14px",
  padding: "13px 22px",
  borderRadius: "var(--r-sm)",
  border: "1px solid transparent",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  textDecoration: "none",
  lineHeight: 1,
  transition: "transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease",
};

const btnVariants = {
  cta: {
    background: "var(--grad-brass)",
    color: "#fff",
    boxShadow: "var(--shadow-sm)",
  },
  navy: {
    background: "var(--navy)",
    color: "#fff",
    boxShadow: "var(--shadow-sm)",
  },
  secondary: {
    background: "var(--surface)",
    color: "var(--navy)",
    borderColor: "var(--border-strong)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
  },
  "link-cyan": {
    background: "transparent",
    color: "var(--cyan-deep)",
    padding: 0,
    boxShadow: "none",
  },
};

export default function Button({
  variant = "cta",
  href,
  onClick,
  children,
  className = "",
  ...rest
}) {
  const style = { ...btnBase, ...(btnVariants[variant] || btnVariants.cta) };
  const Tag = href ? "a" : "button";
  return (
    <Tag
      href={href}
      onClick={onClick}
      style={style}
      className={`bcm-btn bcm-btn--${variant} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
