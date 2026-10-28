/** 按种子稳定打乱，保证同一会话重绘不变。 */
export function shuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = Math.abs(Math.floor(seed)) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const firstLetter = (text: string) => (text.trim()[0] ?? "?").toUpperCase();
