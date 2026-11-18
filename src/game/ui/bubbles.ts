// Where to put a speech bubble so it points at its speaker and never covers anyone's face.
// Pure geometry on screen fractions (0..1, y down), so it works for any camera angle.

export type Rect = { x0: number; x1: number; y0: number; y1: number };
export type Placement = { kind: 'above' | 'left' | 'right' | 'corner'; x: number; y: number };

const GAP = 0.018;   // between the head and the bubble's tail
const TAIL = 0.022;  // the tail's length
const PAD = 0.008;   // faces are padded by this much before checking overlap
const EDGE = 0.012;  // distance from the screen's sides

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x1, b.x1 + PAD) - Math.max(a.x0, b.x0 - PAD)) * Math.max(0, Math.min(a.y1, b.y1 + PAD) - Math.max(a.y0, b.y0 - PAD));

/**
 * Pick a spot for a bubble w x h. Tries, in order: above the speaker's head, beside it on the side away from the other
 * fighter, beside it on the near side, then a top corner on the speaker's side. A spot is good if it stays on screen,
 * between `top` (under the HUD) and `bottom` (above the lower third), and covers no face. The spot used last frame is
 * kept while it's still good, so bubbles don't jump around as the camera moves.
 */
export function placeBubble(o: {
  w: number; h: number; head: Rect | null; other: Rect | null; faces: Rect[]; top: number; bottom: number; last?: Placement;
}): Placement {
  const { w, h, head, other, faces, top, bottom } = o;
  const clampX = (x: number) => Math.min(1 - EDGE - w, Math.max(EDGE, x));
  const clampY = (y: number) => Math.min(bottom - h, Math.max(top, y));
  if (!head) return { kind: 'corner', x: clampX(0.5 - w / 2), y: top };
  const cx = (head.x0 + head.x1) / 2, cy = (head.y0 + head.y1) / 2;
  const otherX = other ? (other.x0 + other.x1) / 2 : cx < 0.5 ? 1 : 0;
  const away: 'left' | 'right' = otherX > cx ? 'left' : 'right';
  const near: 'left' | 'right' = away === 'left' ? 'right' : 'left';

  const spot = (kind: Placement['kind']): Placement => {
    switch (kind) {
      case 'above': return { kind, x: clampX(cx - w / 2), y: head.y0 - GAP - TAIL - h };
      case 'left': return { kind, x: head.x0 - GAP - TAIL - w, y: clampY(cy - h / 2) };
      case 'right': return { kind, x: head.x1 + GAP + TAIL, y: clampY(cy - h / 2) };
      case 'corner': return { kind, x: cx < 0.5 ? EDGE : 1 - EDGE - w, y: top };
    }
  };
  const cost = (p: Placement) => {
    const r = { x0: p.x, x1: p.x + w, y0: p.y, y1: p.y + h };
    const off = p.x < EDGE - 1e-4 || p.x + w > 1 - EDGE + 1e-4 || p.y < top - 1e-4 || p.y + h > bottom + 1e-4;
    return (off ? 1 : 0) + faces.reduce((s, f) => s + overlap(r, f), 0);
  };
  const order: Placement['kind'][] = ['above', away, near, 'corner'];
  if (o.last && cost(spot(o.last.kind)) === 0) return spot(o.last.kind);
  let best = spot('above'), bestCost = Infinity;
  for (const k of order) {
    const p = spot(k), c = cost(p);
    if (c === 0) return p;
    if (c < bestCost) { best = p; bestCost = c; }
  }
  return best;
}
