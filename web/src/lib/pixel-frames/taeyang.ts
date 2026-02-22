/**
 * Taeyang — brash hothead who burns everything.
 * Yellow accent (#FACC15). Spiky hair variation — upward spikes on rows 0-1.
 */

import type { CharacterFrameSet } from "../pixel-art-types";
import { _, B, S, E, TAEYANG_COLOR as Y } from "./palette";

const idle = [
  //0  1  2  3  4  5  6  7  8  9 10 11
  [_, _, _, Y, _, Y, Y, _, Y, _, _, _], // 0  spiky hair top
  [_, _, _, Y, Y, Y, Y, Y, Y, _, _, _], // 1  hair
  [_, _, _, Y, S, S, S, S, Y, _, _, _], // 2  face top
  [_, _, _, S, S, E, S, E, S, _, _, _], // 3  eyes
  [_, _, _, S, S, S, S, S, S, _, _, _], // 4  face
  [_, _, _, _, S, S, S, S, _, _, _, _], // 5  chin
  [_, _, _, _, _, Y, Y, _, _, _, _, _], // 6  neck
  [_, _, Y, Y, Y, Y, Y, Y, Y, Y, _, _], // 7  shoulders
  [_, _, Y, Y, Y, Y, Y, Y, Y, Y, _, _], // 8  torso
  [_, Y, Y, _, Y, Y, Y, Y, _, Y, Y, _], // 9  arms out
  [_, Y, Y, _, Y, Y, Y, Y, _, Y, Y, _], // 10 arms
  [_, _, _, _, Y, Y, Y, Y, _, _, _, _], // 11 waist
  [_, _, _, _, B, B, B, B, _, _, _, _], // 12 belt
  [_, _, _, B, B, _, _, B, B, _, _, _], // 13 legs
  [_, _, _, B, B, _, _, B, B, _, _, _], // 14 legs
  [_, _, B, B, _, _, _, _, B, B, _, _], // 15 feet
];

export const taeyangFrames: CharacterFrameSet = { id: "taeyang", idle };
