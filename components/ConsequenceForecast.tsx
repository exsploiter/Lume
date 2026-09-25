import type { ConsequencePredictionResult } from '@/types';

export function ConsequenceForecast({ forecast }: { forecast: ConsequencePredictionResult | null }) {
  if (!forecast) return null;

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,123,79,0.22)] bg-[#f5efe7]/45 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-extrabold text-[#2b2622]">What happens if ignored</h3>
        <p className="text-sm text-[#8f8175] font-semibold">Likely consequences when the issue is left unresolved.</p>
      </div>
      
      <div className="grid gap-3 md:grid-cols-2 text-sm text-[#6b5b4d]">
        <Block title="Short term" value={forecast.shortTermImpact} />
        <Block title="Long term" value={forecast.longTermImpact} />
        <Block title="Production risk" value={forecast.productionRisk} />
        <Block title="Customer risk" value={forecast.customerRisk} />
        <Block title="Scalability impact" value={forecast.scalabilityImpact} />
        <Block title="Severity" value={forecast.estimatedSeverity} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-[#6b5b4d]">
        {forecast.likelyFailureScenarios.map((scenario) => (
          <span key={scenario} className="rounded-full bg-[#efe8de]/80 border-2 border-[rgba(176,122,77,0.25)] px-3 py-1 font-bold shadow-sm">
            {scenario}
          </span>
        ))}
      </div>
    </section>
  );
}

function Block({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/60 border border-[rgba(176,122,77,0.08)] p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{title}</div>
      <div className="mt-1 text-[#6b5b4d] font-bold leading-relaxed">{value}</div>
    </div>
  );
}
