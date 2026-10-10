import { Link } from 'react-router-dom';

export function Leaderboards() {
  return (
    <div className="page-x pt-8">
      <h1 className="text-2xl font-bold">Leaderboards</h1>
      <p className="mt-4 max-w-xl text-muted">
        Global and per-game leaderboards arrive with the replay verifier: only server-verified scores will be ranked. Submitted scores are stored as pending until then. Your personal best for each game is tracked in this browser.
      </p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page-x pt-16 text-center">
      <h1 className="font-pixel text-2xl text-gold">404</h1>
      <p className="mt-6 text-muted">That page doesn't exist.</p>
      <Link to="/" className="btn btn-gold mt-6 h-11 px-8">Back to games</Link>
    </div>
  );
}
