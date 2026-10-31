import Link from "next/link";
import { UserCog, ShieldCheck, KeyRound } from "lucide-react";
import { requireAdmin } from "../../require-admin";

export const dynamic = "force-dynamic";

export default async function AdminsRolesPage() {
  const session = await requireAdmin();

  const adminUsers = [
    {
      id: "admin-1",
      email: session.email,
      role: session.roles.includes("admin") ? "Administrator" : "Viewer",
      badge: session.roles.includes("admin") ? "bg-emerald-100 text-emerald-800" : "bg-cyan-100 text-cyan-800",
      status: "ACTIVE",
      lastActive: "กำลังใช้งาน (บัญชีของคุณ)",
      isCurrent: true
    },
    {
      id: "admin-2",
      email: "supervisor@bu.ac.th",
      role: "Administrator",
      badge: "bg-emerald-100 text-emerald-800",
      status: "ACTIVE",
      lastActive: "1 ชั่วโมงที่แล้ว",
      isCurrent: false
    },
    {
      id: "admin-3",
      email: "ta.intern@bu.ac.th",
      role: "Viewer (Read-only)",
      badge: "bg-slate-100 text-slate-700",
      status: "ACTIVE",
      lastActive: "เมื่อวานนี้",
      isCurrent: false
    }
  ];

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Admins & Roles</h1>
          <p className="mt-1 text-sm text-slate-600">จัดการบัญชีผู้ดูแลระบบ กำหนดสิทธิ์การเข้าถึง และการจัดการบทบาท (RBAC)</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/profile"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
            เปลี่ยนรหัสผ่านของฉัน
          </Link>
        </div>
      </div>

      {/* Roles Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Administrator</span>
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            สิทธิ์เต็มรูปแบบ: จัดการคลังความรู้ ตอบแชท อัปเดตตั๋วแจ้งปัญหา จัดการผู้ใช้งาน และเปลี่ยนการตั้งค่าระบบทั้งหมด
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Viewer</span>
            <UserCog className="h-5 w-5 text-slate-500" />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            สิทธิ์อ่านอย่างเดียว (Read-only): ดูสถิติ แดชบอร์ด รายการบันทึก Bot Runs และตั๋วแจ้งปัญหา โดยไม่สามารถแก้ไขข้อมูลได้
          </p>
        </div>
      </div>

      {/* Table of Admins */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-bu-ink">รายชื่อผู้ดูแลระบบ (3 บัญชี)</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500 font-semibold">
              <tr>
                <th className="px-6 py-3">อีเมลบัญชี</th>
                <th className="px-6 py-3">บทบาท (Role)</th>
                <th className="px-6 py-3">สถานะ</th>
                <th className="px-6 py-3">ใช้งานล่าสุด</th>
                <th className="px-6 py-3">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adminUsers.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{admin.email}</span>
                      {admin.isCurrent && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          คุณ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${admin.badge}`}>
                      {admin.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      ใช้งานได้
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{admin.lastActive}</td>
                  <td className="px-6 py-4">
                    {admin.isCurrent ? (
                      <Link href="/admin/profile" className="font-medium text-emerald-700 hover:underline">
                        เปลี่ยนรหัส
                      </Link>
                    ) : (
                      <span className="text-slate-400">แก้ไขสิทธิ์</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
