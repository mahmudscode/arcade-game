import type { PointerEvent } from 'react';
import type { Button } from '@arcade/engine';

interface Props {
  press: (button: Button, down: boolean) => void;
  labels: { a: string; b: string };
}

function hold(press: Props['press'], button: Button) {
  return {
    onPointerDown: (e: PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      press(button, true);
    },
    onPointerUp: () => press(button, false),
    onPointerCancel: () => press(button, false),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

/** On-screen controller shown below the md breakpoint. */
export function TouchPad({ press, labels }: Props) {
  const arrow = 'grid place-items-center bg-ink-3 text-paper active:bg-line';
  return (
    <div className="mt-5 select-none touch-none md:hidden">
      <div className="flex items-center justify-between px-2">
        <div className="grid size-[148px] grid-cols-3 grid-rows-3 overflow-hidden rounded-full border border-line bg-ink-2" role="group" aria-label="Directional pad">
          <span />
          <button {...hold(press, 'up')} className={arrow} aria-label="Up">▲</button>
          <span />
          <button {...hold(press, 'left')} className={arrow} aria-label="Left">◀</button>
          <span className="bg-ink-3" />
          <button {...hold(press, 'right')} className={arrow} aria-label="Right">▶</button>
          <span />
          <button {...hold(press, 'down')} className={arrow} aria-label="Down">▼</button>
          <span />
        </div>

        <div className="relative h-[132px] w-[150px]" role="group" aria-label="Action buttons">
          <button {...hold(press, 'a')} className="absolute right-0 top-0 size-16 rounded-full bg-coral text-xl font-bold text-ink active:brightness-90" aria-label={labels.a}>
            A
          </button>
          <span className="absolute right-[18px] top-[68px] text-xs text-muted">{labels.a}</span>
          <button {...hold(press, 'b')} className="absolute bottom-0 left-2 size-14 rounded-full bg-gold text-lg font-bold text-ink active:brightness-90" aria-label={labels.b}>
            B
          </button>
          <span className="absolute bottom-[-2px] left-[74px] text-xs text-muted">{labels.b}</span>
        </div>
      </div>
      <div className="mt-5 flex justify-center gap-6">
        <button {...hold(press, 'select')} className="btn btn-soft h-8 px-5 text-xs">Select</button>
        <button {...hold(press, 'start')} className="btn btn-soft h-8 px-5 text-xs">Start</button>
      </div>
      <p className="mt-6 text-center text-xs text-muted">Rotate for full-screen landscape</p>
    </div>
  );
}
