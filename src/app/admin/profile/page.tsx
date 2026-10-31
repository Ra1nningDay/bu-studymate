import { requireAdmin } from "../require-admin";
import { AdminPageHeader } from "../admin-page-header";

export const dynamic = "force-dynamic";

const notices: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "เปลี่ยนรหัสผ่านแล้ว ใช้รหัสใหม่ในการเข้าสู่ระบบครั้งถัดไป" },
  wrong_password: { ok: false, text: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
  too_short: { ok: false, text: "รหัสผ่านใหม่ต้องยาว 10 ถึง 1024 ตัวอักษร" },
  mismatch: { ok: false, text: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน" }
};

const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ password?: string | string[] }> }) {
  const session = await requireAdmin();
  const { password } = await searchParams;
  const notice = notices[(Array.isArray(password) ? password[0] : password) ?? ""];

  return (
    <main className="min-w-0">
      <AdminPageHeader
        title="Admin Profile"
        description="ข้อมูลบัญชีผู้ดูแลระบบและการเปลี่ยนรหัสผ่านเพื่อความปลอดภัย"
        border
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-bu-ink">Account</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-slate-500">Email</dt><dd className="mt-1 font-medium">{session.email}</dd></div>
            <div><dt className="text-slate-500">Roles</dt><dd className="mt-1 font-medium">{session.roles.join(", ")}</dd></div>
            <div><dt className="text-slate-500">Access</dt><dd className="mt-1">{session.roles.includes("admin") ? "อ่านและแก้ไขได้ทั้งหมด" : "อ่านอย่างเดียว การแก้ไขทุกอย่างจะถูกปฏิเสธ"}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-bu-ink">Change password</h2>
          {notice && <p role={notice.ok ? "status" : "alert"} className={`mt-4 rounded-md border px-3 py-2 text-sm ${notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
          <form action="/api/admin/auth/password" method="POST" className="mt-4 space-y-4">
            <label className="block text-sm font-medium">รหัสผ่านปัจจุบัน
              <input name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024} className={`mt-1 ${input}`} />
            </label>
            <label className="block text-sm font-medium">รหัสผ่านใหม่ (อย่างน้อย 10 ตัวอักษร)
              <input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={1024} className={`mt-1 ${input}`} />
            </label>
            <label className="block text-sm font-medium">ยืนยันรหัสผ่านใหม่
              <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={1024} className={`mt-1 ${input}`} />
            </label>
            <button className="rounded-md bg-bu-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">เปลี่ยนรหัสผ่าน</button>
            <p className="text-xs text-slate-500">การเปลี่ยนรหัสไม่ทำให้อุปกรณ์อื่นที่ล็อกอินอยู่ถูกออกจากระบบ (หมดอายุเองใน 8 ชั่วโมง)</p>
          </form>
        </section>
      </div>
    </main>
  );
}
