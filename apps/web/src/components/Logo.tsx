import { Link } from 'react-router-dom';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-3 ${className}`} aria-label="Arcade Hub home">
      <span className="grid size-6 place-items-center rounded-[3px] bg-coral" aria-hidden="true">
        <span className="size-3 rounded-sm bg-gold" />
      </span>
      <span className="font-pixel text-[15px] leading-none text-gold md:text-[20px]">ARCADE HUB</span>
    </Link>
  );
}
