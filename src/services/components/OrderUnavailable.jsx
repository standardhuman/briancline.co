import React from "react";
import { AlertCircle, Mail, Phone } from "lucide-react";
import { BUSINESS } from "../lib/hull-cleaning-public";

// "+1-415-529-0272" -> "(415) 529-0272"
function displayPhone(telephone) {
  const digits = telephone.replace(/\D/g, "").replace(/^1/, "");
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Shown in place of the order form when it can't load. Gives the customer a
// way to reach us instead of a spinner that never ends.
export default function OrderUnavailable({ onRetry }) {
  return (
    <div className="max-w-xl mx-auto px-6 py-16" data-testid="order-unavailable" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">The order form isn't loading right now</h1>
          <p className="mt-2 text-gray-600">
            Sorry about that. You can still book hull cleaning by email or phone, and we'll set it up for you.
          </p>
          <ul className="mt-4 space-y-2 text-gray-800">
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#0073a8]" />
              <a className="text-[#0073a8] underline" href={`mailto:${BUSINESS.email}?subject=Hull%20cleaning%20order`}>
                {BUSINESS.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#0073a8]" />
              <a className="text-[#0073a8] underline" href={`tel:${BUSINESS.telephone}`}>
                {displayPhone(BUSINESS.telephone)}
              </a>
            </li>
          </ul>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-6 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
