"use client";

import Link from "next/link";
import Image from "next/image";
import logoBrand from "@/public/logo-brand.png";
import { Noto_Sans_Thai } from "next/font/google";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { AdminUserDropdown } from "./admin-user-dropdown";
import {
  PanelLeft,
  PanelLeftClose,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Activity,
  Coins,
  MessagesSquare,
  Ticket,
  Headphones,
  BookOpen,
  Sparkles,
  Wrench,
  GitBranch,
  LayoutGrid,
  Megaphone,
  Users,
  UserCog,
  Sliders,
  ScrollText
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  isMock?: boolean;
  exact?: boolean;
}

const adminFont = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap", variable: "--font-admin-sans" });

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "analytics",
    title: "Analytics",
    items: [
      { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
      { href: "/admin/runs", label: "Bot Runs & Latency", icon: Activity },
      { href: "/admin/analytics/costs", label: "Token & Cost Usage", icon: Coins }
    ]
  },
  {
    id: "conversations",
    title: "Conversations",
    items: [
      { href: "/admin/conversations", label: "Live Inbox (LINE + Web)", icon: MessagesSquare, isMock: true },
      { href: "/admin/tickets", label: "Support Tickets", icon: Ticket },
      { href: "/admin/conversations/handover", label: "Handover Queue", icon: Headphones, isMock: true }
    ]
  },
  {
    id: "agent",
    title: "Agent & knowledge",
    items: [
      { href: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
      { href: "/admin/agent/workflow", label: "Agent Workflow", icon: GitBranch },
      { href: "/admin/agent/prompts", label: "Prompts & Guardrails", icon: Sparkles, isMock: true },
      { href: "/admin/agent/tools", label: "Tools & Custom Functions", icon: Wrench, isMock: true }
    ]
  },
  {
    id: "line",
    title: "LINE & students",
    items: [
      { href: "/admin/line/rich-menu", label: "Rich Menu Studio", icon: LayoutGrid, isMock: true },
      { href: "/admin/line/broadcast", label: "Broadcast Messages", icon: Megaphone, isMock: true },
      { href: "/admin/users", label: "User Profiles & Tags", icon: Users }
    ]
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      { href: "/admin/settings/admins", label: "Admins & Roles", icon: UserCog, isMock: true },
      { href: "/admin/settings/integrations", label: "Integrations (LINE, LLM APIs)", icon: Sliders },
      { href: "/admin/settings/logs", label: "Webhook & Error Logs", icon: ScrollText, isMock: true }
    ]
  }
];

const sidebarSections = [
  ...navSections.map(section => ({ ...section, items: section.items.filter(item => !item.isMock) })),
  { id: "preview", title: "In development", items: navSections.flatMap(section => section.items.filter(item => item.isMock)) }
];

export function AdminShell({
  children,
  user
}: {
  children: ReactNode;
  user: { email: string; role: "admin" | "viewer" };
}) {
  const pathname = usePathname();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wideScreen, setWideScreen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    analytics: true,
    conversations: true,
    agent: true,
    line: true,
    settings: true
  });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWideScreen(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Restore sidebar preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("studymate_admin_sidebar_open");
      if (stored !== null) {
        setDesktopOpen(stored === "true");
      }
    } catch {
      // localStorage may fail in private mode
    }
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleDesktop = () => {
    setDesktopOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("studymate_admin_sidebar_open", String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      toggleDesktop();
    } else {
      setMobileOpen((prev) => !prev);
    }
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (window.innerWidth >= 1024) {
          toggleDesktop();
        } else {
          setMobileOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.href === "/admin/settings/admins" && pathname === "/admin/profile") return true;
    if (item.href === "/admin/conversations" && (pathname === "/admin/conversations" || pathname === "/admin/chat")) return true;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const report = pathname.startsWith("/admin/chat/report/") || pathname.startsWith("/admin/playground/report/");
  const chat = pathname === "/admin/chat";

  // Find active item for header breadcrumb
  const activeItem = navSections
    .flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })))
    .find(isItemActive);

  return (
    <div className={`${adminFont.variable} admin-workspace min-h-screen bg-[var(--admin-ground)] text-[var(--admin-ink)] ${report ? "print:bg-white" : ""}`}>
      <a
        href="#admin-content"
        className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        ข้ามไปยังเนื้อหา
      </a>

      {/* Left Sidebar */}
      <aside
        id="admin-sidebar"
        aria-label="เมนูหลักผู้ดูแลระบบ"
        className={`fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto bg-[var(--admin-ground)] px-3 py-5 transition-transform duration-200 ease-in-out motion-reduce:transition-none print:hidden ${
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        } ${desktopOpen ? "lg:visible lg:translate-x-0" : "lg:invisible lg:-translate-x-full"}`}
      >
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-between gap-2 px-2">
          <Link href="/admin" className="min-w-0 flex-1" onClick={() => setMobileOpen(false)}>
            <Image src={logoBrand} alt="StudyMate Admin Console" className="h-auto w-full max-w-44" sizes="176px" priority />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                toggleDesktop();
              } else {
                setMobileOpen(false);
              }
            }}
            aria-label="ยุบแถบด้านข้าง (Ctrl+B)"
            title="ยุบแถบด้านข้าง (Ctrl+B)"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200/60 focus-visible:outline-emerald-700 lg:min-h-8 lg:min-w-8"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav aria-label="Admin navigation" className="space-y-4">
          {sidebarSections.map((section) => {
            const hasActiveChild = section.items.some(isItemActive);
            const isOpen = openSections[section.id] ?? hasActiveChild;

            return (
              <div key={section.id} className="space-y-1">
                {/* Section Toggle Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  className="group flex min-h-11 w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-200/60 focus-visible:outline-emerald-700 lg:min-h-8"
                >
                  <div className="flex items-center gap-1.5">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                    )}
                    <span className={hasActiveChild ? "text-slate-900" : ""}>
                      {section.title}
                    </span>
                  </div>
                </button>

                {/* Section Child Items */}
                {isOpen && (
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`group flex min-h-11 items-center justify-between rounded-md px-3 py-2 text-sm transition focus-visible:outline-emerald-700 lg:min-h-9 ${
                            active
                              ? "bg-slate-200/70 font-medium text-slate-950"
                              : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-950"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon
                              strokeWidth={active ? 2 : 1.7}
                              className={`h-4 w-4 shrink-0 ${
                                active ? "text-slate-800" : "text-slate-500 group-hover:text-slate-800"
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.isMock && (
                            <span className="ml-1.5 shrink-0 rounded bg-slate-200/60 px-1.5 py-0.5 text-[11px] text-slate-600">
                              Mock
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="mt-8 px-2 pt-4 text-xs leading-5 text-slate-600">
          <div>StudyMate Admin Console</div>
          <div>Bangkok University • v2.4</div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="ปิดเมนู"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
        />
      )}

      {/* Main Content Area */}
      <div
        className={`min-w-0 transition-[padding-left] duration-200 ease-in-out motion-reduce:transition-none print:pl-0 ${
          desktopOpen ? "lg:pl-64" : "lg:pl-0"
        }`}
      >
        <header
          className={`flex ${
            chat ? "h-[54px]" : "min-h-16"
          } items-center justify-between gap-3 px-4 py-2 md:px-6 print:hidden`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSidebar}
              aria-expanded={wideScreen ? desktopOpen : mobileOpen}
              aria-controls="admin-sidebar"
              aria-label="สลับแถบด้านข้าง (Ctrl+B)"
              title="สลับแถบด้านข้าง (Ctrl+B)"
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200/60 focus-visible:outline-emerald-700 ${
                desktopOpen ? "lg:hidden" : "flex"
              }`}
            >
              <PanelLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="font-medium text-slate-600">{activeItem?.section ?? "Admin"}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate font-bold text-slate-900">{activeItem?.label ?? "Overview"}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <AdminUserDropdown user={user} />
          </div>
        </header>

        <div id="admin-content" className={report ? "p-4 md:p-7 print:p-0" : chat ? "" : "min-h-[calc(100dvh-64px)] bg-white p-4 md:mr-2 md:rounded-2xl md:border md:border-[var(--admin-border)] md:p-6"}>
          {children}
        </div>
      </div>
    </div>
  );
}
