/**
 * Danbi — serene like rain, deadly like a flood.
 * Cyan accent (#22D3EE). Flowing hair — extends down rows 0-2 on left side.
 */

import type { CharacterFrameSet } from "../pixel-art-types";
import { _, B, S, E, DANBI_COLOR as C } from "./palette";

const idle = [
  //0  1  2  3  4  5  6  7  8  9 10 11
  [_, _, _, _, C, C, C, C, _, _, _, _], // 0  hair top
  [_, _, _, C, C, C, C, C, C, _, _, _], // 1  hair
  [_, _, C, C, S, S, S, S, C, C, _, _], // 2  face top + flowing hair sides
  [_, _, C, S, S, E, S, E, S, C, _, _], // 3  eyes + hair framing face
  [_, _, _, S, S, S, S, S, S, _, _, _], // 4  face
  [_, _, _, _, S, S, S, S, _, _, _, _], // 5  chin
  [_, _, _, _, _, C, C, _, _, _, _, _], // 6  neck
  [_, _, C, C, C, C, C, C, C, C, _, _], // 7  shoulders
  [_, _, C, C, C, C, C, C, C, C, _, _], // 8  torso
  [_, C, C, _, C, C, C, C, _, C, C, _], // 9  arms out
  [_, C, C, _, C, C, C, C, _, C, C, _], // 10 arms
  [_, _, _, _, C, C, C, C, _, _, _, _], // 11 waist
  [_, _, _, _, B, B, B, B, _, _, _, _], // 12 belt
  [_, _, _, B, B, _, _, B, B, _, _, _], // 13 legs
  [_, _, _, B, B, _, _, B, B, _, _, _], // 14 legs
  [_, _, B, B, _, _, _, _, B, B, _, _], // 15 feet
];

export const danbiFrames: CharacterFrameSet = { id: "danbi", idle };
