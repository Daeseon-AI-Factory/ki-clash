import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of service for JJAN! Ki Clash.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0b0b14] px-5 py-10 text-white sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-white/52 hover:text-white">
          Back to JJAN!
        </Link>
        <p className="mt-10 text-sm font-black uppercase tracking-[0.24em] text-rose-200">
          Terms
        </p>
        <h1 className="mt-3 text-4xl font-black">JJAN! Ki Clash Terms</h1>
        <p className="mt-3 text-sm text-white/50">Effective date: June 16, 2026</p>

        <div className="mt-8 space-y-7 text-base leading-7 text-white/70">
          <section>
            <h2 className="text-xl font-black text-white">Use Of The Game</h2>
            <p className="mt-2">
              JJAN! Ki Clash is a competitive casual game. You agree not to
              exploit, disrupt, reverse engineer service abuse paths, automate
              unfair play, or interfere with other players.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Guest Accounts</h2>
            <p className="mt-2">
              Guest profiles are device/browser based. If local app or browser
              storage is deleted, guest access and history may not be
              recoverable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Purchases</h2>
            <p className="mt-2">
              Any paid product is shown before checkout. Platform purchase and
              refund rules may apply depending on where the purchase was made.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Availability</h2>
            <p className="mt-2">
              Online play may be interrupted by maintenance, network issues, or
              abuse prevention. We may change balance, features, or service
              availability as the game evolves.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Contact</h2>
            <p className="mt-2">
              Questions:{" "}
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
