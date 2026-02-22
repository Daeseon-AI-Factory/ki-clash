/**
 * Seokjin — immovable old master carved from stone.
 * Orange accent (#FB923C). Broad shoulders — wider torso on rows 7-10.
 */

import type { CharacterFrameSet } from "../pixel-art-types";
import { _, B, S, E, SEOKJIN_COLOR as O } from "./palette";

const idle = [
  //0  1  2  3  4  5  6  7  8  9 10 11
  [_, _, _, _, O, O, O, O, _, _, _, _], // 0  hair
  [_, _, _, O, O, O, O, O, O, _, _, _], // 1  hair
  [_, _, _, O, S, S, S, S, O, _, _, _], // 2  face top
  [_, _, _, S, S, E, S, E, S, _, _, _], // 3  eyes
  [_, _, _, S, S, S, S, S, S, _, _, _], // 4  face
  [_, _, _, _, S, S, S, S, _, _, _, _], // 5  chin
  [_, _, _, _, _, O, O, _, _, _, _, _], // 6  neck
  [_, O, O, O, O, O, O, O, O, O, O, _], // 7  broad shoulders
  [_, O, O, O, O, O, O, O, O, O, O, _], // 8  wide torso
  [O, O, O, _, O, O, O, O, _, O, O, O], // 9  arms out (wider)
  [O, O, O, _, O, O, O, O, _, O, O, O], // 10 arms (wider)
  [_, _, _, _, O, O, O, O, _, _, _, _], // 11 waist
  [_, _, _, _, B, B, B, B, _, _, _, _], // 12 belt
  [_, _, _, B, B, _, _, B, B, _, _, _], // 13 legs
  [_, _, _, B, B, _, _, B, B, _, _, _], // 14 legs
  [_, _, B, B, _, _, _, _, B, B, _, _], // 15 feet
];

export const seokjinFrames: CharacterFrameSet = { id: "seokjin", idle };
