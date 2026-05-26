/**
 * Friend invite screen — generate a shareable PvP challenge link.
 *
 * Player picks a character, taps "Create Challenge Link", gets a
 * share URL. Uses React Native Share API for native sharing.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CHARACTERS } from "@/lib/characters";
import { PixelPortrait } from "@/components/deprecated/pixel-art";
import { colors, fontSize, spacing } from "@/lib/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function InviteScreen() {
  const router = useRouter();
  const [selectedChar, setSelectedChar] = useState("haneul");
  const [challengeLink, setChallengeLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createChallenge = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = generateUUID();
    // Use a web-compatible URL for sharing
    setChallengeLink(`${API_BASE.replace("/api", "")}/pvp?challenge=${id}`);
    setCopied(false);
  }, []);

  const shareLink = useCallback(async () => {
    if (!challengeLink) return;
    try {
      await Share.share({
        title: "Ki Clash Challenge",
        message: `I challenge you to a Ki Clash battle! ${challengeLink}`,
        url: challengeLink,
      });
    } catch {
      // User cancelled
    }
  }, [challengeLink]);

  const copyLink = useCallback(async () => {
    if (!challengeLink) return;
    try {
      // React Native doesn't have navigator.clipboard — use Share or Alert
      await Share.share({ message: challengeLink });
    } catch {
      Alert.alert("Challenge Link", challengeLink);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [challengeLink]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Challenge a Friend</Text>
        <Text style={styles.subtitle}>Pick your fighter and send the link!</Text>

        {/* Character picker grid */}
        <View style={styles.grid}>
          {CHARACTERS.map((char) => (
            <TouchableOpacity
              key={char.id}
              style={[
                styles.charCard,
                {
                  borderColor:
                    selectedChar === char.id ? char.color : colors.surfaceHover,
                  backgroundColor:
                    selectedChar === char.id ? colors.surfaceHover : colors.surface,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedChar(char.id);
              }}
              activeOpacity={0.7}
            >
              <PixelPortrait characterId={char.id} size="md" />
              <Text style={styles.charName}>{char.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!challengeLink ? (
          <TouchableOpacity
            style={styles.createButton}
            onPress={createChallenge}
            activeOpacity={0.7}
          >
            <Text style={styles.createButtonText}>Create Challenge Link</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.linkSection}>
            <View style={styles.linkBox}>
              <Text style={styles.linkLabel}>Challenge Link</Text>
              <Text style={styles.linkText} numberOfLines={2}>
                {challengeLink}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyLink}
                activeOpacity={0.7}
              >
                <Text style={styles.copyButtonText}>
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={shareLink}
                activeOpacity={0.7}
              >
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={createChallenge} activeOpacity={0.7}>
              <Text style={styles.regenerateText}>Generate new link</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backLinkText}>← Back to game</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    width: "100%",
  },
  charCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    width: "30%",
  },
  charName: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  createButton: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  createButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  linkSection: {
    width: "100%",
    maxWidth: 400,
    gap: spacing.lg,
    alignItems: "center",
  },
  linkBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    width: "100%",
    gap: spacing.sm,
  },
  linkLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  linkText: {
    fontSize: fontSize.sm,
    color: colors.blue,
    fontFamily: "monospace",
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  copyButton: {
    flex: 1,
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  copyButtonText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  shareButton: {
    flex: 1,
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  shareButtonText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  regenerateText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  backLink: {
    padding: spacing.md,
  },
  backLinkText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
