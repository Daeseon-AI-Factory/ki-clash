import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JJAN! · 짠",
  description:
    "Read your opponent in a heartbeat. JJAN — the 1-second 1v1 reveal duel based on the Korean schoolyard ki-battle.",
  openGraph: {
    title: "JJAN! · 짠",
    description: "1-second 1v1 reveal duel. JJAN — read, charge, strike.",
    siteName: "JJAN!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JJAN! · 짠",
    description: "1-second 1v1 reveal duel. Read, charge, strike.",
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
        {children}
      </body>
    </html>
  );
}
