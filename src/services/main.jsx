import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { analytics } from "./lib/analytics";

// No-op without VITE_POSTHOG_KEY, under prerender, and for Do Not Track.
analytics.initialize();

const root = createRoot(document.getElementById("services-root"));
root.render(<App />);
