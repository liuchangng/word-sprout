import { MASTERED_STABILITY, type CardState } from "./srs";

export type Stage = 0 | 1 | 2 | 3;
export const STAGE_LABEL = ["种子", "嫩芽", "叶", "花"] as const;

/** 由 FSRS 卡片推导植物阶段，不额外存状态。 */
export function stageOf(card?: CardState): Stage {
  if (!card || card.reps === 0) return 0;
  if (card.reps >= 2 && card.sd >= 1) return card.s >= MASTERED_STABILITY ? 3 : 2;
  return 1;
}

export interface Progress {
  total: number;
  sprouted: number;
  leafed: number;
  bloomed: number;
  ratio: number;
}

export function progressOf(wordIds: string[], cards: Record<string, CardState>): Progress {
  let sprouted = 0;
  let leafed = 0;
  let bloomed = 0;
  for (const id of wordIds) {
    const stage = stageOf(cards[id]);
    if (stage >= 1) sprouted++;
    if (stage >= 2) leafed++;
    if (stage === 3) bloomed++;
  }
  const total = wordIds.length;
  return { total, sprouted, leafed, bloomed, ratio: total ? bloomed / total : 0 };
}
