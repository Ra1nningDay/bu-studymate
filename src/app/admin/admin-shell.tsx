"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { House, MessageCircle, Play, ClipboardList, Menu, BookOpen, Users } from "lucide-react";

const navigation = [
  { href: "/admin", label: "Overview", icon: House },
  { href: "/admin/chat", label: "Web Chat", icon: MessageCircle },
  { href: "/admin/runs", label: "Bot Runs", icon: Play },
  { href: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/tickets", label: "Tickets", icon: ClipboardList }
];

export function AdminShell({ children, user }: { children: ReactNode; user: { email: string; role: "admin" | "viewer" } }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const report = pathname.startsWith("/admin/chat/report/") || pathname.startsWith("/admin/playground/report/");
  const chat = pathname === "/admin/chat";
  return (
    <div className={`admin-workspace min-h-screen bg-[#f4fbf8] text-[#101b36] ${report ? "print:bg-white" : ""}`}>
      <a href="#admin-content" className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">ข้ามไปยังเนื้อหา</a>
      <aside className={`${menuOpen ? "block" : "hidden"} fixed inset-y-0 left-0 z-40 w-60 overflow-y-auto border-r border-emerald-100 bg-white/95 px-4 py-6 lg:block print:hidden`}>
        <Link href="/admin" className="mb-10 block px-3" onClick={() => setMenuOpen(false)}>
          <span className="block text-3xl font-extrabold tracking-tight text-emerald-700">StudyMate<span className="text-emerald-400">.</span></span>
          <span className="mt-1 block text-xs font-semibold tracking-wide text-emerald-700">BU LINE Chatbot</span>
        </Link>
        <nav aria-label="Admin navigation" className="space-y-2">
          {navigation.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition focus-visible:outline-emerald-600 ${active ? "bg-emerald-100/70 text-emerald-800" : "text-slate-600 hover:bg-emerald-50"}`}>
              <Icon aria-hidden="true" strokeWidth={1.7} className="h-5 w-5 shrink-0" />{item.label}
            </Link>;
          })}
        </nav>
        <div className="mt-12 border-t border-emerald-100 px-3 pt-5 text-xs leading-6 text-slate-500">พื้นที่ผู้ดูแลระบบ<br />ข้อมูลจากฐานข้อมูลที่ตั้งค่าไว้</div>
      </aside>
      {menuOpen && <button aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} className="fixed inset-y-0 left-60 right-0 z-30 bg-slate-950/30 lg:hidden" />}
      <div className="min-w-0 lg:pl-60 print:pl-0">
        <header className={`flex ${chat ? "h-[54px]" : "min-h-16"} items-center justify-between gap-3 border-b border-emerald-100 bg-white px-4 py-3 md:px-6 print:hidden`}>
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="เปิดเมนูผู้ดูแล" className="rounded-lg border border-slate-200 p-2 lg:hidden"><Menu aria-hidden="true" className="h-4 w-4" /></button>
            <span className="truncate text-sm font-semibold">Bangkok University LINE Chatbot</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/admin/profile" aria-label="โปรไฟล์และเปลี่ยนรหัสผ่าน" className="hidden items-center gap-2 rounded-lg px-2 py-1 hover:bg-emerald-50 focus-visible:outline-emerald-600 sm:flex"><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#101b36] text-xs font-semibold uppercase text-white">{user.email[0]}</span><span className="min-w-0 text-xs"><span className="block max-w-[14rem] truncate font-semibold">{user.email}</span><span className="text-slate-500">{user.role === "admin" ? "Administrator" : "Viewer (read-only)"}</span></span></Link>
            <form action="/api/admin/auth/logout" method="POST"><button className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-emerald-50 focus-visible:outline-emerald-600">ออกจากระบบ</button></form>
          </div>
        </header>
        <div id="admin-content" className={report ? "p-4 md:p-7 print:p-0" : chat ? "" : "p-4 md:p-7"}>{children}</div>
      </div>
    </div>
  );
}
