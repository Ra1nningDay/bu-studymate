import { Key, CheckCircle2, XCircle, Shield, Server, Bot, MessageCircle } from "lucide-react";
import { env } from "@/src/config/env";
import { requireAdmin } from "../../require-admin";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireAdmin();

  const isLineConfigured = Boolean(env.LINE_CHANNEL_SECRET && env.LINE_CHANNEL_ACCESS_TOKEN);
  const isOpenAiConfigured = Boolean(env.OPENAI_API_KEY);
  const isOpenRouterConfigured = Boolean(env.OPENROUTER_API_KEY);
  const isGoogleOidcConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const isDbConfigured = Boolean(env.DATABASE_URL);

  const integrations = [
    {
      id: "line",
      name: "LINE Messaging API",
      category: "Messaging Channel",
      icon: MessageCircle,
      status: isLineConfigured ? "CONNECTED" : "NOT_CONFIGURED",
      desc: "เชื่อมต่อ LINE Official Account สำหรับรับส่งข้อความผ่าน Webhook และจัดการ Rich Menu",
      details: [
        { label: "Webhook Endpoint", value: "/api/line" },
        { label: "Channel Secret", value: isLineConfigured ? "••••••••••••••••••••••••" : "Not Set" },
        { label: "Channel Access Token", value: isLineConfigured ? "••••••••••••••••••••••••" : "Not Set" }
      ]
    },
    {
      id: "openai",
      name: "OpenAI API",
      category: "LLM & Embeddings",
      icon: Bot,
      status: isOpenAiConfigured ? "CONNECTED" : "NOT_CONFIGURED",
      desc: "ประมวลผลข้อความด้วย gpt-4o-mini และสร้างเวกเตอร์ด้วย text-embedding-3-small",
      details: [
        { label: "Default Model", value: env.OPENAI_MODEL },
        { label: "Router Model", value: env.OPENAI_AGENT_ROUTER_MODEL },
        { label: "API Key", value: isOpenAiConfigured ? "sk-••••••••••••••••••••" : "Not Set" }
      ]
    },
    {
      id: "openrouter",
      name: "OpenRouter / Gemini API",
      category: "Fallback LLM Provider",
      icon: Key,
      status: isOpenRouterConfigured ? "CONNECTED" : "OPTIONAL",
      desc: "โมเดลสำรองเมื่อ OpenAI มีปัญหา หรือสำหรับการทดสอบประสิทธิภาพทางเลือก",
      details: [
        { label: "Status", value: isOpenRouterConfigured ? "Configured" : "Not configured (Optional)" }
      ]
    },
    {
      id: "database",
      name: "Supabase PostgreSQL & pgvector",
      category: "Database & Vector Store",
      icon: Server,
      status: isDbConfigured ? "CONNECTED" : "NOT_CONFIGURED",
      desc: "จัดเก็บตารางระบบ ประวัติการสนทนา ตั๋วแจ้งปัญหา และ Vector Embeddings (1536 dim)",
      details: [
        { label: "Provider", value: "Supabase PostgreSQL" },
        { label: "Vector Extension", value: "pgvector active" },
        { label: "Direct URL", value: env.DIRECT_URL ? "Configured (Pooler bypassed)" : "Standard Pooler" }
      ]
    },
    {
      id: "google-oidc",
      name: "Google Workspace OIDC (@bumail.net)",
      category: "Student Authentication",
      icon: Shield,
      status: isGoogleOidcConfigured ? "CONNECTED" : "OPTIONAL",
      desc: "ระบบยืนยันตัวตนนักศึกษามหาวิทยาลัยกรุงเทพด้วย Google OAuth และจำกัดโดเมน",
      details: [
        { label: "Domain Filter", value: `@${env.STUDENT_EMAIL_DOMAIN}` },
        { label: "Client ID", value: isGoogleOidcConfigured ? "Configured" : "Not Set" }
      ]
    }
  ];

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Integrations (LINE, LLM APIs)</h1>
          <p className="mt-1 text-sm text-slate-600">สถานะการเชื่อมต่อบริการภายนอก คีย์ API และ Webhook ของระบบ StudyMate</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            สภาพแวดล้อม: {env.NODE_ENV}
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {integrations.map((item) => {
          const Icon = item.icon;
          const isConnected = item.status === "CONNECTED";
          return (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{item.name}</h2>
                    <span className="text-[11px] font-medium text-slate-400">{item.category}</span>
                  </div>
                </div>

                {isConnected ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" />
                    เชื่อมต่อแล้ว
                  </span>
                ) : item.status === "OPTIONAL" ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    ทางเลือกเสริม
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                    <XCircle className="h-3 w-3" />
                    ยังไม่ได้ตั้งค่า
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>

              <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-2 border border-slate-100">
                {item.details.map((d, i) => (
                  <div key={i} className="flex justify-between font-mono text-[11px]">
                    <span className="text-slate-500">{d.label}:</span>
                    <span className="font-semibold text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
