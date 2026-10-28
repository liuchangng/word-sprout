import type { Stage } from "../store/garden";
import { STAGE_LABEL } from "../store/garden";

/** 四阶段植物，纯 SVG，无外部图片。 */
export function Sprout({ stage, size = 48 }: { stage: Stage; size?: number }) {
  const stroke = "#4E9B5F";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`植物阶段：${STAGE_LABEL[stage]}`}>
      <ellipse cx="24" cy="42" rx="14" ry="4" fill="#EDE1CC" />
      {stage === 0 && <circle cx="24" cy="38" r="3.5" fill="#A9744F" />}
      {stage >= 1 && (
        <>
          <path d="M24 40 V28" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <path d="M24 31 C18 31 15 27 15 23 C20 23 24 26 24 31 Z" fill={stroke} />
        </>
      )}
      {stage >= 2 && <path d="M24 33 C30 33 33 29 33 25 C28 25 24 28 24 33 Z" fill="#6FB572" />}
      {stage >= 3 && (
        <>
          <circle cx="24" cy="20" r="6" fill="#F5C542" />
          <circle cx="24" cy="20" r="2.5" fill="#FFF3C4" />
        </>
      )}
    </svg>
  );
}
