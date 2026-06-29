import { listTickets, ticketStatuses } from "@/lib/ticket";
import type { TicketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isAdminAllowed(searchParams: SearchParams) {
  if (!process.env.ADMIN_PASSWORD) {
    return true;
  }
  return asString(searchParams.password) === process.env.ADMIN_PASSWORD;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const classes: Record<TicketStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
    IN_PROGRESS: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200"
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[status]}`}
    >
      {status}
    </span>
  );
}

function LoginForm() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-6">
      <form
        method="GET"
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-bu-ink">BU StudyMate Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the admin password to view support tickets.
        </p>
        <label className="mt-5 block text-sm font-medium text-slate-700">
          Password
          <input
            name="password"
            type="password"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-bu-purple focus:ring-2 focus:ring-bu-purple/15"
            autoComplete="current-password"
          />
        </label>
        <button className="mt-5 w-full rounded-md bg-bu-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3a0f70]">
          Open dashboard
        </button>
      </form>
    </main>
  );
}

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-6">
      <div className="w-full max-w-2xl rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bu-purple">
          BU StudyMate
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-bu-ink">
          Admin dashboard needs database setup
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Add <code>DATABASE_URL</code> and <code>DIRECT_URL</code> in{" "}
          <code>.env.local</code>, run the database schema, then restart the dev
          server.
        </p>
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 font-mono text-xs text-amber-800">
          {message}
        </p>
      </div>
    </main>
  );
}

export default async function TicketsPage({ searchParams }: any) {
  const resolvedSearchParams = (await Promise.resolve(searchParams ?? {})) as SearchParams;
  if (!isAdminAllowed(resolvedSearchParams)) {
    return <LoginForm />;
  }

  let tickets;
  try {
    tickets = await listTickets();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tickets";
    return <SetupNotice message={message} />;
  }

  const password = asString(resolvedSearchParams.password);

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bu-purple">
              BU StudyMate
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-bu-ink">
              Support tickets
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              View LINE-reported classroom and facility issues, then update their status.
            </p>
          </div>
          <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">
            {tickets.length} active records
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ticket</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Room</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">LINE User</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={8}>
                      No tickets yet.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.id} className="align-top hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-bu-purple">
                        {ticket.ticket_code}
                      </td>
                      <td className="px-4 py-4 text-slate-700">{ticket.location ?? "-"}</td>
                      <td className="px-4 py-4 text-slate-700">{ticket.room ?? "-"}</td>
                      <td className="min-w-72 px-4 py-4 text-slate-700">
                        {ticket.description}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="max-w-48 truncate px-4 py-4 font-mono text-xs text-slate-500">
                        {ticket.line_user_id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                        {new Intl.DateTimeFormat("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Bangkok"
                        }).format(new Date(ticket.created_at))}
                      </td>
                      <td className="px-4 py-4">
                        <form
                          action={`/api/admin/tickets/${ticket.id}/status`}
                          method="POST"
                          className="flex min-w-56 items-center gap-2"
                        >
                          {password ? (
                            <input type="hidden" name="password" value={password} />
                          ) : null}
                          <select
                            name="status"
                            defaultValue={ticket.status}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-bu-purple focus:ring-2 focus:ring-bu-purple/15"
                          >
                            {ticketStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-md bg-bu-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-bu-purple">
                            Update
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
