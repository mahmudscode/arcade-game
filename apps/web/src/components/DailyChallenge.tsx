import { Link } from 'react-router-dom';
import { getGame } from '@arcade/shared';
import { useDaily } from '../lib/daily';
import { useT } from '../lib/i18n';
import { Thumb } from './Sprite';

const fmt = (n: number) => n.toLocaleString('en-US');

/** Today's fixed-seed challenge: the same game and the same run for everybody, with a day streak. */
export function DailyChallenge() {
  const { day, slug, best, streak, playedToday } = useDaily();
  const t = useT();
  const game = getGame(slug);
  if (!game) return null;
  return (
    <section aria-labelledby="daily-title" className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl border border-gold/40 bg-ink-2 p-4 md:mt-10 md:p-5">
      <Thumb slug={game.slug} className="h-16 w-[84px] shrink-0 rounded-xl" />
      <div className="min-w-[200px] flex-1">
        <p className="font-pixel text-[10px] text-gold">{t('daily.title')} · {day}</p>
        <h2 id="daily-title" className="mt-1.5 text-lg font-bold">{game.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {playedToday ? `${t('daily.best', { score: fmt(best) })} ` : `${t('daily.same')} `}
          {streak > 0 ? t('daily.streak', { n: streak }) : t('daily.start')}
        </p>
      </div>
      <Link to={`/play/${game.slug}?daily=${day}`} className="btn btn-gold h-11 px-7">{playedToday ? t('daily.again') : t('daily.play')}</Link>
    </section>
  );
}
