/**
 * PixelPortrait — static pixel art character portrait for React Native.
 *
 * Renders a pixel grid using small View elements. Each colored pixel
 * is a View with backgroundColor, positioned absolutely in a grid.
 * Transparent pixels are skipped (no View rendered).
 */

import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { getFrame } from "@/lib/deprecated/pixel-frames";

interface PixelPortraitProps {
  characterId: string;
  size?: "sm" | "md" | "lg";
  style?: object;
}

const SIZE_PX: Record<string, number> = {
  sm: 2,
  md: 3,
  lg: 4,
};

export default function PixelPortrait({
  characterId,
  size = "md",
  style,
}: PixelPortraitProps) {
  const frame = useMemo(() => getFrame(characterId), [characterId]);
  const px = SIZE_PX[size] ?? SIZE_PX.md;

  const pixels = useMemo(() => {
    if (!frame) return [];
    const result: { x: number; y: number; color: string }[] = [];
    for (let y = 0; y < frame.length; y++) {
      for (let x = 0; x < frame[y].length; x++) {
        const color = frame[y][x];
        if (color) {
          result.push({ x, y, color });
        }
      }
    }
    return result;
  }, [frame]);

  if (!frame) return null;

  const width = frame[0]?.length ?? 12;
  const height = frame.length;

  return (
    <View
      style={[
        { width: width * px, height: height * px, position: "relative" },
        style,
      ]}
    >
      {pixels.map((p) => (
        <View
          key={`${p.x}-${p.y}`}
          style={{
            position: "absolute",
            left: p.x * px,
            top: p.y * px,
            width: px,
            height: px,
            backgroundColor: p.color,
          }}
        />
      ))}
    </View>
  );
}
