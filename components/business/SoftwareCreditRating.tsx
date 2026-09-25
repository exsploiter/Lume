import type { SoftwareCreditRatingResult } from '@/lib/business-intelligence/software-credit-rating';

export function SoftwareCreditRating({ rating }: { rating: SoftwareCreditRatingResult | null }) {
  if (!rating) return null;

  return (
    <section className="rounded-[24px] border border-[rgba(176,123,79,0.2)] bg-[#fffaf5]/70 p-6 shadow-sm space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Software Credit Rating</p>
        <h3 className="mt-2 text-4xl font-black tracking-tight text-[#2b2622]">{rating.rating}</h3>
        <p className="mt-1 text-sm font-bold text-[#9a6a43]">{rating.outlook}</p>
      </div>
      <p className="text-sm leading-relaxed font-medium text-[#6b5b4d]">{rating.explanation}</p>
      <div className="inline-flex rounded-full border border-[rgba(176,123,79,0.16)] bg-[#efe8de]/80 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#8f8175]">
        Composite score {rating.score.toFixed(1)}/100
      </div>
    </section>
  );
}