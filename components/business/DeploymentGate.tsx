import type { DeploymentGateResult } from '@/lib/business-intelligence/deployment-gate';

export function DeploymentGate({ gate }: { gate: DeploymentGateResult | null }) {
  if (!gate) return null;

  const toneClass =
    gate.state === 'SAFE TO SHIP'
      ? 'text-emerald-700'
      : gate.state === 'DEPLOY WITH CAUTION'
        ? 'text-amber-700'
        : gate.state === 'HIGH RISK'
          ? 'text-orange-700'
          : 'text-rose-700';

  return (
    <section className="rounded-[24px] border border-[rgba(176,123,79,0.2)] bg-[#fffaf5]/70 p-6 shadow-sm space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Deployment Gate</p>
        <h3 className={`mt-2 text-3xl font-black tracking-tight ${toneClass}`}>{gate.state}</h3>
        <p className="mt-1 text-sm font-bold text-[#8f8175]">Executive release decision</p>
      </div>

      <div className="space-y-2">
        {gate.reasons.map((reason) => (
          <div key={reason} className="rounded-2xl border border-[rgba(176,123,79,0.08)] bg-[#efe8de]/65 px-4 py-3 text-sm font-semibold text-[#6b5b4d]">
            {reason}
          </div>
        ))}
      </div>
    </section>
  );
}