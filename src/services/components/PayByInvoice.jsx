import React from "react";
import { cn } from "../lib/utils";
import { INVOICE_TERMS_TEXT } from "../pages/legal/invoice-terms";

export const PAYMENT_PREFERENCE_CARD = "card";
export const PAYMENT_PREFERENCE_INVOICE = "invoice";

export const PAYMENT_PREFERENCE_OPTIONS = [
  { value: PAYMENT_PREFERENCE_CARD, label: "Card on file (charged after each service)" },
  { value: PAYMENT_PREFERENCE_INVOICE, label: "Pay by invoice (requires approval)" },
];

/**
 * "How would you like to pay?" Card on file is the default and keeps today's
 * flow. Pay by invoice saves no card and sends the order to review.
 */
export function PaymentPreferenceChoice({ value, onChange }) {
  return (
    <div className="mb-5">
      <p id="payment-preference-label" className="text-sm font-medium text-gray-700">
        How would you like to pay?<span className="text-red-500 ml-0.5">*</span>
      </p>
      <div
        role="radiogroup"
        aria-labelledby="payment-preference-label"
        className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        {PAYMENT_PREFERENCE_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-payment-preference={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all duration-200",
                selected
                  ? "border-[#0073a8] bg-primary-50 text-primary-700"
                  : "border-gray-200 bg-white hover:border-gray-300 text-gray-600"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Renders exactly one branch for the chosen payment preference. Whatever is in
 * the `card` slot (Stripe card fields, the charge authorization) is not mounted
 * at all while pay by invoice is selected.
 */
export function ByPaymentPreference({ paymentPreference, card = null, invoice = null }) {
  return paymentPreference === PAYMENT_PREFERENCE_INVOICE ? invoice : card;
}

/** The pay-by-invoice terms and their required checkbox. */
export function InvoiceTermsAgreement({ checked, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        <strong>Pay-by-invoice terms:</strong>
      </p>
      <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1">
        {INVOICE_TERMS_TEXT.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agree-invoice-terms"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="agree-invoice-terms" className="text-sm text-gray-700 cursor-pointer leading-snug">
          I agree to the pay-by-invoice terms
        </label>
      </div>
    </div>
  );
}
