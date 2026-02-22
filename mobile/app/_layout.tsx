/**
 * Root layout — wraps all screens with safe area and dark background.
 *
 * Uses expo-router Stack navigator with no visible header
 * (game is fullscreen, navigation is within each screen).
 */

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade",
        }}
      />
    </>
  );
}
