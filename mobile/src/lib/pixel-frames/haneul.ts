/**
 * Haneul — calm monk who fights with the wind.
 * Blue accent (#60A5FA). Standard fighting stance.
 * Migrated from PixelArtPanel prototype.
 */

import type { CharacterFrameSet } from "../pixel-art-types";
import { _, B, S, E, HANEUL_COLOR as H } from "./palette";

const idle = [
  //0  1  2  3  4  5  6  7  8  9 10 11
  [_, _, _, _, H, H, H, H, _, _, _, _], // 0  hair
  [_, _, _, H, H, H, H, H, H, _, _, _], // 1  hair
  [_, _, _, H, S, S, S, S, H, _, _, _], // 2  face top
  [_, _, _, S, S, E, S, E, S, _, _, _], // 3  eyes
  [_, _, _, S, S, S, S, S, S, _, _, _], // 4  face
  [_, _, _, _, S, S, S, S, _, _, _, _], // 5  chin
  [_, _, _, _, _, H, H, _, _, _, _, _], // 6  neck
  [_, _, H, H, H, H, H, H, H, H, _, _], // 7  shoulders
  [_, _, H, H, H, H, H, H, H, H, _, _], // 8  torso
  [_, H, H, _, H, H, H, H, _, H, H, _], // 9  arms out
  [_, H, H, _, H, H, H, H, _, H, H, _], // 10 arms
  [_, _, _, _, H, H, H, H, _, _, _, _], // 11 waist
  [_, _, _, _, B, B, B, B, _, _, _, _], // 12 belt
  [_, _, _, B, B, _, _, B, B, _, _, _], // 13 legs
  [_, _, _, B, B, _, _, B, B, _, _, _], // 14 legs
  [_, _, B, B, _, _, _, _, B, B, _, _], // 15 feet
];

export const haneulFrames: CharacterFrameSet = { id: "haneul", idle };
