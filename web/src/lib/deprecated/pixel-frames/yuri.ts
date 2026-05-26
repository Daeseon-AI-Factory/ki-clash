/**
 * Yuri — elegant, precise, and utterly condescending.
 * Pink accent (#F472B6). Diamond motif — pointed hair on row 0.
 */

import type { CharacterFrameSet } from "../pixel-art-types";
import { _, B, S, E, W, YURI_COLOR as K } from "./palette";

const idle = [
  //0  1  2  3  4  5  6  7  8  9 10 11
  [_, _, _, _, _, K, K, _, _, _, _, _], // 0  diamond point hair top
  [_, _, _, _, K, K, K, K, _, _, _, _], // 1  hair
  [_, _, _, K, K, K, K, K, K, _, _, _], // 2  hair wide
  [_, _, _, K, S, S, S, S, K, _, _, _], // 3  face top
  [_, _, _, S, S, E, S, E, S, _, _, _], // 4  eyes
  [_, _, _, S, S, S, S, S, S, _, _, _], // 5  face
  [_, _, _, _, S, S, S, S, _, _, _, _], // 6  chin
  [_, _, _, _, _, K, K, _, _, _, _, _], // 7  neck
  [_, _, K, K, K, K, K, K, K, K, _, _], // 8  shoulders
  [_, _, K, K, W, K, K, W, K, K, _, _], // 9  torso with diamond trim
  [_, K, K, _, K, K, K, K, _, K, K, _], // 10 arms out
  [_, K, K, _, K, K, K, K, _, K, K, _], // 11 arms
  [_, _, _, _, K, K, K, K, _, _, _, _], // 12 waist
  [_, _, _, _, B, B, B, B, _, _, _, _], // 13 belt
  [_, _, _, B, B, _, _, B, B, _, _, _], // 14 legs
  [_, _, B, B, _, _, _, _, B, B, _, _], // 15 feet
];

export const yuriFrames: CharacterFrameSet = { id: "yuri", idle };
