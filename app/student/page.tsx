import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { studentAuthService, studentCookieName } from "@/src/services/student-auth.service";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const session = studentAuthService.readSession((await cookies()).get(studentCookieName)?.value);
  if (!session) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b0e] p-6 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0e141b]/95 p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold text-white">เชื่อมบัญชีสำเร็จ</h1>
        <p className="mt-3 text-sm text-slate-300">
          LINE ของคุณเชื่อมกับ <span className="font-semibold text-emerald-400">{session.email}</span> แล้ว
        </p>
        <p className="mt-2 text-xs text-slate-400">กลับไปที่แชท LINE เพื่อใช้งานต่อได้เลยครับ</p>
      </div>
    </main>
  );
}
