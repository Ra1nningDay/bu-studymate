// Route-level loading boundary for admin pages. Renders inside AdminShell so the
// sidebar and header stay interactive while the server renders the next page,
// and lets dynamic <Link> prefetch up to this boundary for instant feedback.
const block = "rounded-md bg-slate-100 motion-safe:animate-pulse";

export default function AdminLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-5">
      <span className="sr-only">กำลังโหลดหน้า…</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="space-y-2">
          <div className={`${block} h-7 w-48`} />
          <div className={`${block} h-4 w-full max-w-md`} />
        </div>
        <div className={`${block} h-11 w-full max-w-2xl`} />
        <div className="grid grid-cols-2 divide-slate-200 rounded-lg border border-slate-200 xl:grid-cols-4 xl:divide-x">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-3 p-5">
              <div className={`${block} h-4 w-24`} />
              <div className={`${block} h-7 w-16`} />
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className={`${block} h-64`} />
          <div className={`${block} h-64`} />
        </div>
      </div>
    </div>
  );
}
