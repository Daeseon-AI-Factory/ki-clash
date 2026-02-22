/**
 * MuteButton — toggle sound on/off.
 *
 * Positioned absolutely in the top-right corner of the screen.
 * Shows a speaker icon (with or without slash).
 */

import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
}

export default function MuteButton({ muted, onToggle }: MuteButtonProps) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityLabel={muted ? "Unmute sounds" : "Mute sounds"}
    >
      <Text style={styles.icon}>{muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 40,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(31, 41, 55, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 18,
    color: colors.textSecondary,
  },
});
