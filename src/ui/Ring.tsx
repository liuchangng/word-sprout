export function Ring({ value, max, size = 120, label }: { value: number; max: number; size?: number; label?: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  // 负数、NaN、max 为 0 都落到 0，避免进度环画满或画出无效弧
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeMax = Number.isFinite(max) ? max : 0;
  const pct = safeMax > 0 ? Math.max(0, Math.min(1, safeValue / safeMax)) : 0;
  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label ?? "今日进度"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFE5D4" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#4E9B5F" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-text">
        <strong>{value}</strong>
        <span>{label ?? `/ ${max}`}</span>
      </div>
    </div>
  );
}
