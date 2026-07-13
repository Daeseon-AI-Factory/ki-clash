/**
 * Character roster for Ki Clash.
 *
 * 6 original fighters with names, emoji portraits, color themes,
 * and AI trash talk lines. Purely cosmetic — no gameplay differences.
 */

export interface Character {
  id: string;
  name: string;
  koreanName: string;
  emoji: string;
  color: string;
  bio: string;
  trashTalk: string[];
}

export const CHARACTERS: Character[] = [
  {
    id: "haneul",
    name: "Haneul",
    koreanName: "하늘",
    emoji: "🌀",
    color: "#60A5FA", // blue-400
    bio: "A calm philosophical monk who fights with the wind.",
    trashTalk: [
      "The wind whispers your next move to me...",
      "Stillness defeats all aggression.",
      "You fight the sky itself. How do you expect to win?",
      "Every clash brings you closer to enlightenment... and defeat.",
    ],
  },
  {
    id: "bora",
    name: "Bora",
    koreanName: "보라",
    emoji: "🔮",
    color: "#C084FC", // purple-400
    bio: "A mysterious oracle who taunts from the shadows.",
    trashTalk: [
      "The cards already told me your next move...",
      "I saw this outcome three turns ago.",
      "How predictable. Try surprising me for once.",
      "The spirits laugh at your strategy.",
      "Fate has already chosen the winner. Spoiler: it's me.",
    ],
  },
  {
    id: "taeyang",
    name: "Taeyang",
    koreanName: "태양",
    emoji: "☀️",
    color: "#FACC15", // yellow-400
    bio: "A brash hothead who burns everything in his path.",
    trashTalk: [
      "HAHA! Is that all you've got?!",
      "My ki burns hotter than a thousand suns!",
      "Stop blocking and FIGHT me!",
      "You're about to get scorched!",
      "I don't need strategy — I have POWER!",
    ],
  },
  {
    id: "danbi",
    name: "Danbi",
    koreanName: "단비",
    emoji: "🌊",
    color: "#22D3EE", // cyan-400
    bio: "Serene like rain, but deadly like a flood.",
    trashTalk: [
      "Flow like water... strike like a tsunami.",
      "Your aggression creates openings. Thank you.",
      "The river doesn't fight the rock. It wears it down.",
      "Patience is my greatest weapon.",
    ],
  },
  {
    id: "seokjin",
    name: "Seokjin",
    koreanName: "석진",
    emoji: "🪨",
    color: "#FB923C", // orange-400
    bio: "An immovable old master carved from mountain stone.",
    trashTalk: [
      "I've been blocking attacks since before you were born.",
      "Hit me. Go on. I dare you.",
      "Mountains don't flinch.",
      "You'll tire before I do, young one.",
      "Hmph. Predictable.",
    ],
  },
  {
    id: "yuri",
    name: "Yuri",
    koreanName: "유리",
    emoji: "💎",
    color: "#F472B6", // pink-400
    bio: "Elegant, precise, and utterly condescending.",
    trashTalk: [
      "Oh, that was your best move? How... quaint.",
      "I could win this with my eyes closed, darling.",
      "You're making this too easy. It's almost boring.",
      "Diamonds cut through everything. Including your pride.",
      "Try harder. Or don't. The result is the same.",
    ],
  },
  {
    id: "seorin",
    name: "Seorin",
    koreanName: "서린",
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
    id: "cheon",
    name: "Cheon",
    koreanName: "천둥",
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
    id: "yeonhwa",
    name: "Yeonhwa",
    koreanName: "그림자",
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
