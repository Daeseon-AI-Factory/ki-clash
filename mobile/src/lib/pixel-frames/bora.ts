/**
 * Bora — mysterious oracle from the shadows.
 * Purple accent (#C084FC). Standard fighting stance.
 * Migrated from PixelArtPanel prototype.
 */

import type { CharacterFrameSet } from "../pixel-art-types";
import { _, B, S, E, BORA_COLOR as P } from "./palette";

const idle = [
  //0  1  2  3  4  5  6  7  8  9 10 11
  [_, _, _, _, P, P, P, P, _, _, _, _], // 0  hair
  [_, _, _, P, P, P, P, P, P, _, _, _], // 1  hair
  [_, _, _, P, S, S, S, S, P, _, _, _], // 2  face top
  [_, _, _, S, S, E, S, E, S, _, _, _], // 3  eyes
  [_, _, _, S, S, S, S, S, S, _, _, _], // 4  face
  [_, _, _, _, S, S, S, S, _, _, _, _], // 5  chin
  [_, _, _, _, _, P, P, _, _, _, _, _], // 6  neck
  [_, _, P, P, P, P, P, P, P, P, _, _], // 7  shoulders
  [_, _, P, P, P, P, P, P, P, P, _, _], // 8  torso
  [_, P, P, _, P, P, P, P, _, P, P, _], // 9  arms out
  [_, P, P, _, P, P, P, P, _, P, P, _], // 10 arms
  [_, _, _, _, P, P, P, P, _, _, _, _], // 11 waist
  [_, _, _, _, B, B, B, B, _, _, _, _], // 12 belt
  [_, _, _, B, B, _, _, B, B, _, _, _], // 13 legs
  [_, _, _, B, B, _, _, B, B, _, _, _], // 14 legs
  [_, _, B, B, _, _, _, _, B, B, _, _], // 15 feet
];

export const boraFrames: CharacterFrameSet = { id: "bora", idle };
