import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="page-x pt-16 text-center">
      <h1 className="font-pixel text-2xl text-gold">404</h1>
      <p className="mt-6 text-muted">That page doesn't exist.</p>
      <Link to="/" className="btn btn-gold mt-6 h-11 px-8">Back to games</Link>
    </div>
  );
}
