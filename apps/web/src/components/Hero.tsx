import { Link } from 'react-router-dom';
import type { GameMeta } from '@arcade/shared';
import { useFavorites } from '../lib/storage';
import { HeartIcon } from './icons';
import { Sprite } from './Sprite';

/** Marquee-style dotted border: two dashed strokes with round caps, offset so gold and white alternate. */
function MarqueeBorder() {
  const rect = { x: 7, y: 7, rx: 20, style: { width: 'calc(100% - 14px)', height: 'calc(100% - 14px)' } };
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
      <rect {...rect} fill="none" stroke="#FFC93C" strokeWidth="6" strokeLinecap="round" strokeDasharray="0 44" />
      <rect {...rect} fill="none" stroke="#F6EFFF" strokeWidth="6" strokeLinecap="round" strokeDasharray="0 44" strokeDashoffset="-22" />
    </svg>
  );
}

function PreviewScreen() {
  return (
    <div className="rounded-[26px] border-2 border-line bg-[#0d0819] p-2.5 shadow-[0_0_0_4px_#1a1033]">
      <div className="scanlines relative aspect-[1.4] overflow-hidden rounded-2xl bg-[#120a2a]">
        <div className="absolute inset-x-4 top-3 flex justify-between font-pixel text-[9px] md:text-[11px]">
          <span>1UP 004250</span>
          <span className="text-gold">HI 098100</span>
        </div>
        <Sprite slug="saucer-swarm" className="absolute left-[18%] top-[26%] w-[7%]" />
        <Sprite slug="laser-lanes" className="absolute left-[44%] top-[16%] w-[6%]" />
        <Sprite slug="sky-ace-88" className="absolute right-[12%] top-[14%] w-[7%]" />
        <Sprite slug="frost-fortress" className="absolute left-[60%] top-[32%] w-[7%]" />
        <Sprite slug="cave-comet" className="absolute left-[34%] top-[46%] w-[6%]" />
        <span className="absolute bottom-[16%] left-[48%] h-[8%] w-[1.5%] bg-gold" />
        <span className="absolute bottom-[10%] left-[47%] h-[5%] w-[4%] bg-cyan" />
        <span className="absolute inset-x-3 bottom-2 h-0.5 bg-gold/70" />
      </div>
    </div>
  );
}

export function Hero({ game }: { game: GameMeta }) {
  const { favs, toggle } = useFavorites();
  const fav = favs.has(game.slug);
  const [first, ...rest] = game.title.toUpperCase().split(' ');
  return (
    <section aria-labelledby="hero-title" className="relative rounded-[28px] bg-ink-2">
      <MarqueeBorder />
      <div className="relative grid items-center gap-6 px-6 py-8 md:grid-cols-2 md:gap-10 md:px-14 md:py-14 xl:px-[70px]">
        <div className="order-2 md:order-1">
          <p className="text-sm font-semibold text-cyan">Game of the week</p>
          <h1 id="hero-title" className="mt-2 font-pixel text-[20px] leading-[1.25] text-gold md:text-[34px] xl:text-[44px]">
            {first}
            <br />
            {rest.join(' ')}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed md:mt-6 md:text-[17px]">{game.description}</p>
          <div className="mt-5 flex items-center gap-3 md:mt-7">
            <Link to={`/play/${game.slug}`} className="btn btn-gold h-11 px-8 md:h-[52px] md:px-10 md:text-base">
              Play now
            </Link>
            <button
              type="button"
              onClick={() => toggle(game.slug)}
              aria-pressed={fav}
              className="btn btn-outline hidden h-[52px] px-8 md:inline-flex md:text-base"
            >
              {fav ? 'In favorites' : 'Add to favorites'}
            </button>
            <button
              type="button"
              onClick={() => toggle(game.slug)}
              aria-pressed={fav}
              aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
              className={`btn btn-outline size-11 p-0 md:hidden ${fav ? 'text-coral' : ''}`}
            >
              <HeartIcon filled={fav} />
            </button>
          </div>
        </div>
        <div className="order-1 md:order-2">
          <PreviewScreen />
        </div>
      </div>
    </section>
  );
}
