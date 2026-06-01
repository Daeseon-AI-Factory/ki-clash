"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import CharacterAvatar from "@/components/arena/CharacterAvatar";
import { CHARACTERS } from "@/lib/characters";

/**
 * Friend invite page — generate a shareable PvP challenge link.
 *
 * Flow:
 * 1. Player picks a character (optional flair)
 * 2. Clicks "Create Challenge Link"
 * 3. Gets a share URL they can send to a friend
 * 4. Friend opens the link → lands on /pvp with the challenge ID
 *
 * For MVP, the link format is: /pvp?challenge={id}
 * The actual matchmaking uses the same WebSocket flow —
 * the challenge ID is used to pair two specific players.
 */
export default function InvitePage() {
  const [selectedChar, setSelectedChar] = useState("haneul");
  const [challengeLink, setChallengeLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createChallenge = useCallback(() => {
    // Generate a simple challenge ID (UUID-like)
    const id = crypto.randomUUID();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setChallengeLink(`${origin}/pvp?challenge=${id}`);
    setCopied(false);
  }, []);

  const copyLink = useCallback(async () => {
    if (!challengeLink) return;
    try {
      await navigator.clipboard.writeText(challengeLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }, [challengeLink]);

  const shareLink = useCallback(async () => {
    if (!challengeLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Ki Clash Challenge",
          text: "I challenge you to a Ki Clash battle!",
          url: challengeLink,
        });
      } catch {
        // User cancelled share
      }
    } else {
      copyLink();
    }
  }, [challengeLink, copyLink]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-black mb-2">Challenge a Friend</h1>
          <p className="text-gray-400">
            Pick your fighter and send the link!
          </p>
        </div>

        {/* Character picker */}
        <div className="grid grid-cols-3 gap-3">
          {CHARACTERS.map((char) => (
            <button
              key={char.id}
              onClick={() => setSelectedChar(char.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                selectedChar === char.id
                  ? "border-opacity-100 bg-gray-700"
                  : "border-gray-700 bg-gray-800 hover:bg-gray-700"
              }`}
              style={{
                borderColor: selectedChar === char.id ? char.color : undefined,
              }}
            >
              <CharacterAvatar characterId={char.id} size="md" />
              <span className="text-xs font-bold">{char.name}</span>
            </button>
          ))}
        </div>

        {!challengeLink ? (
          <button
            onClick={createChallenge}
            className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl
                       text-xl font-bold transition-colors"
          >
            Create Challenge Link
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                Challenge Link
              </p>
              <p className="text-sm text-blue-400 break-all font-mono">
                {challengeLink}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl
                           font-bold transition-colors"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={shareLink}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl
                           font-bold transition-colors"
              >
                Share
              </button>
            </div>

            <button
              onClick={createChallenge}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Generate new link
            </button>
          </div>
        )}

        <Link
          href="/"
          className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back to game
        </Link>
      </div>
    </div>
  );
}
