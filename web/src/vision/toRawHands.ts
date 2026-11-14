import type { RawHand } from '../gestures/assignHands';
import type { GestureGuess, GestureName } from '../gestures/types';

/** The parts of MediaPipe's GestureRecognizerResult that we read. */
export interface RecognizerResultLike {
  landmarks: ReadonlyArray<ReadonlyArray<{ x: number; y: number; z: number }>>;
  handedness: ReadonlyArray<ReadonlyArray<{ categoryName: string; score: number }>>;
  gestures: ReadonlyArray<ReadonlyArray<{ categoryName: string; score: number }>>;
}

const GESTURES: ReadonlySet<string> = new Set<GestureName>([
  'None', 'Closed_Fist', 'Open_Palm', 'Pointing_Up', 'Thumb_Down', 'Thumb_Up', 'Victory', 'ILoveYou',
]);

function topGesture(list: ReadonlyArray<{ categoryName: string; score: number }> | undefined): GestureGuess | null {
  const top = list?.[0];
  if (!top || !GESTURES.has(top.categoryName)) return null;
  return { name: top.categoryName as GestureName, score: top.score };
}

export function toRawHands(result: RecognizerResultLike): RawHand[] {
  const hands: RawHand[] = [];
  result.landmarks.forEach((points, i) => {
    const side = result.handedness[i]?.[0];
    if (!side || (side.categoryName !== 'Left' && side.categoryName !== 'Right')) return;
    hands.push({
      label: side.categoryName,
      score: side.score,
      landmarks: points.map(({ x, y, z }) => ({ x, y, z })),
      gesture: topGesture(result.gestures[i]),
    });
  });
  return hands;
}
