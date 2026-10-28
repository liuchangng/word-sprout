import type { CardState } from "../store/srs";
import { stageOf } from "../store/garden";
import { Sprout } from "./Sprout";

export function GardenBed({
  wordIds,
  cards,
  labelOf,
}: {
  wordIds: string[];
  cards: Record<string, CardState>;
  labelOf?: (id: string) => string;
}) {
  return (
    <div className="bed" role="list">
      {wordIds.map((id) => (
        <div className="bed-cell" key={id} role="listitem" aria-label={labelOf?.(id)}>
          <Sprout stage={stageOf(cards[id])} size={40} />
        </div>
      ))}
    </div>
  );
}
