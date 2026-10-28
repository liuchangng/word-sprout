export interface DayStat {
  learned: number;
  reviewed: number;
  correct: number;
  total: number;
}

export interface Stats {
  days: Record<string, DayStat>;
  streak: number;
  lastDay: string | null;
}

export const emptyStats = (): Stats => ({ days: {}, streak: 0, lastDay: null });

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

/** 累加当天数据，并在有学习行为时维护连击。 */
export function bumpDay(stats: Stats, patch: Partial<DayStat>, now = new Date()): Stats {
  const k = dayKey(now);
  const base = stats.days[k] ?? { learned: 0, reviewed: 0, correct: 0, total: 0 };
  const day: DayStat = {
    learned: base.learned + (patch.learned ?? 0),
    reviewed: base.reviewed + (patch.reviewed ?? 0),
    correct: base.correct + (patch.correct ?? 0),
    total: base.total + (patch.total ?? 0),
  };
  const active = day.learned + day.reviewed > 0;
  let streak = stats.streak;
  let lastDay = stats.lastDay;
  if (active && lastDay !== k) {
    streak = lastDay && shiftKey(lastDay, 1) === k ? streak + 1 : 1;
    lastDay = k;
  }
  return { days: { ...stats.days, [k]: day }, streak, lastDay };
}

/** 打开应用时校正连击，昨天之后没学则归零。 */
export function reconcileStreak(stats: Stats, now = new Date()): Stats {
  if (!stats.lastDay) return stats;
  const today = dayKey(now);
  if (stats.lastDay === today || shiftKey(stats.lastDay, 1) === today) return stats;
  return { ...stats, streak: 0 };
}

export const learnedToday = (stats: Stats, now = new Date()) => stats.days[dayKey(now)]?.learned ?? 0;
