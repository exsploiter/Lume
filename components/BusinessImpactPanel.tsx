import type { BusinessTranslationResult } from '@/types';

export function BusinessImpactPanel({
  risks,
  operationalRisks,
  customerImpact,
  ignoreConsequences,
}: {
  risks: BusinessTranslationResult[];
  operationalRisks: string[];
  customerImpact: string[];
  ignoreConsequences: string[];
}) {
  const top = risks[0] ?? null;

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,123,79,0.22)] bg-[#f5efe7]/45 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-extrabold text-[#2b2622]">Business impact</h3>
        <p className="text-sm text-[#8f8175] font-semibold">How the repository risk affects customers, operations, and the business.</p>
      </div>
      {top && (
        <div className="rounded-2xl bg-[#efe8de]/60 border border-[rgba(176,122,77,0.08)] p-4 text-sm text-[#6b5b4d] space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">Executive summary</div>
          <div className="text-[#2b2622] font-extrabold text-base">{top.executiveSummary}</div>
          <div className="text-[#6b5b4d] font-medium leading-relaxed">{top.businessImpact}</div>
          <div className="text-[#8f8175] text-xs font-bold mt-2">Urgency: {top.urgency}</div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3 text-sm text-[#6b5b4d]">
        <ListCard title="Customer impact" items={customerImpact} />
        <ListCard title="Operational risks" items={operationalRisks} />
        <ListCard title="If ignored" items={ignoreConsequences} />
      </div>
    </section>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  // Deduplicate items to prevent identical sentences/insights from rendering multiple times
  const uniqueItems = Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));

  return (
    <div className="rounded-2xl bg-[#efe8de]/60 border border-[rgba(176,122,77,0.08)] p-4 space-y-2">
      <div className="text-xs uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{title}</div>
      <div className="space-y-1 text-sm text-[#6b5b4d] font-medium">
        {uniqueItems.length > 0 ? uniqueItems.map((item) => <div key={item}>{item}</div>) : <div className="text-[#8f8175]">No additional notes.</div>}
      </div>
    </div>
  );
}
