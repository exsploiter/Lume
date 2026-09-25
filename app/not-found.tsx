import Link from 'next/link';
import { Radar, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <Radar className="w-16 h-16 text-slate-600 mb-6" />
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-slate-400 mb-8">This page drifted into technical debt.</p>
      <Link
        href="/"
        className="flex items-center gap-2 glass-panel px-6 py-3 rounded-xl text-accent-cyan hover:bg-white/5 transition-colors"
      >
        <Home className="w-4 h-4" />
        Back to DebtRadar
      </Link>
    </div>
  );
}
