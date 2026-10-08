import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ServiceLayout from "./components/ServiceLayout";
import ScrollToTop from "./components/ScrollToTop";
import Marine from "./pages/Marine";
import Diving from "./pages/Diving";
import HullCleaningCost from "./pages/HullCleaningCost";
import DivingOrder from "./pages/DivingOrder";
import Training from "./pages/Training";
import TrainingFAQ from "./pages/TrainingFAQ";
import Deliveries from "./pages/Deliveries";
import Detailing from "./pages/Detailing";
import Terms from "./pages/Terms";
import RecurringAuthorization from "./pages/RecurringAuthorization";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<ServiceLayout />}>
          {/* Marine landing page */}
          <Route path="/marine" element={<Marine />} />

          {/* Hull Cleaning (new canonical URL) */}
          <Route path="/hull-cleaning" element={<Diving />} />
          <Route path="/hull-cleaning/cost" element={<HullCleaningCost />} />
          <Route path="/hull-cleaning/calculator" element={<Diving />} />
          <Route path="/hull-cleaning/order" element={<DivingOrder />} />

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
          <Route path="/boat-detailing" element={<Detailing />} />

          {/* Legacy detailing route → redirect to new URL */}
          <Route path="/detailing" element={<Navigate to="/boat-detailing" replace />} />

          {/* Deliveries (unchanged) */}
          <Route path="/deliveries" element={<Deliveries />} />

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
