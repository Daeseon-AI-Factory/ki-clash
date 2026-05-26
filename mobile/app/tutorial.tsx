/**
 * Tutorial screen — 3 guided practice rounds teaching the basics.
 *
 * Uses useTutorial hook for scripted AI responses so the player
 * always sees the intended outcome. Phases: intro → playing →
 * revealing → explanation → complete.
 */

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTutorial } from "@/hooks/useTutorial";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import { BattleArena } from "@/components/deprecated/pixel-art";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Action } from "@/lib/api";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

const ACTION_EMOJI: Record<string, string> = {
  charge: "⚡",
  block: "🛡️",
  attack: "👊",
  energy_wave: "🔥",
  teleport: "💨",
};

export default function TutorialScreen() {
  const router = useRouter();
  const {
    phase,
    currentStep,
    stepIndex,
    playerKi,
    aiKi,
    playerAction,
    aiAction,
    startTutorial,
    submitAction,
    continueFromReveal,
    continueFromExplanation,
    restart,
  } = useTutorial();

  const handleSubmit = (action: Action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    submitAction(action);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* INTRO */}
        {phase === "intro" && (
          <View style={styles.centerArea}>
            <Text style={styles.title}>Tutorial</Text>
            <Text style={styles.subtitle}>
              Learn the basics in 3 quick rounds.
            </Text>

            <BattleArena
              playerCharacterId="haneul"
              aiCharacterId="bora"
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                <Text style={styles.bold}>5 Actions:</Text> Charge, Block,
                Attack, Energy Wave, Teleport
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.bold}>Goal:</Text> Read your opponent and
                land a hit while they're vulnerable.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.bold}>Ki:</Text> You need ki to attack.
                Charge to build it up!
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={startTutorial}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Start Tutorial</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipLink}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.skipLinkText}>← Skip to game</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PLAYING */}
        {phase === "playing" && currentStep && (
          <View style={styles.gameArea}>
            {/* Progress dots */}
            <View style={styles.progressRow}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor:
                        i < stepIndex
                          ? colors.green
                          : i === stepIndex
                            ? colors.blue
                            : colors.surfaceHover,
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={styles.stepTitle}>{currentStep.title}</Text>

            <BattleArena
              playerCharacterId="haneul"
              aiCharacterId="bora"
            />

            <KiMeter ki={playerKi} label="You" isPlayer={true} />
            <KiMeter ki={aiKi} label="AI" isPlayer={false} />

            {/* Instruction callout */}
            <View style={styles.instructionBox}>
              <Text style={styles.instructionText}>
                {currentStep.instruction}
              </Text>
            </View>

            {/* Action cards — highlight the expected one */}
            <View style={styles.actionGrid}>
              {ACTIONS.map((action) => {
                const dimmed = !currentStep.highlightActions.includes(action);
                return (
                  <View key={action} style={{ opacity: dimmed ? 0.3 : 1, flex: 1 }}>
                    <ActionCard
                      action={action}
                      playerKi={playerKi}
                      isSelected={false}
                      disabled={dimmed}
                      onSelect={handleSubmit}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* REVEALING */}
        {phase === "revealing" && currentStep && playerAction && aiAction && (
          <View style={styles.centerArea}>
            <BattleArena
              playerCharacterId="haneul"
              aiCharacterId="bora"
            />

            <View style={styles.faceOff}>
              <View style={styles.faceOffSide}>
                <Text style={styles.faceOffEmoji}>
                  {ACTION_EMOJI[playerAction]}
                </Text>
                <Text style={styles.faceOffAction}>
                  {playerAction.replace("_", " ")}
                </Text>
                <Text style={[styles.faceOffPlayer, { color: colors.green }]}>
                  You
                </Text>
              </View>
              <Text style={styles.faceOffVs}>VS</Text>
              <View style={styles.faceOffSide}>
                <Text style={styles.faceOffEmoji}>
                  {ACTION_EMOJI[aiAction]}
                </Text>
                <Text style={styles.faceOffAction}>
                  {aiAction.replace("_", " ")}
                </Text>
                <Text style={[styles.faceOffPlayer, { color: colors.red }]}>
                  AI
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={continueFromReveal}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>What happened? →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* EXPLANATION */}
        {phase === "explanation" && currentStep && (
          <View style={styles.centerArea}>
            <Text style={styles.bigEmoji}>
              {stepIndex === 0 ? "⚡" : stepIndex === 1 ? "💥" : "🛡️"}
            </Text>

            <View style={styles.explanationBox}>
              <Text style={styles.explanationText}>
                {currentStep.explanation}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={continueFromExplanation}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>
                {stepIndex < 2 ? "Next Lesson →" : "Finish Tutorial →"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* COMPLETE */}
        {phase === "complete" && (
          <View style={styles.centerArea}>
            <BattleArena
              playerCharacterId="haneul"
              aiCharacterId="bora"
            />

            <Text style={styles.completeTitle}>Tutorial Complete!</Text>
            <Text style={styles.completeSubtext}>
              You know the basics. There are 2 more moves to discover:{" "}
              <Text style={{ color: colors.energyWave, fontWeight: "700" }}>
                Energy Wave
              </Text>{" "}
              (pierces Block, costs 3 ki) and{" "}
              <Text style={{ color: colors.teleport, fontWeight: "700" }}>
                Teleport
              </Text>{" "}
              (dodges all attacks, costs 1 ki).
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.green }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Play vs AI →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={restart}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Replay Tutorial</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  centerArea: {
    alignItems: "center",
    gap: spacing.lg,
  },
  gameArea: {
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  stepTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  instructionBox: {
    backgroundColor: "rgba(30, 58, 138, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.5)",
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  instructionText: {
    fontSize: fontSize.sm,
    color: "#93C5FD",
    fontWeight: "500",
    textAlign: "center",
  },
  actionGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  faceOff: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  faceOffSide: {
    alignItems: "center",
    gap: 4,
  },
  faceOffEmoji: {
    fontSize: 36,
  },
  faceOffAction: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  faceOffPlayer: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  faceOffVs: {
    fontSize: fontSize.xl,
    fontWeight: "900",
    color: colors.textMuted,
  },
  bigEmoji: {
    fontSize: 48,
  },
  explanationBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
  },
  explanationText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
    width: "100%",
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bold: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.md,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  skipLink: {
    padding: spacing.md,
  },
  skipLinkText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  completeTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
    color: colors.green,
  },
  completeSubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
});
