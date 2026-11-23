import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          JoinTogether
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Primary">
          <a
            href="#categories"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Categories
          </a>
          <a
            href="#matching"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Matching
          </a>
          <a
            href="#workflow"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Workflow
          </a>
          <Link
            to={user ? '/app' : '/login'}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {user ? 'Workspace' : 'Sign In'}
          </Link>
        </nav>

        <div className="flex items-center shrink-0">
          <Link
            to={user ? '/app' : '/register'}
            className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            {user ? 'Open Workspace' : 'Start Matching'}
          </Link>
        </div>
      </div>
    </header>
  );
}
