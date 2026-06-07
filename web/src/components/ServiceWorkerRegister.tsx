"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) once on the client.
 * Makes JJAN! installable + offline-capable. No-op in dev / unsupported
 * browsers. Renders nothing.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure is non-fatal — the app still works as a normal site.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
