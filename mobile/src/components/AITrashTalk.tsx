/**
 * AITrashTalk — speech bubble showing the AI character's trash talk.
 *
 * Picks a deterministic-random line from the character's trashTalk array
 * based on the turn number (changes each turn, stable within a turn).
 * Fades in with Animated opacity.
 */

import { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Character } from "@/lib/characters";
import { PixelPortrait } from "@/components/pixel-art";

interface AITrashTalkProps {
  character: Character;
  /** Current turn number — used to re-pick a line each turn */
  turnNumber: number;
}

export default function AITrashTalk({ character, turnNumber }: AITrashTalkProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const line = useMemo(() => {
    const index = turnNumber % character.trashTalk.length;
    return character.trashTalk[index];
  }, [character, turnNumber]);

  // Fade in on each new line
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [line, fadeAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 0],
              }),
            },
          ],
        },
      ]}
    >
      <PixelPortrait characterId={character.id} size="sm" />
      <Text style={styles.text}>
        &ldquo;{line}&rdquo;
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(31, 41, 55, 0.8)", // gray-800/80
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  emoji: {
    fontSize: 24,
  },
  text: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
    lineHeight: 18,
  },
});
