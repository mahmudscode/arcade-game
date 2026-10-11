import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../lib/achievements';

/** Announces newly unlocked achievements, one at a time. */
export function AchievementToast() {
  const { achievement, dismiss } = useToast();
  useEffect(() => {
    if (!achievement) return;
    const t = window.setTimeout(dismiss, 4500);
    return () => window.clearTimeout(t);
  }, [achievement, dismiss]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8">
      {achievement && (
        <Link to="/achievements" className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-gold bg-ink-2 px-5 py-3 shadow-lg">
          <span aria-hidden className="text-2xl">🏆</span>
          <span>
            <span className="block font-pixel text-[10px] text-gold">ACHIEVEMENT UNLOCKED</span>
            <span className="block text-sm font-semibold">{achievement.title}</span>
            <span className="block text-xs text-muted">{achievement.description}</span>
          </span>
        </Link>
      )}
    </div>
  );
}
