import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://briancline.co";

function upsertHead(selector, create, set) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  set(el);
}

/**
 * Sets the per-route <title>, description and canonical. The prerender step
 * snapshots the DOM after this runs, so crawlers get the per-page values
 * instead of services.html's static defaults (which pointed every page's
 * canonical at /marine).
 *
 * canonical: path ("/hull-cleaning") or absolute URL. Defaults to the current path.
 */
export default function PageMeta({ title, description, canonical }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      upsertHead(
        'meta[name="description"]',
        () => Object.assign(document.createElement("meta"), { name: "description" }),
        (el) => { el.content = description; }
      );
    }
    const path = canonical || pathname.replace(/\/+$/, "") || "/";
    const href = path.startsWith("http") ? path : `${SITE_URL}${path}`;
    upsertHead(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement("link"), { rel: "canonical" }),
      (el) => { el.href = href; }
    );
  }, [title, description, canonical, pathname]);
  return null;
}
