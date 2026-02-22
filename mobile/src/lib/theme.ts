/**
 * Shared color palette and spacing for Ki Clash mobile.
 *
 * Matches the web Tailwind gray-900/800/700 dark theme.
 */

export const colors = {
  background: "#111827",   // gray-900
  surface: "#1F2937",      // gray-800
  surfaceHover: "#374151", // gray-700
  border: "#4B5563",       // gray-600
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF", // gray-400
  textMuted: "#6B7280",     // gray-500

  green: "#4ADE80",     // green-400
  red: "#F87171",       // red-400
  yellow: "#FACC15",    // yellow-400
  blue: "#60A5FA",      // blue-400
  purple: "#C084FC",    // purple-400
  orange: "#FB923C",    // orange-400

  // Action card colors
  charge: "#EAB308",    // yellow-500
  block: "#3B82F6",     // blue-500
  attack: "#EF4444",    // red-500
  energyWave: "#F97316", // orange-500
  teleport: "#A855F7",  // purple-500

  // Button states
  btnPrimary: "#2563EB",   // blue-600
  btnDanger: "#DC2626",    // red-600
  btnSuccess: "#16A34A",   // green-600
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  title: 40,
} as const;
