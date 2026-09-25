'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RoadmapTable } from '@/components/RoadmapTable';
import { LoadingState } from '@/components/LoadingState';
import { nodesToRoadmap } from '@/lib/csv';
import type { DebtNode, RoadmapItem } from '@/types';

const ITEMS_PER_PAGE = 20;

export default function RoadmapPage() {
  const params = useParams();
  const analysisId = params.id as string;
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/analysis/${analysisId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const loadedNodes = (data.nodes ?? []) as DebtNode[];
        setItems(nodesToRoadmap(loadedNodes));
      } catch {
        /* handled by empty state */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [analysisId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pagedItems = items.slice(startIndex, endIndex);
  const showingStart = items.length === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(endIndex, items.length);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingState title="Loading roadmap" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 fade-in-up">
      <div className="mb-5">
        <Link
          href={`/analyze/${analysisId}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(176,123,79,0.2)] bg-[#efe8de]/70 hover:bg-[#e5d9c8] text-[#8c6239] font-bold text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Analyze</span>
        </Link>
      </div>

      <RoadmapTable items={pagedItems} analysisId={analysisId} />

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500 font-semibold">
          Showing {showingStart}-{showingEnd} of {items.length}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3.5 py-2 rounded-lg border border-[rgba(176,123,79,0.2)] bg-white/70 text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f7f2ec]"
          >
            Prev
          </button>
          <span className="text-sm font-bold text-slate-600 min-w-[88px] text-center">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-3.5 py-2 rounded-lg border border-[rgba(176,123,79,0.2)] bg-white/70 text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f7f2ec]"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
