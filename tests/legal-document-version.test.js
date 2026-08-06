import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  ACTIVE_VERSION,
  RECURRING_AUTHORIZATION,
  TERMS_OF_SERVICE,
} from "../src/services/pages/legal/terms-content.js";

const EXPECTED_VERSION = "2026-08-05";
const EXPECTED_EFFECTIVE_DATE = "August 5, 2026";
const EXPECTED_TERMS_HASH =
  "5877411a2992ecc21b7451763e8f22b113fa424a46b12d477b32cd4ef8eb25c3";
const EXPECTED_RECURRING_HASH =
  "39d9489ac23233f268d499d31109b8cd30e9e57373d52759c49f3cda776644f9";
const OLD_BANNER =
  "**Version 2026-05-01 — PLACEHOLDER PENDING ATTORNEY REVIEW**";

function normalize(body) {
  return body.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

function sha256(body) {
  return createHash("sha256").update(normalize(body), "utf8").digest("hex");
}

describe("legal document version contract", () => {
  test("publishes the pinned 2026-08-05 legal documents without changing history", () => {
    const terms = TERMS_OF_SERVICE[EXPECTED_VERSION];
    const recurring = RECURRING_AUTHORIZATION[EXPECTED_VERSION];

    expect(ACTIVE_VERSION).toBe(EXPECTED_VERSION);
    expect(terms).toBeDefined();
    expect(recurring).toBeDefined();
    expect(terms.effectiveDate).toBe(EXPECTED_EFFECTIVE_DATE);
    expect(recurring.effectiveDate).toBe(EXPECTED_EFFECTIVE_DATE);
    expect(sha256(terms.body)).toBe(EXPECTED_TERMS_HASH);
    expect(sha256(recurring.body)).toBe(EXPECTED_RECURRING_HASH);

    for (const body of [terms.body, recurring.body]) {
      expect(body).not.toContain("PLACEHOLDER PENDING ATTORNEY REVIEW");
      expect(body).not.toContain(OLD_BANNER);
    }

    expect(TERMS_OF_SERVICE["2026-05-01"].body).toContain(OLD_BANNER);
    expect(RECURRING_AUTHORIZATION["2026-05-01"].body).toContain(OLD_BANNER);
  });

  test("checkout derives its submitted legal version from ACTIVE_VERSION", () => {
    const checkoutPath = fileURLToPath(
      new URL("../src/services/pages/DivingOrder.jsx", import.meta.url),
    );
    const checkoutSource = readFileSync(checkoutPath, "utf8");

    expect(ACTIVE_VERSION).toBe(EXPECTED_VERSION);
    expect(checkoutSource).toMatch(
      /import\s*{\s*ACTIVE_VERSION\s*}\s*from\s*["']\.\/legal\/terms-content["'];/,
    );
    expect(checkoutSource).toContain("const TERMS_VERSION = ACTIVE_VERSION;");
    expect(checkoutSource).not.toMatch(
      /const\s+TERMS_VERSION\s*=\s*["']\d{4}-\d{2}-\d{2}["'];/,
    );
  });
});
