import React from "react";
import PageMeta from "../components/PageMeta";
import Markdown from "../components/Markdown";
import { ACTIVE_VERSION, RECURRING_AUTHORIZATION } from "./legal/terms-content";

export default function RecurringAuthorization() {
  const doc = RECURRING_AUTHORIZATION[ACTIVE_VERSION];

  return (
    <div className="min-h-screen bg-white">
      <PageMeta
        title="Recurring Charge Authorization | Brian Cline Diving & Hull Cleaning"
        description="Recurring charge authorization for Brian Cline Diving & Hull Cleaning service plans. Schedule, amount, when you are charged, how to cancel, and charge questions."
      />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-sm text-gray-500">
          Version {ACTIVE_VERSION} · Effective {doc.effectiveDate}
        </p>
        <Markdown source={doc.body} />
        <p className="mt-12 text-sm text-gray-500">
          Questions? Email{" "}
          <a href="mailto:diving@briancline.co" className="text-[#0073a8] underline">
            diving@briancline.co
          </a>
          .
        </p>
      </div>
    </div>
  );
}
