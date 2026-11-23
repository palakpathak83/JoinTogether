import { useState } from 'react';
import { Compass, ShoppingBag, Terminal, Ticket } from 'lucide-react';
import type { MatchCategory } from '../types/index.ts';

interface EditorialImageProps {
  src: string;
  alt: string;
  category?: MatchCategory;
  className?: string;
}

const FALLBACK_ICONS = {
  shopping: ShoppingBag,
  travel: Compass,
  hackathon: Terminal,
  event: Ticket,
};

export function EditorialImage({ src, alt, category = 'hackathon', className = '' }: EditorialImageProps) {
  const [failed, setFailed] = useState(false);
  const Icon = FALLBACK_ICONS[category];

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200/70 to-blue-50 text-slate-500 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Icon className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
        <span className="mt-2 text-xs font-medium text-slate-500">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
