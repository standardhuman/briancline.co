import React from "react";
import { createRoot } from "react-dom/client";
import { captureException, init, setTags, withScope } from "@sentry/browser";
import posthog from "posthog-js/dist/module.slim";
import App from "./App";
import "./styles.css";
import { createAnalytics } from "../analytics.js";
import { createBrowserMonitoring } from "../monitoring.js";

const monitoring = createBrowserMonitoring({
  sdk: { captureException, init, setTags, withScope },
  env: import.meta.env,
});
monitoring.initialize({ surface: "services", stage: "browser-runtime" });

const analytics = createAnalytics({ sdk: posthog, env: import.meta.env });
analytics.initialize();

const root = createRoot(document.getElementById("services-root"));
root.render(<App analytics={analytics} />);
