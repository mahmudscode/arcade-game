import { CATEGORIES, GAMES, type Category } from '@arcade/shared';

export function CategoryChips({ value, onChange }: { value: Category | 'all'; onChange: (v: Category | 'all') => void }) {
  const chips = [{ id: 'all' as const, label: 'All games', count: GAMES.length }, ...CATEGORIES.map((c) => ({ ...c, count: GAMES.filter((g) => g.category === c.id).length }))];
  return (
    <div id="categories" role="group" aria-label="Filter by category" className="hide-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 py-1 md:-mx-10 md:px-10 xl:mx-0 xl:px-0">
      {chips.map((chip) => {
        const active = chip.id === value;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.id)}
            className={`inline-flex h-10 shrink-0 items-center gap-2.5 rounded-full border px-4 text-sm font-semibold transition-colors ${active ? 'border-gold bg-gold text-ink' : 'border-line text-paper hover:border-muted'}`}
          >
            {chip.label}
            <span className={`text-xs font-medium ${active ? 'text-ink/70' : 'text-muted'}`}>{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}
