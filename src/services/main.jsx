import React from "react";
import { createRoot } from "react-dom/client";
import { captureException, init, setTags, withScope } from "@sentry/browser";
import App from "./App";
import "./styles.css";
import { createBrowserMonitoring } from "../monitoring.js";

const monitoring = createBrowserMonitoring({
  sdk: { captureException, init, setTags, withScope },
  env: import.meta.env,
});
monitoring.initialize({ surface: "services", stage: "browser-runtime" });

const root = createRoot(document.getElementById("services-root"));
root.render(<App />);
