import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthService, adminCookieName } from "@/src/services/admin-auth.service";
import { studentAuthService } from "@/src/services/student-auth.service";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ login?: string; link?: string; student?: string }>;
}) {
  if (adminAuthService.isAuthenticated((await cookies()).get(adminCookieName)?.value)) {
    redirect("/admin");
  }

  const query = await searchParams;
  const failed = query.login === "failed";
  const studentFailed = query.student === "failed";
  const studentLink = studentAuthService.isValidLink(query.link) ? query.link : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b0e] p-4 sm:p-6 md:p-10 font-sans">
      {/* Subtle background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-900/15 blur-[120px]"
      />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0e141b]/95 p-3.5 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 md:gap-8">
          {/* Left panel: Poster Illustration */}
          <div className="relative aspect-[4/5] min-h-[360px] w-full overflow-hidden rounded-2xl border border-emerald-900/20 bg-[#eaf5ee] shadow-sm md:aspect-auto md:min-h-[480px]">
            <Image
              src="/studymate-login-hero.jpg"
              alt="StudyMate - BU LINE Chatbot เพื่อนคู่เรียน ของชาว BU"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 450px"
              className="object-cover object-center"
            />
          </div>

          {/* Right panel: Login form */}
          <div className="flex flex-col justify-center px-2 py-4 sm:px-6 md:py-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Welcome back
              </h1>
              <p className="text-xs text-slate-400 sm:text-sm">
                Sign in to your admin workspace
              </p>
            </div>

            {studentFailed && (
              <p role="alert" className="mt-6 rounded-xl border border-rose-900/60 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-300 sm:text-sm">
                ต้องใช้อีเมล @bumail.net และเปิดลิงก์จากแชท LINE อีกครั้ง
              </p>
            )}

            {studentLink && (
              <div className="mt-6 space-y-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
                <p className="text-xs text-slate-300 sm:text-sm">
                  นักศึกษา BU: เข้าสู่ระบบด้วยบัญชี Google @bumail.net เพื่อเชื่อมกับ LINE ของคุณ
                </p>
                <a
                  href={`/api/student/auth/google/start?t=${encodeURIComponent(studentLink)}`}
                  className="flex w-full items-center justify-center rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  Sign in with Google
                </a>
              </div>
            )}

            {adminAuthService.configured ? (
              <form action="/api/admin/auth/login" method="POST" className="mt-6 space-y-4 sm:mt-7">
                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-xs font-medium text-slate-300 sm:text-sm">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    defaultValue="admin"
                    required
                    maxLength={256}
                    placeholder="admin"
                    className="w-full rounded-xl border border-slate-700/80 bg-[#070b0f] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 shadow-inner outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-slate-300 sm:text-sm">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={1024}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700/80 bg-[#070b0f] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 shadow-inner outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {failed && (
                  <p role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-300 sm:text-sm">
                    ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid username or password)
                  </p>
                )}

                <button
                  type="submit"
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#0e141b] active:scale-[0.99]"
                >
                  <span>Sign in</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>

                <p className="pt-1 text-center text-xs text-slate-400">
                  Authorized administrators only
                </p>
              </form>
            ) : (
              <div className="mt-6 rounded-xl border border-amber-900/50 bg-amber-950/30 p-4 text-xs leading-6 text-amber-200 sm:text-sm">
                <p className="font-semibold text-amber-300">ADMIN_PASSWORD not configured</p>
                <p className="mt-1 text-slate-300">
                  ตั้งค่า ADMIN_PASSWORD ฝั่ง server ในไฟล์{" "}
                  <code className="rounded bg-black/40 px-1 py-0.5 text-amber-200">.env</code>{" "}
                  แล้วรีสตาร์ท server เพื่อเปิดใช้งานพื้นที่ผู้ดูแล
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
