import type { GameStatus, Rng } from '@arcade/engine';

/** Shared look for games: palette, HUD, game-over overlay and particle sparks. Pure helpers, no globals. */
export const W = 800;
export const H = 570;
export const TAU = Math.PI * 2;
export const COLORS = {
  bg: '#120a2a',
  paper: '#F6EFFF',
  gold: '#FFC93C',
  coral: '#FF5D73',
  cyan: '#4FE3D6',
  purple: '#A78BFA',
  muted: '#B7A9DB',
};
export const GEM_COLORS = [COLORS.coral, COLORS.gold, COLORS.cyan, COLORS.purple, '#7BE495', '#FF9F68'];

export const pad = (n: number) => String(Math.min(Math.max(0, Math.floor(n)), 999999)).padStart(6, '0');

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function burst(sparks: Spark[], rng: Rng, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU);
    const v = rng.range(40, 200);
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rng.range(0.3, 0.6), color });
  }
}

export function stepSparks(sparks: Spark[], dt: number): void {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i]!;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) sparks.splice(i, 1);
  }
}

export function drawSparks(g: CanvasRenderingContext2D, sparks: Spark[]): void {
  for (const p of sparks) {
    g.globalAlpha = Math.max(0, p.life * 2);
    g.fillStyle = p.color;
    g.fillRect(p.x, p.y, 3, 3);
  }
  g.globalAlpha = 1;
}

export function clear(g: CanvasRenderingContext2D): void {
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);
}

/** Top HUD (score / hi) and a left-bottom caption; pass `lives` to draw life pips bottom-right. */
export function hud(g: CanvasRenderingContext2D, s: { score: number; hi: number }, caption: string, lives?: number): void {
  g.font = '14px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.fillStyle = COLORS.paper;
  g.fillText(`1UP  ${pad(s.score)}`, 22, 12);
  g.textAlign = 'right';
  g.fillStyle = COLORS.gold;
  g.fillText(`HI ${pad(Math.max(s.hi, s.score))}`, W - 22, 12);
  g.textAlign = 'left';
  g.fillStyle = COLORS.muted;
  g.fillText(caption, 22, H - 26);
  if (lives !== undefined) {
    g.fillStyle = COLORS.cyan;
    for (let i = 0; i < Math.max(0, lives); i++) g.fillRect(W - 40 - i * 22, H - 26, 14, 12);
  }
}

export function gameOver(g: CanvasRenderingContext2D, over: boolean): void {
  if (!over) return;
  g.fillStyle = 'rgba(18,10,42,0.72)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillStyle = COLORS.coral;
  g.font = '32px "Press Start 2P", monospace';
  g.fillText('GAME OVER', W / 2, H / 2 - 40);
  g.fillStyle = COLORS.paper;
  g.font = '13px "Press Start 2P", monospace';
  g.fillText('PRESS SPACE TO PLAY AGAIN', W / 2, H / 2 + 20);
}

export function banner(g: CanvasRenderingContext2D, text: string, y = 140): void {
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillStyle = COLORS.cyan;
  g.font = '22px "Press Start 2P", monospace';
  g.fillText(text, W / 2, y);
}

export function makeStatus(s: { score: number; hi: number; over: boolean }, lives: number, level: number): GameStatus {
  return { score: s.score, hiScore: Math.max(s.hi, s.score), lives: Math.max(0, lives), level, over: s.over };
}
