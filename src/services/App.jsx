import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { normalizeService, sanitizeAttribution } from "../analytics.js";
import ServiceLayout from "./components/ServiceLayout";
import ScrollToTop from "./components/ScrollToTop";
import Marine from "./pages/Marine";
import Diving from "./pages/Diving";
import DivingOrder from "./pages/DivingOrder";
import Training from "./pages/Training";
import TrainingFAQ from "./pages/TrainingFAQ";
import Deliveries from "./pages/Deliveries";
import Detailing from "./pages/Detailing";
import Terms from "./pages/Terms";
import RecurringAuthorization from "./pages/RecurringAuthorization";

function ServicesAnalyticsTracker({ analytics }) {
  const location = useLocation();

  useEffect(() => {
    const properties = {
      surface: "services",
      service: normalizeService(location.pathname),
    };
    analytics?.capture("$pageview", {
      ...properties,
      ...sanitizeAttribution({
        search: location.search,
        referrer: globalThis.document?.referrer,
      }),
    });
    analytics?.capture("service_viewed", properties);
  }, [analytics, location.pathname, location.search]);

  return null;
}

export default function App({ analytics }) {
  return (
    <BrowserRouter>
      <ServicesAnalyticsTracker analytics={analytics} />
      <ScrollToTop />
      <Routes>
        <Route element={<ServiceLayout />}>
          {/* Marine landing page */}
          <Route path="/marine" element={<Marine />} />

          {/* Hull Cleaning (new canonical URL) */}
          <Route path="/hull-cleaning" element={<Diving />} />
          <Route path="/hull-cleaning/calculator" element={<Diving />} />
          <Route path="/hull-cleaning/order" element={<DivingOrder analytics={analytics} />} />

          {/* Legacy diving routes → redirect to new URLs */}
          <Route path="/diving" element={<Navigate to="/hull-cleaning" replace />} />
          <Route path="/diving/calculator" element={<Navigate to="/hull-cleaning/calculator" replace />} />
          <Route path="/diving/order" element={<Navigate to="/hull-cleaning/order" replace />} />

          {/* Sailing Lessons (new canonical URL) */}
          <Route path="/sailing-lessons" element={<Training />} />
          <Route path="/sailing-lessons/faq" element={<TrainingFAQ />} />

          {/* Legacy training routes → redirect to new URLs */}
          <Route path="/training" element={<Navigate to="/sailing-lessons" replace />} />
          <Route path="/training/faq" element={<Navigate to="/sailing-lessons/faq" replace />} />

          {/* Boat Detailing (new canonical URL) */}
          <Route path="/boat-detailing" element={<Detailing analytics={analytics} />} />

          {/* Legacy detailing route → redirect to new URL */}
          <Route path="/detailing" element={<Navigate to="/boat-detailing" replace />} />

          {/* Deliveries (unchanged) */}
          <Route path="/deliveries" element={<Deliveries analytics={analytics} />} />

          {/* Legal — required for chargeback hardening; linked from order form + footer */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/recurring-authorization" element={<RecurringAuthorization />} />

          {/* Catch-all → marine landing */}
          <Route path="*" element={<Navigate to="/marine" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
