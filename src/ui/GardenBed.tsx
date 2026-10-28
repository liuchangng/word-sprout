import type { CardState } from "../store/srs";
import { stageOf } from "../store/garden";
import { Sprout } from "./Sprout";

export function GardenBed({ wordIds, cards }: { wordIds: string[]; cards: Record<string, CardState> }) {
  return (
    <div className="bed" role="list">
      {wordIds.map((id) => (
        <div className="bed-cell" key={id} role="listitem">
          <Sprout stage={stageOf(cards[id])} size={40} />
        </div>
      ))}
    </div>
  );
}
