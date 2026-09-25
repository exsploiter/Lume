export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="w-10 h-10 rounded-full border-4 border-[#efe8de] border-t-[#8c6239] animate-spin" />
        <p className="text-sm font-semibold">Loading view...</p>
      </div>
    </div>
  );
}
