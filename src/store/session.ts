// 仅类型定义，Task 9 补上会话引擎实现。
import type { Grade } from "./srs";

export type StepKind = "listen" | "meaning" | "spell" | "reveal";

export interface Step {
  wordId: string;
  kind: StepKind;
  options?: string[];
  retry?: boolean;
}

export interface ActiveSession {
  id: string;
  started: number;
  steps: Step[];
  index: number;
  graded: Record<string, Grade>;
  newIds: string[];
  reviewIds: string[];
  errors: Record<string, number>;
  pending?: { correct: boolean };
  finished?: number;
}
