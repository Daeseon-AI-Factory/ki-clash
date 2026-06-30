import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for JJAN! Ki Clash.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0b0b14] px-5 py-10 text-white sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-white/52 hover:text-white">
          Back to JJAN!
        </Link>
        <p className="mt-10 text-sm font-black uppercase tracking-[0.24em] text-cyan-200">
          Privacy Policy
        </p>
        <h1 className="mt-3 text-4xl font-black">JJAN! Ki Clash Privacy</h1>
        <p className="mt-3 text-sm text-white/50">Effective date: June 16, 2026</p>

        <div className="mt-8 space-y-7 text-base leading-7 text-white/70">
          <section>
            <h2 className="text-xl font-black text-white">What We Collect</h2>
            <p className="mt-2">
              JJAN! Ki Clash creates guest player identifiers, display names,
              match history, leaderboard records, room events, and gameplay
              events needed to run the game. We also collect basic analytics
              events such as page views, match starts, room creation, shared
              links, and match finishes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Diagnostics</h2>
            <p className="mt-2">
              Server logs and diagnostics may include timestamps, request
              paths, device or browser user agent, coarse network metadata, and
              error messages. These are used to keep online play reliable and
              to investigate crashes, failed room joins, and WebSocket errors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Payments And Ads</h2>
            <p className="mt-2">
              Web purchases are processed by third-party payment providers such
              as Lemon Squeezy or Stripe. We do not store card numbers. Web
              ads, when enabled, may be provided by third-party ad services
              that process their own delivery and measurement data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">How We Use Data</h2>
            <p className="mt-2">
              We use data to authenticate guests, operate matches and rooms,
              maintain rankings, prevent abuse, debug service problems, improve
              onboarding, and measure whether the game is working for players.
              We do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Contact</h2>
            <p className="mt-2">
              For privacy or deletion requests, contact{" "}
              <a className="text-cyan-200 hover:text-cyan-100" href="mailto:showep12@gmail.com">
                showep12@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
