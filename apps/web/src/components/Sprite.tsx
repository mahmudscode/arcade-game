import { useMemo } from 'react';
import { createRng } from '@arcade/engine';

const PALETTE = ['#FFC93C', '#FF5D73', '#4FE3D6', '#A78BFA', '#6EE7A0'];
const TINTS = ['#2a1b55', '#1d2a5e', '#3a1a52', '#17304a'];
const COLS = 11;
const ROWS = 8;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildCells(slug: string) {
  const rng = createRng(hash(slug));
  const colors = [rng.pick(PALETTE), rng.pick(PALETTE), rng.pick(PALETTE)];
  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x <= 5; x++) {
      if (rng.next() < 0.42) continue;
      const color = rng.pick(colors);
      cells.push({ x, y, color });
      if (x < 5) cells.push({ x: COLS - 1 - x, y, color });
    }
  }
  return cells;
}

/** A symmetric pixel creature generated from the game slug: stands in for real artwork. */
export function Sprite({ slug, className }: { slug: string; className?: string }) {
  const cells = useMemo(() => buildCells(slug), [slug]);
  return (
    <svg viewBox={`0 0 ${COLS} ${ROWS}`} className={className} shapeRendering="crispEdges" aria-hidden="true">
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="1" height="1" fill={c.color} />
      ))}
    </svg>
  );
}

/** Card artwork: tinted starfield, sprite, and a colored floor line. */
export function Thumb({ slug, className = '' }: { slug: string; className?: string }) {
  const { bg, line, stars } = useMemo(() => {
    const h = hash(slug);
    const rng = createRng(h ^ 0x9e3779b9);
    return {
      bg: TINTS[h % TINTS.length]!,
      line: PALETTE[(h >>> 3) % PALETTE.length]!,
      stars: Array.from({ length: 9 }, () => ({ x: rng.range(4, 184), y: rng.range(4, 120), o: rng.range(0.2, 0.6) })),
    };
  }, [slug]);
  const cells = useMemo(() => buildCells(slug), [slug]);
  return (
    <svg viewBox="0 0 188 141" preserveAspectRatio="xMidYMid slice" className={className} shapeRendering="crispEdges" aria-hidden="true">
      <rect width="188" height="141" fill={bg} />
      {stars.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width="1.500" height="1.500" fill="#F6EFFF" opacity={s.o} />
      ))}
      <g transform="translate(55 38) scale(7)">
        {cells.map((c) => (
          <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="1" height="1" fill={c.color} />
        ))}
      </g>
      <rect x="8" y="131" width="172" height="2" fill={line} opacity="0.85" />
    </svg>
  );
}
