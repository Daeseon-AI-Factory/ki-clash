import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Support for JJAN! Ki Clash.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#0b0b14] px-5 py-10 text-white sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-white/52 hover:text-white">
          Back to JJAN!
        </Link>
        <p className="mt-10 text-sm font-black uppercase tracking-[0.24em] text-yellow-200">
          Support
        </p>
        <h1 className="mt-3 text-4xl font-black">Need help with JJAN! Ki Clash?</h1>
        <div className="mt-8 space-y-6 text-base leading-7 text-white/70">
          <p>
            For account, purchase, gameplay, room-code, or connection support,
            email{" "}
            <a className="text-cyan-200 hover:text-cyan-100" href="mailto:showep12@gmail.com">
              showep12@gmail.com
            </a>.
          </p>
          <p>
            Include your device, approximate time of the issue, the room code
            if one was involved, and a short description of what happened.
          </p>
          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
            <h2 className="font-black text-white">Quick checks</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Use the latest app or refresh the web page.</li>
              <li>Confirm your connection is stable before joining PvP.</li>
              <li>Create a new room if an old room code has expired.</li>
            </ul>
          </div>
        </div>
      </article>
    </main>
  );
}
