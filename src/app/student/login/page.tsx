import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { studentAuthService, studentCookieName } from "@/src/services/student-auth.service";

export const dynamic = "force-dynamic";

export default async function StudentLoginPage({
  searchParams
}: {
  searchParams: Promise<{ link?: string; student?: string }>;
}) {
  const query = await searchParams;
  const failed = query.student === "failed";
  const link = studentAuthService.isValidLink(query.link) ? query.link : undefined;

  // A fresh LINE link wins over a leftover cookie, otherwise a deleted student could never re-verify.
  const session = studentAuthService.readSession((await cookies()).get(studentCookieName)?.value);
  if (!link && session && (await studentAuthService.isVerified(session.lineUserId))) {
    redirect("/student");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b0e] p-6 font-sans">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-[#0e141b]/95 p-8 text-center shadow-2xl">
        <Image
          src="/studymate-login-hero.jpg"
          alt="StudyMate - BU LINE Chatbot เพื่อนคู่เรียน ของชาว BU"
          width={240}
          height={300}
          priority
          className="mx-auto h-auto w-40 rounded-2xl"
        />
        <h1 className="text-2xl font-bold text-white">ยืนยันนักศึกษา BU</h1>

        {failed && (
          <p role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-300">
            ต้องใช้อีเมล @bumail.net และเปิดลิงก์จากแชท LINE อีกครั้ง
          </p>
        )}

        {link ? (
          <>
            <p className="text-sm text-slate-300">เข้าสู่ระบบด้วยบัญชี Google @bumail.net เพื่อเชื่อมกับ LINE ของคุณ</p>
            <a
              href={`/api/student/auth/google/start?t=${encodeURIComponent(link)}`}
              className="flex w-full items-center justify-center rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Sign in with Google
            </a>
          </>
        ) : (
          <p className="text-sm text-slate-300">
            ลิงก์ไม่ถูกต้องหรือหมดอายุ พิมพ์ &quot;ยืนยันนักศึกษา&quot; ในแชท LINE เพื่อรับลิงก์ใหม่ครับ
          </p>
        )}
      </div>
    </main>
  );
}
