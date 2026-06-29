import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f7fb] px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bu-purple">
            BU StudyMate
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-bu-ink">
            LINE chatbot MVP for Bangkok University students
          </h1>
          <p className="mt-4 text-slate-600">
            The LINE webhook is available at{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              /api/line/webhook
            </code>
            . Staff can manage support tickets from the admin dashboard.
          </p>
          <Link
            href="/admin/tickets"
            className="mt-6 inline-flex items-center rounded-md bg-bu-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3a0f70]"
          >
            Open tickets
          </Link>
        </div>
      </div>
    </main>
  );
}
