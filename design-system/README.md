# BC Marine — Design System ("Captain's Brass")

The visual system for **briancline.co/marine** — Brian Cline's marine services on
San Francisco Bay (hull cleaning, boat detailing, sailing lessons, vessel deliveries).

## Positioning: cousin, not twin

BC Marine is its **own entity**, separate from SailorSkills even though both are Brian's.
The system is built to read as a **cousin** of his other ventures, never a clone:

- **Shared DNA** (ties it to Brian's world): deep navy `#0a1628` + cyan `#00bcd4` — taken
  from the briancline.co homepage. Cyan is used **sparingly** (links, small accents only).
- **BC Marine's own** (sets it apart from SailorSkills): **brass** `#b8863b` as the signature
  accent and primary CTA, **Space Grotesk** headlines over **Inter** body, and a warm
  **paper** canvas `#faf8f4` instead of SailorSkills' cool app-gray.

## Contents

```
design-system/
├── tokens.css              # All design tokens (CSS custom properties + Tailwind v4 @theme block)
├── components/             # Reference React components (token-driven, framework-agnostic)
│   ├── Button.jsx          # cta / navy / secondary / ghost / link-cyan
│   ├── ServiceCard.jsx     # icon chip + title + tagline + CTA (the landing pattern)
│   ├── TrustBand.jsx       # navy credentials band with brass edge
│   ├── CredentialPill.jsx  # cred / brass / cyan / success
│   └── Hero.jsx            # navy gradient hero with brass edge + cyan highlight
└── previews/               # Design System cards (rendered in Claude Design)
    ├── colors.html
    ├── typography.html
    ├── buttons.html
    ├── service-cards.html
    ├── trust-and-pills.html
    └── hero.html
```

## Usage

- **In code:** import `tokens.css` once, then the components consume the CSS variables.
  To adopt in the existing Vite/React SPA, paste the `@theme` block (bottom of `tokens.css`)
  into `src/services/styles.css` and load Space Grotesk + Inter from Google Fonts.
- **In Claude Design:** this folder is synced as an org design system via `/design-sync`
  (Claude Code's `DesignSync`). Bind it to a project, then design `/marine` against it.

## Principles

1. **One brass action per view.** Brass is the signature — keep it rare so it stays premium.
2. **Cyan is a tell, not a fill.** Inline links and small accents only; never large surfaces.
3. **Scannable in ~5 seconds.** Generous whitespace, editorial scale, photography-forward.
4. **Maritime, not kitsch.** Brass evokes a ship's fittings — no rope fonts or cartoon anchors.
