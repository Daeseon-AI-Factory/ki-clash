import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AnalyticsBootstrap from "@/components/AnalyticsBootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://jjan.daeseon.ai",
  ),
  title: {
    default: "JJAN! · Ki Clash",
    template: "%s · JJAN!",
  },
  description:
    "Read your opponent, charge your ki, and strike first in JJAN!, the real-time 1v1 reveal duel based on Korean ki-battle.",
  keywords: [
    "JJAN",
    "Ki Clash",
    "기싸움",
    "1v1 game",
    "PvP browser game",
    "real-time duel",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "JJAN! · Ki Clash",
    description: "Read, charge, strike. A real-time 1v1 ki reveal duel.",
    siteName: "JJAN!",
    url: "/",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "JJAN! Ki Clash official game page",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JJAN! · Ki Clash",
    description: "Read, charge, strike. Play the 1v1 ki reveal duel.",
    images: ["/opengraph-image"],
  },
  // PWA: installable on a phone home screen, behaves like a native app.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JJAN!",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b14",
  width: "device-width",
  initialScale: 1,
  // Prevent double-tap zoom / pinch on the game UI so it feels app-like.
  maximumScale: 1,
  userScalable: false,
  // Extend under the notch / home indicator so 100svh maps to the real
  // screen; pages keep content clear of unsafe areas via padding.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <html lang="en">
      <head>
        {adsenseClient && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <AnalyticsBootstrap />
        {children}
      </body>
    </html>
  );
}
