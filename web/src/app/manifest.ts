import type { MetadataRoute } from "next";

// PWA web app manifest — makes JJAN! installable on a phone home screen
// (standalone, full-screen, offline-capable via the service worker).
// Next.js serves this at /manifest.webmanifest automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JJAN! · 짠",
    short_name: "JJAN!",
    description:
      "Read your opponent in a heartbeat — the 1-second 1v1 reveal duel.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b14",
    theme_color: "#0b0b14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
