import Link from "next/link";

const navCards = [
  {
    href: "/chat",
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Web Chat",
    description: "Test the chatbot directly via the web UI without using LINE",
    accent: "bg-emerald-50 text-emerald-600",
    border: "hover:border-emerald-200 hover:shadow-emerald-500/5"
  },
  {
    href: "/admin/runs",
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Bot Runs",
    description: "Inspect bot execution logs, including latency and intent for each run",
    accent: "bg-cyan-50 text-bu-cyan",
    border: "hover:border-bu-cyan/30 hover:shadow-bu-cyan/5"
  },
  {
    href: "/admin/tickets",
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Tickets",
    description: "View and manage support tickets reported by students via LINE chatbot",
    accent: "bg-violet-50 text-bu-purple",
    border: "hover:border-bu-purple/30 hover:shadow-bu-purple/5"
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f7fb]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bu-purple">
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wide text-bu-ink">BU StudyMate</span>
          <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            MVP
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-6 pb-12 pt-10">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-bu-purple">
          Admin Dashboard
        </div>
        <h1 className="text-3xl font-bold text-bu-ink">
          Bangkok University LINE Chatbot
        </h1>
        <p className="mt-2 max-w-xl text-slate-500">
          Chatbot system for BU students — answer questions, search for the latest information, and receive facility issue reports.
        </p>

        {/* Webhook badge */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Webhook:</span>
          <code className="font-mono text-slate-700">/api/line/webhook</code>
        </div>

        {/* Nav cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {navCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.border}`}
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${card.accent}`}>
                {card.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-bu-ink">{card.label}</span>
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{card.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Pipeline info */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Bot Pipeline
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { label: "Agent Router", color: "bg-violet-100 text-violet-700" },
              { label: "Knowledge Base", color: "bg-sky-100 text-sky-700" },
              { label: "Fresh Info (PDF/HTML)", color: "bg-cyan-100 text-cyan-700" },
              { label: "Study Memory", color: "bg-indigo-100 text-indigo-700" },
              { label: "Ticket Flow", color: "bg-amber-100 text-amber-700" },
              { label: "General Chat", color: "bg-slate-100 text-slate-600" }
            ].map((step) => (
              <span
                key={step.label}
                className={`rounded-full px-2.5 py-1 font-medium ${step.color}`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
