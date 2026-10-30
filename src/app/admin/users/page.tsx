import { requireAdmin } from "../require-admin";
import { DeleteStudentButton } from "./delete-student-button";
import { studentAccountRepository, type StudentRow } from "@/src/repositories/student-account.repository";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q) ?? "";

  let students: StudentRow[] = [];
  let error: string | null = null;
  try {
    students = await studentAccountRepository.list({ q: query });
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load students";
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">BU StudyMate</p>
          <h1 className="mt-2 text-3xl font-semibold text-bu-ink">Users</h1>
          <p className="mt-2 text-sm text-slate-600">Students who verified a bumail.net account and linked LINE.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form method="GET" className="flex gap-2">
            <input name="q" defaultValue={query} placeholder="Search email" aria-label="Search email" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" />
            <button className="rounded-md bg-bu-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">Search</button>
          </form>
          <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">{students.length} students</div>
        </div>
      </header>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">LINE User</th>
                <th className="px-4 py-3 font-semibold">Verified</th>
                <th className="px-4 py-3 font-semibold">Runs</th>
                <th className="px-4 py-3 font-semibold">Tickets</th>
                <th className="px-4 py-3 font-semibold">Last active</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {error || students.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>{error ?? "No students."}</td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.lineUserId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-4 font-medium text-slate-800">{s.email}</td>
                    <td className="max-w-48 truncate px-4 py-4 font-mono text-xs text-slate-500">{s.lineUserId}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{dateTime.format(s.verifiedAt)}</td>
                    <td className="px-4 py-4 text-slate-700">{s.runs}</td>
                    <td className="px-4 py-4 text-slate-700">{s.tickets}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{s.lastActiveAt ? dateTime.format(s.lastActiveAt) : "-"}</td>
                    <td className="px-4 py-4"><DeleteStudentButton lineUserId={s.lineUserId} email={s.email} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
