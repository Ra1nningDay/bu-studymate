"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, ChevronsDown, CheckCheck, FilePlus2, FileText, History, MessageCircle, MoreVertical, PanelLeftOpen, PanelRightOpen, RefreshCw, Search, Send, X } from "lucide-react";
import { PlaygroundSessionIdSchema, type PlaygroundConversation, type PlaygroundMessage, type PlaygroundSession } from "@/src/dtos/playground.dto";
import { RunTrace } from "./run-trace";
import { ChatAvatar, ChatSources } from "./chat-ui";

const storageKey = "studymate-playground-session";
const api = "/api/admin/playground";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium transition hover:bg-emerald-50 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

function newConversation(): PlaygroundConversation {
  return { sessionId: `playground-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), state: "IDLE", messages: [], runs: [] };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok) throw new Error(data.error ?? "ไม่สามารถเชื่อมต่อ Playground ได้");
  return data as T;
}

export function Playground() {
  const [conversation, setConversation] = useState<PlaygroundConversation | null>(null);
  const [sessions, setSessions] = useState<PlaygroundSession[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [traceOpen, setTraceOpen] = useState(true);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function initialize() {
      let initial = newConversation();
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved && PlaygroundSessionIdSchema.safeParse(saved).success) {
          initial = { ...initial, sessionId: saved };
          const response = await fetch(`${api}/sessions/${encodeURIComponent(saved)}`, { cache: "no-store" });
          if (response.status === 401) { window.location.assign("/login"); return; }
          if (response.ok) initial = (await response.json()).conversation;
          else if (response.status === 404) initial = newConversation();
          else throw new Error("ไม่สามารถเปิด session เดิมได้ กรุณาตรวจสอบฐานข้อมูล");
        }
        const data = await request<{ sessions: PlaygroundSession[] }>(`${api}/sessions`);
        if (active) setSessions(data.sessions);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (active) {
          setConversation(initial);
          setSelectedRunId(initial.runs.at(-1)?.id ?? null);
          sessionStorage.setItem(storageKey, initial.sessionId);
          setBusy(false);
        }
      }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [conversation?.messages.length, sending]);

  async function loadSessions() {
    const data = await request<{ sessions: PlaygroundSession[] }>(`${api}/sessions`);
    setSessions(data.sessions);
  }

  async function readSession(sessionId: string) {
    const data = await request<{ conversation: PlaygroundConversation }>(`${api}/sessions/${encodeURIComponent(sessionId)}`);
    setConversation(data.conversation);
    return data.conversation;
  }

  async function openSession(sessionId: string) {
    setBusy(true);
    setError(null);
    try {
      const loaded = await readSession(sessionId);
      sessionStorage.setItem(storageKey, sessionId);
      setSelectedRunId(loaded.runs.at(-1)?.id ?? null);
      setInput("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เปิด session ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  function startNew() {
    const next = newConversation();
    setConversation(next);
    sessionStorage.setItem(storageKey, next.sessionId);
    setSelectedRunId(null);
    setInput("");
    setError(null);
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      if (conversation) {
        const response = await fetch(`${api}/sessions/${conversation.sessionId}`, { cache: "no-store" });
        if (response.status === 401) { window.location.assign("/login"); return; }
        if (response.ok) {
          const data = await response.json();
          setConversation(data.conversation);
          setSelectedRunId((current) => current ?? data.conversation.runs.at(-1)?.id ?? null);
        } else if (response.status !== 404) throw new Error("อ่านบทสนทนาไม่สำเร็จ");
      }
      await loadSessions();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const messageText = input.trim();
    if (!conversation || busy || !messageText) return;

    const optimisticMessage: PlaygroundMessage = {
      id: `optimistic-${crypto.randomUUID()}`,
      role: "user",
      text: messageText,
      createdAt: new Date().toISOString(),
      sources: []
    };

    setBusy(true);
    setSending(true);
    setError(null);
    setInput("");
    setConversation((current) => current ? {
      ...current,
      messages: [...current.messages, optimisticMessage]
    } : null);

    let sent = false;
    try {
      const result = await request<{ runId: string; reply: string }>(`${api}/message`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: conversation.sessionId, message: messageText })
      });
      sent = true;

      const optimisticReply: PlaygroundMessage = {
        id: `reply-${crypto.randomUUID()}`,
        role: "assistant",
        text: result.reply,
        createdAt: new Date().toISOString(),
        sources: []
      };

      setConversation((current) => current ? {
        ...current,
        messages: [...current.messages, optimisticReply]
      } : null);
      setSelectedRunId(result.runId);
      setBusy(false);
      setSending(false);

      void (async () => {
        try {
          await readSession(conversation.sessionId);
          await loadSessions();
        } catch { /* Background sync */ }
      })();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "ส่งข้อความไม่สำเร็จ";
      if (!sent) {
        setInput(messageText);
        setConversation((current) => current ? {
          ...current,
          messages: current.messages.filter((msg) => msg.id !== optimisticMessage.id)
        } : null);
      }
      setError(message);
    } finally {
      if (!sent) {
        setBusy(false);
        setSending(false);
      }
    }
  }

  const selectedRun = conversation?.runs.find((run) => run.id === selectedRunId);
  const title = conversation?.messages.find((message) => message.role === "user")?.text ?? "บทสนทนาใหม่";
  const visibleSessions = sessions.filter((session) => `${session.sessionId} ${formatDate(session.createdAt)} ${session.state} ${session.sessionId === conversation?.sessionId ? title : ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  const sessionGroups: { day: string; label: string; sessions: PlaygroundSession[] }[] = [];
  for (const session of visibleSessions) {
    const day = formatDay(session.createdAt);
    let group = sessionGroups.find((g) => g.day === day);
    if (!group) {
      const isToday = day === formatDay(new Date().toISOString());
      group = { day, label: isToday ? "วันนี้" : day, sessions: [] };
      sessionGroups.push(group);
    }
    group.sessions.push(session);
  }

  function toggleDay(day: string) {
    setCollapsedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  }

  return (
    <main className={`chat-workspace grid min-w-0 ${traceOpen ? "xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_394px]" : "grid-cols-1"}`}>
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-4 md:px-7">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">BU StudyMate / Test workspace</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight">Web Chat</h1>
            <p className="mt-0.5 text-xs text-slate-500">ทดสอบการสนทนากับ AI ของ StudyMate และตรวจสอบคำตอบ</p>
          </div>
          <div className="flex items-center gap-2">
            {conversation && (conversation.messages.length > 0 || conversation.runs.length > 0) && <a href={`/admin/chat/report/${conversation.sessionId}`} target="_blank" rel="noopener" className={button}><FileText aria-hidden="true" className="h-4 w-4" />รายงาน</a>}
            <details className="relative">
              <summary aria-label="ตัวเลือกบทสนทนา" className={`${button} cursor-pointer list-none px-2.5`}><MoreVertical aria-hidden="true" className="h-5 w-5" /></summary>
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"><button onClick={refresh} disabled={busy} className={`${button} w-full border-0`}><RefreshCw aria-hidden="true" className="h-4 w-4" />โหลดข้อมูลใหม่</button></div>
            </details>
          </div>
        </header>
        {error && <p role="alert" className="mx-3 mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div className={`mx-3 mb-3 grid min-h-0 grid-cols-1 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white ${historyOpen ? "md:grid-cols-[228px_minmax(0,1fr)] 2xl:grid-cols-[276px_minmax(0,1fr)]" : ""}`}>
          {historyOpen && <aside aria-label="ประวัติการสนทนา" className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-4 py-4"><h2 className="text-sm font-semibold">ประวัติการสนทนา</h2><button onClick={() => setHistoryOpen(false)} aria-label="ซ่อนประวัติการสนทนา" className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-emerald-700"><X aria-hidden="true" className="h-4 w-4" /></button></div>
            <label className="relative mx-4 mb-2.5"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="ค้นหาบทสนทนา" placeholder="ค้นหาบทสนทนา…" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs focus:outline-emerald-700" /></label>
            <div className="mx-4 mb-3">
              <button onClick={startNew} disabled={busy} className={`${button} w-full`}><FilePlus2 aria-hidden="true" className="h-4 w-4" />เริ่มบทสนทนาใหม่</button>
            </div>
            <div className="max-h-60 flex-1 overflow-y-auto px-2 md:max-h-none">
              {sessionGroups.map((group) => {
                const isCollapsed = !!collapsedDays[group.day];
                return <div key={group.day} className="mb-1">
                  <button type="button" onClick={() => toggleDay(group.day)} aria-expanded={!isCollapsed} className="flex w-full items-center gap-1.5 px-2 pb-1.5 pt-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800 focus-visible:outline-emerald-700">
                    {isCollapsed ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                    <span>{group.label}</span>
                    <span className="ml-auto text-[11px] font-normal text-slate-400">{group.sessions.length}</span>
                  </button>
                  {!isCollapsed && group.sessions.map((session) => {
                    const active = session.sessionId === conversation?.sessionId;
                    return <button key={session.sessionId} onClick={() => openSession(session.sessionId)} disabled={busy} aria-pressed={active} className={`mb-1 w-full min-w-0 rounded-lg border-l-2 px-4 py-3 text-left focus-visible:outline-emerald-700 disabled:opacity-50 ${active ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-transparent hover:bg-slate-50"}`}>
                      <span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{active ? title : `บทสนทนา · ${session.sessionId.slice(-8)}`}</span><time className="shrink-0 text-[11px] text-slate-500">{formatTime(session.createdAt)}</time></span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{active ? conversation?.messages.at(-1)?.text ?? session.state : `เริ่ม ${formatDate(session.createdAt)} · ${session.state}`}</span>
                    </button>;
                  })}
                </div>;
              })}
              {!visibleSessions.length && <p role="status" className="px-3 py-6 text-xs leading-6 text-slate-500">{query ? "ไม่พบบทสนทนาที่ตรงกับคำค้น" : "ประวัติจะแสดงหลังส่งข้อความแรก"}</p>}
            </div>
            <p className="m-4 flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-2.5 text-[11px] text-slate-500"><History aria-hidden="true" className="h-3.5 w-3.5" />ล่าสุดสูงสุด 50 บทสนทนา</p>
          </aside>}
          <section aria-label="บทสนทนา" className="flex min-h-0 min-w-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                {!historyOpen && <button onClick={() => setHistoryOpen(true)} aria-label="แสดงประวัติการสนทนา" className={`${button} px-2`}><PanelLeftOpen aria-hidden="true" className="h-4 w-4" /></button>}
                <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">{conversation ? `Started ${formatDate(conversation.createdAt)} · ${conversation.messages.length} messages` : "กำลังโหลด…"}</p></div>
              </div>
              <div className="flex shrink-0 gap-1">
                {!traceOpen && <button onClick={() => setTraceOpen(true)} aria-label="แสดง Execution Trace" className={`${button} px-2`}><PanelRightOpen aria-hidden="true" className="h-4 w-4" /></button>}
              </div>
            </div>
            <div role="log" aria-label="ข้อความสนทนา" aria-busy={busy} className="chat-messages min-h-[300px] flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-5">
              {!conversation?.messages.length && <div className="flex h-full min-h-72 flex-col items-center justify-center text-center"><span className="mb-4 rounded-2xl bg-emerald-50 p-4 text-emerald-700"><MessageCircle aria-hidden="true" className="h-7 w-7" /></span><p className="text-lg font-semibold">{busy ? "กำลังโหลดบทสนทนา…" : "เริ่มทดสอบได้เลย"}</p><p className="mt-2 max-w-xs text-xs leading-6 text-slate-500">ถามข้อมูล BU, บทเรียน หรือแจ้งปัญหา<br />เลือกคำตอบเพื่อดู Execution Trace</p></div>}
              {conversation?.messages.map((message, index) => {
                const run = conversation.runs.find((item) => item.assistantMessageId === message.id);
                const user = message.role === "user";
                return <Fragment key={message.id}>
                  {(index === 0 || formatDay(message.createdAt) !== formatDay(conversation.messages[index - 1].createdAt)) && <div className="flex justify-center"><time className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">{formatDay(message.createdAt) === formatDay(new Date().toISOString()) ? "วันนี้" : formatDay(message.createdAt)}</time></div>}
                  <div className={`flex items-start gap-3 ${user ? "justify-end" : "justify-start"}`}>
                    {!user && <ChatAvatar />}
                    <div className={`min-w-0 ${user ? "max-w-[88%]" : "max-w-[calc(100%_-_52px)]"}`}>
                      {run ? <button onClick={() => { setSelectedRunId(run.id); setTraceOpen(true); }} aria-label={`ดู trace คำตอบ ${index + 1}`} aria-pressed={run.id === selectedRunId} className="block w-full rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 text-left text-sm leading-6 ring-1 ring-transparent transition hover:ring-emerald-200 focus-visible:outline-emerald-700"><span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</span><time className="mt-1 block text-right text-[11px] text-slate-500">{formatTime(message.createdAt)}</time></button>
                        : <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${user ? "rounded-tr-sm bg-emerald-100/65" : "rounded-tl-sm bg-slate-50"}`}><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p><span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-500"><time>{formatTime(message.createdAt)}</time>{user && <CheckCheck aria-hidden="true" className="h-4 w-4 text-emerald-700" />}</span></div>}
                      {!!message.sources.length && <div className="mt-1 rounded-xl border border-slate-100 p-3"><p className="mb-2 flex items-center gap-2 text-xs font-semibold"><FileText aria-hidden="true" className="h-3.5 w-3.5" />แหล่งข้อมูลที่ใช้</p><ChatSources sources={message.sources} /></div>}
                    </div>
                  </div>
                </Fragment>;
              })}
              {conversation?.runs.filter((run) => !run.assistantMessageId).map((run) => <button key={run.id} onClick={() => { setSelectedRunId(run.id); setTraceOpen(true); }} aria-pressed={run.id === selectedRunId} className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">เทิร์น {run.status} · {run.errorCode ?? "ยังไม่มีคำตอบ"} · ดู trace →</button>)}
              {sending && <div role="status" className="flex items-center gap-3"><ChatAvatar /><span className="flex gap-1 rounded-2xl bg-slate-50 px-4 py-3"><span className="h-2 w-2 rounded-full bg-slate-300 motion-safe:animate-pulse" /><span className="h-2 w-2 rounded-full bg-slate-300 motion-safe:animate-pulse" /><span className="h-2 w-2 rounded-full bg-slate-300 motion-safe:animate-pulse" /><span className="sr-only">StudyMate กำลังตอบ…</span></span></div>}
              <div ref={endRef} />
            </div>
            <div className="border-t border-slate-100 p-4">
              <form id="chat-compose" onSubmit={send}><label htmlFor="playground-message" className="sr-only">ข้อความทดสอบ</label><textarea id="playground-message" value={input} onChange={(event) => setInput(event.target.value)} maxLength={10000} rows={2} disabled={busy} placeholder="พิมพ์ข้อความ…" className="block w-full resize-y rounded-lg border border-slate-200 p-3 text-sm focus:outline-emerald-700 disabled:bg-slate-50" /></form>
              <div className="mt-2.5 flex items-center justify-end">
                <button form="chat-compose" disabled={busy || !conversation || !input.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"><Send aria-hidden="true" className="h-4 w-4" />{sending ? "กำลังส่ง…" : "ส่งข้อความ"}</button>
              </div>
            </div>
          </section>
        </div>
      </div>
      {traceOpen && <aside aria-label="Execution Trace" className="flex min-h-0 min-w-0 flex-col border-l border-slate-200 bg-white xl:rounded-tl-xl">
        <div className="flex items-center justify-between px-5 pb-4 pt-6"><h2 className="text-lg font-semibold tracking-tight">Execution Trace</h2><button onClick={() => setTraceOpen(false)} aria-label="ปิด Execution Trace" className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-emerald-700"><X aria-hidden="true" className="h-5 w-5" /></button></div>
        {selectedRun && conversation ? <RunTrace key={selectedRun.id} run={selectedRun} conversation={conversation} interactive /> : <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center"><span className="mb-4 rounded-full bg-emerald-50 p-4 text-emerald-700"><ChevronsDown aria-hidden="true" className="h-6 w-6" /></span><p className="text-sm font-medium">ยังไม่ได้เลือกคำตอบ</p><p className="mt-2 text-xs leading-6 text-slate-500">ส่งข้อความ แล้วเลือกคำตอบ<br />เพื่อตรวจสอบเส้นทางและแหล่งข้อมูล</p></div>}
      </aside>}
    </main>
  );
}
