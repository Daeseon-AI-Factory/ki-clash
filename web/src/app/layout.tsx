import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
