# Mobile Checkout Summary Design

## Goal

Keep the hull-cleaning checkout focused on the form on mobile while preserving the useful sticky boat and estimate summary beside the form on desktop.

## Current behavior and root cause

`DivingOrder` renders `ProfileCard` twice:

- once in a mobile-only wrapper above the checkout form; and
- once in a desktop-only sticky sidebar.

The mobile copy is a large, redundant first block that pushes the checkout form below the fold. The desktop sidebar is correctly placed and remains useful.

## Approved behavior

- Below the Tailwind `lg` breakpoint, do not render the profile card.
- At `lg` and wider, keep the existing sticky sidebar and its live boat, owner, service, and estimate details unchanged.
- Keep the quoted estimate visible on mobile in the checkout hero and in the existing checkout/payment content. Do not introduce a replacement mobile summary component.
- Do not change checkout data, pricing, validation, provider routing, payment behavior, or submission behavior.

## Implementation

Remove the mobile-only `ProfileCard` wrapper from `DivingOrder`. Retain the desktop-only `lg:col-span-2 hidden lg:block` sidebar without modification.

## Verification

Add a browser regression test that loads a representative checkout URL and confirms:

- at a mobile viewport, the quoted estimate is visible and the `Your Boat` profile card is absent;
- at a desktop viewport, the `Your Boat` profile card remains visible beside the form; and
- no order is submitted during either check.

Run the focused browser test, the relevant unit suite, and the production build.
