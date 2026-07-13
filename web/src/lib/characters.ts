/**
 * Character roster for Ki Clash.
 *
 * 6 original fighters with international names + Korean heritage names,
 * emoji symbols (lobby/fallback only), color themes, bios, and AI trash
 * talk lines. Purely cosmetic — no gameplay differences between them.
 *
 * The `id` field is the STABLE key used in URLs, Redis, file paths
 * (`/fighters/<id>/*.png`, `ki_clash:room:*`, etc.) — must not change.
 * Names/bios are free to edit.
 */

export interface Character {
  /** Stable identifier — used in URLs and assets. Never rename. */
  id: string;
  /** International display name (English, easy to read globally). */
  name: string;
  /** Korean heritage name shown as subtitle. */
  koreanName: string;
  /** Symbol emoji — fallback when no PNG is available. */
  emoji: string;
  /** Theme color used for borders, auras, HUD accents. */
  color: string;
  bio: string;
  trashTalk: string[];
}

export const CHARACTERS: Character[] = [
  {
    // Sky monk — orange combat robe, spiky black hair with blue tips.
    id: "haneul",
    name: "Kael",
    koreanName: "하늘 · Sky",
    emoji: "🌀",
    color: "#60A5FA", // blue-400
    bio: "Calm sky-monk. Strikes with the wind itself.",
    trashTalk: [
      "The wind whispers your next move to me...",
      "Stillness defeats all aggression.",
      "You fight the sky itself. How do you expect to win?",
      "Every clash brings you closer to enlightenment... and defeat.",
    ],
  },
  {
    // Lavender moon oracle — swept hair, moon emblem.
    id: "bora",
    name: "Selene",
    koreanName: "보라 · Moon Oracle",
    emoji: "🔮",
    color: "#C084FC", // purple-400
    bio: "Lavender oracle. The moon reveals her next strike.",
    trashTalk: [
      "The cards already told me your next move...",
      "I saw this outcome three turns ago.",
      "How predictable. Try surprising me for once.",
      "The spirits laugh at your strategy.",
      "Fate has already chosen the winner. Spoiler: it's me.",
    ],
  },
  {
    // Sun brawler — bright spiky hair, headband, loud pressure.
    id: "taeyang",
    name: "Blaze",
    koreanName: "태양 · Sun",
    emoji: "☀️",
    color: "#FACC15", // yellow-400
    bio: "Brash sun-born. Burns hotter than common sense.",
    trashTalk: [
      "HAHA! Is that all you've got?!",
      "My ki burns hotter than a thousand suns!",
      "Stop blocking and FIGHT me!",
      "You're about to get scorched!",
      "I don't need strategy — I have POWER!",
    ],
  },
  {
    // Rain captain — silver hair, calm water-step fighter.
    id: "danbi",
    name: "Yuki",
    koreanName: "단비 · Sweet Rain",
    emoji: "🌊",
    color: "#22D3EE", // cyan-400
    bio: "Silver captain. Calm rain, drowning tsunami.",
    trashTalk: [
      "Flow like water... strike like a tsunami.",
      "Your aggression creates openings. Thank you.",
      "The river doesn't fight the rock. It wears it down.",
      "Patience is my greatest weapon.",
    ],
  },
  {
    // Old-master strongman — topknot, beard.
    id: "seokjin",
    name: "Atlas",
    koreanName: "석진 · Stone Master",
    emoji: "🪨",
    color: "#FB923C", // orange-400
    bio: "Mountain-old master. Immovable, until you wake him.",
    trashTalk: [
      "I've been blocking attacks since before you were born.",
      "Hit me. Go on. I dare you.",
      "Mountains don't flinch.",
      "You'll tire before I do, young one.",
      "Hmph. Predictable.",
    ],
  },
  {
    // Crystal queen — long pink hair, elegant and condescending.
    id: "yuri",
    name: "Rosa",
    koreanName: "유리 · Crystal",
    emoji: "💎",
    color: "#F472B6", // pink-400
    bio: "Crystal-edged queen. Cold beauty, sharper words.",
    trashTalk: [
      "Oh, that was your best move? How... quaint.",
      "I could win this with my eyes closed, darling.",
      "You're making this too easy. It's almost boring.",
      "Diamonds cut through everything. Including your pride.",
      "Try harder. Or don't. The result is the same.",
    ],
  },
  {
    // Frost oracle — silver braids, ice-blue hanbok, snowflake motifs.
    id: "seorin",
    name: "Frost",
    koreanName: "서린 · Frost",
    emoji: "❄️",
    color: "#38BDF8", // sky-400
    bio: "Frost-calm duelist. Still as a frozen lake — until she strikes.",
    trashTalk: [
      "Cold reads win. Yours are lukewarm.",
      "The ice already knows where you'll step.",
      "Struggle. It's warmer that way.",
      "Freeze. ...Too late.",
    ],
  },
  {
    // Thunder brawler — blue spikes with yellow tips, purple vest, lightning.
    id: "cheon",
    name: "Volt",
    koreanName: "천둥 · Thunder",
    emoji: "⚡",
    color: "#818CF8", // indigo-400
    bio: "Storm-born brawler. Faster than the thunder that chases him.",
    trashTalk: [
      "Blink and it's over. So... blink.",
      "You're slow. Painfully slow.",
      "The strike lands before the sound. You lose twice.",
      "Zap. That was you, by the way.",
      "Too fast for you? Skill issue.",
    ],
  },
  {
    // Shadow duelist — black topknot, dark hanbok, smoke motifs.
    id: "yeonhwa",
    name: "Shade",
    koreanName: "그림자 · Shadow",
    emoji: "🌑",
    color: "#7C3AED", // violet-600
    bio: "Shadow-step duelist. You never see the strike that lands.",
    trashTalk: [
      "You're fighting a shadow. Good luck.",
      "I was behind you three moves ago.",
      "The dark doesn't miss.",
      "Look away. It won't help.",
      "Silence is the last thing you'll read.",
    ],
  },
];

/** Look up a character by ID */
export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

/** Pick a random character, excluding one ID (so AI doesn't mirror the player) */
export function getRandomCharacterExcluding(excludeId: string): Character {
  const candidates = CHARACTERS.filter((c) => c.id !== excludeId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
