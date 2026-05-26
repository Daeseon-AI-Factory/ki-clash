/**
 * CharacterPortrait — renders a character's image asset, falling back to the
 * roster emoji if no image file is bundled.
 *
 * Add the asset path to the manifest in `lib/assets.ts` (CHARACTER_MANIFEST)
 * once `mobile/assets/characters/<id>/<expression>.png` is in place. Until
 * then, the emoji defined in `lib/characters.ts` renders.
 *
 * # CORE_CANDIDATE — pattern reusable for any bundled-image fallback.
 */

import { Image, View, Text, StyleSheet } from "react-native";
import {
  characterAsset,
  type CharacterExpression,
  type CharacterId,
} from "@/lib/assets";
import { getCharacter } from "@/lib/characters";

const SIZE_PX = { sm: 48, md: 96, lg: 144 } as const;

interface CharacterPortraitProps {
  characterId: string;
  expression?: CharacterExpression;
  size?: keyof typeof SIZE_PX;
}

const KNOWN_IDS: CharacterId[] = [
  "haneul",
  "bora",
  "taeyang",
  "danbi",
  "seokjin",
  "yuri",
];

export default function CharacterPortrait({
  characterId,
  expression = "portrait",
  size = "md",
}: CharacterPortraitProps) {
  const character = getCharacter(characterId);
  const px = SIZE_PX[size];

  if (!character) return null;

  const asset = KNOWN_IDS.includes(characterId as CharacterId)
    ? characterAsset(characterId as CharacterId, expression)
    : null;

  if (asset != null) {
    return (
      <Image
        source={asset as number}
        style={{ width: px, height: px, resizeMode: "contain" }}
        accessibilityLabel={character.name}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, { width: px, height: px }]}
      accessibilityLabel={character.name}
    >
      <Text style={{ fontSize: px * 0.6 }}>{character.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
