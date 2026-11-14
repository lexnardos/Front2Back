export default function BackofficeLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-8 w-72 max-w-full rounded bg-slate-200" />
      <div className="mt-2 h-4 w-96 max-w-full rounded bg-slate-200/70" />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="h-6 w-64 rounded bg-slate-100" />
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 rounded-lg bg-slate-100/80" />
          ))}
        </div>
      </div>
    </div>
  );
}
