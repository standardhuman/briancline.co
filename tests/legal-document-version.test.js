import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  ACTIVE_VERSION,
  RECURRING_AUTHORIZATION,
  TERMS_OF_SERVICE,
} from "../src/services/pages/legal/terms-content.js";

const EXPECTED_VERSION = "2026-11-02";
const EXPECTED_EFFECTIVE_DATE = "November 2, 2026";
const EXPECTED_TERMS_HASH =
  "a3ad34e8846729f8f17d8d0810f8da1247b46f05b6abdd38c1f4693f16a8a614";
const EXPECTED_RECURRING_HASH =
  "9e49f7431e78c5f86cee44e32ed23608f452fe081fdbe07c0a13676515bf386a";
// Published history: must never change.
const V20261101_TERMS_HASH =
  "953107ae46e15a3be4a9c0e9644d9e16a15ebeab368ee50e8e304b64e584cfb1";
const V20261101_RECURRING_HASH =
  "c7bd75e498c0a9bef1701523b8b19b21be3a45b0e2b906119e3055aad3b94365";
const V20261021_TERMS_HASH =
  "83da6125073d903a33a508130f6034917897525adf672a52a9cc5f04ea825448";
// The recurring text was identical for 2026-08-05 and 2026-10-21.
const V20261021_RECURRING_HASH =
  "39d9489ac23233f268d499d31109b8cd30e9e57373d52759c49f3cda776644f9";
const PRIOR_TERMS_HASH =
  "5877411a2992ecc21b7451763e8f22b113fa424a46b12d477b32cd4ef8eb25c3";
const OLD_BANNER =
  "**Version 2026-05-01 — PLACEHOLDER PENDING ATTORNEY REVIEW**";

function normalize(body) {
  return body.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

function sha256(body) {
  return createHash("sha256").update(normalize(body), "utf8").digest("hex");
}

describe("legal document version contract", () => {
  test("publishes the pinned 2026-11-02 legal documents without changing history", () => {
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
    expect(sha256(TERMS_OF_SERVICE["2026-08-05"].body)).toBe(PRIOR_TERMS_HASH);
    expect(sha256(RECURRING_AUTHORIZATION["2026-08-05"].body)).toBe(
      V20261021_RECURRING_HASH,
    );
    expect(sha256(TERMS_OF_SERVICE["2026-10-21"].body)).toBe(
      V20261021_TERMS_HASH,
    );
    expect(sha256(RECURRING_AUTHORIZATION["2026-10-21"].body)).toBe(
      V20261021_RECURRING_HASH,
    );
    expect(sha256(TERMS_OF_SERVICE["2026-11-01"].body)).toBe(
      V20261101_TERMS_HASH,
    );
    expect(sha256(RECURRING_AUTHORIZATION["2026-11-01"].body)).toBe(
      V20261101_RECURRING_HASH,
    );
  });

  test("2026-10-21 stays frozen as history (payment terms section intact)", () => {
    const terms = TERMS_OF_SERVICE["2026-10-21"];

    expect(terms.effectiveDate).toBe("October 21, 2026");
    expect(terms.body).toContain("## 8. Payment Terms");
    expect(terms.body).toContain("## 9. Dispute Resolution");
    expect(terms.body).toContain("## 13. Data Retention");
    expect(terms.body).toContain(
      "a late charge of 1.5% per month (18% per year) or $25, whichever",
    );

    // The 2026-10-21 recurring authorization was textually unchanged from 2026-08-05.
    expect(RECURRING_AUTHORIZATION["2026-10-21"].body).toBe(
      RECURRING_AUTHORIZATION["2026-08-05"].body,
    );

    // Strip section 8 and undo the renumbering: the remainder must be
    // byte-identical to the 2026-08-05 terms.
    const stripped = terms.body
      .replace(/\n\n## 8\. Payment Terms\n\n[\s\S]*?(?=\n\n## 9\.)/, "")
      .replace(/^## (\d+)\./gm, (match, n) =>
        Number(n) >= 9 ? `## ${Number(n) - 1}.` : match,
      );
    expect(stripped).toBe(TERMS_OF_SERVICE["2026-08-05"].body);
  });

  test("2026-11-02 names the LLC, carries the reworded terms, and documents by video", () => {
    const terms = TERMS_OF_SERVICE[EXPECTED_VERSION].body.replace(/\s+/g, " ");
    const recurring = RECURRING_AUTHORIZATION[EXPECTED_VERSION].body.replace(/\s+/g, " ");

    expect(terms).toContain("Sailor Skills, LLC");
    expect(terms).toContain("simple interest at 10% per year");
    expect(terms).toContain("Payment is due within 7 days of the invoice date");
    expect(terms).not.toContain("due on receipt");
    expect(terms).toContain("the cancel link at the bottom of any service email");
    expect(terms).toContain("## 12. Redo or Refund");
    expect(terms).toContain("in your service report and on video");
    expect(terms).toContain("## 14. Video and Records");
    expect(recurring).toContain("Sailor Skills, LLC");
    expect(recurring).toContain("the cancel link at the bottom of any service email");
    expect(recurring).toContain("documented in your service report and on video");

    for (const body of [terms, recurring]) {
      expect(body).not.toContain("SailorSkills");
      expect(body).not.toContain("whichever is greater");
      expect(body).not.toContain("1.5% per month");
      expect(body).not.toMatch(/[\u2013\u2014]/);
      expect(body).not.toMatch(/photo/i);
      expect(body).not.toContain("Cancel my plan");
    }
  });

  test("sql/terms-2026-11-02.sql inserts the module bodies byte-for-byte", () => {
    const sqlPath = fileURLToPath(
      new URL(`../sql/terms-${EXPECTED_VERSION}.sql`, import.meta.url),
    );
    const sql = readFileSync(sqlPath, "utf8");

    // Each insert: '<version>', '<document_type>', $tag$<body>$tag$,
    const inserts = [
      ...sql.matchAll(
        /'(\d{4}-\d{2}-\d{2})',\s*'([a-z_]+)',\s*(\$[a-z_]*\$)([\s\S]*?)\3,/g,
      ),
    ].map(([, version, documentType, , body]) => ({
      version,
      documentType,
      body,
    }));

    expect(inserts.map((i) => [i.version, i.documentType])).toEqual([
      [EXPECTED_VERSION, "tos"],
      [EXPECTED_VERSION, "recurring_authorization"],
    ]);
    // Strict equality, no trimming: the stored row must be the exact module body.
    expect(inserts[0].body).toBe(TERMS_OF_SERVICE[EXPECTED_VERSION].body);
    expect(inserts[1].body).toBe(RECURRING_AUTHORIZATION[EXPECTED_VERSION].body);
    expect(sql).toContain("timestamptz '2026-11-02 00:00:00-08'");
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
