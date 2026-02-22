"use client";

interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
}

/**
 * Speaker icon toggle — top-right corner.
 * Shows a speaker with slash when muted, normal speaker when unmuted.
 */
export default function MuteButton({ muted, onToggle }: MuteButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 right-4 z-40 w-10 h-10 flex items-center justify-center
                 bg-gray-800/80 hover:bg-gray-700 rounded-full transition-colors
                 text-gray-400 hover:text-white"
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Unmute" : "Mute"}
    >
      {muted ? (
        // Speaker with X
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        // Speaker with waves
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
