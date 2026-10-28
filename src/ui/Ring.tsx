export function Ring({ value, max, size = 120, label }: { value: number; max: number; size?: number; label?: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
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
