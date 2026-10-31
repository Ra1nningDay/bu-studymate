"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Send, 
  Smartphone, 
  Globe, 
  Play, 
  Headphones, 
  ExternalLink 
} from "lucide-react";

interface MockChat {
  id: string;
  userId: string;
  userName: string;
  channel: "LINE" | "WEB";
  lastMessage: string;
  timestamp: string;
  status: "BOT" | "HANDOVER_REQUESTED" | "RESOLVED";
  intent: string;
  messages: Array<{
    role: "user" | "assistant" | "operator";
    content: string;
    time: string;
    metadata?: { intent?: string; latency?: number };
  }>;
}

const mockConversations: MockChat[] = [
  {
    id: "conv-1",
    userId: "Ua938fe7103...",
    userName: "Napasorn K. (Student)",
    channel: "LINE",
    lastMessage: "ขอวิธีทำเรื่องผ่อนผันค่าเทอมหน่อยค่ะ ต้องส่งเอกสารที่ไหน",
    timestamp: "2 นาทีที่แล้ว",
    status: "BOT",
    intent: "knowledge_rag",
    messages: [
      { role: "user", content: "สวัสดีค่ะ ขอสอบถามเรื่องทุนการศึกษาและผ่อนผันค่าเทอมค่ะ", time: "14:20" },
      { 
        role: "assistant", 
        content: "สวัสดีครับน้องนภัสสร สำหรับการผ่อนผันค่าเทอม สามารถยื่นคำร้องผ่านระบบ URSA Online หรือติดต่อแผนกการเงิน ตึก A3 ชั้น 2 ได้เลยครับ", 
        time: "14:20",
        metadata: { intent: "knowledge_rag", latency: 840 }
      },
      { role: "user", content: "ขอวิธีทำเรื่องผ่อนผันค่าเทอมหน่อยค่ะ ต้องส่งเอกสารที่ไหน", time: "14:22" }
    ]
  },
  {
    id: "conv-2",
    userId: "Ub842de9210...",
    userName: "Thanawat P.",
    channel: "LINE",
    lastMessage: "โปรเจกเตอร์ห้อง B4-301 เปิดไม่ติด มีกลิ่นไหม้ครับ",
    timestamp: "8 นาทีที่แล้ว",
    status: "HANDOVER_REQUESTED",
    intent: "ticket_flow",
    messages: [
      { role: "user", content: "โปรเจกเตอร์ห้อง B4-301 เปิดไม่ติด มีกลิ่นไหม้ครับ", time: "14:15" },
      { 
        role: "assistant", 
        content: "รับเรื่องแจ้งซ่อมอุปกรณ์เรียบร้อยครับ กำลังสร้างตั๋วงานด่วนให้เจ้าหน้าที่ดูแลโสตทัศนูปกรณ์เข้าตรวจสอบครับ Ticket #TK-8902", 
        time: "14:15",
        metadata: { intent: "ticket_flow", latency: 620 }
      },
      { role: "user", content: "อาจารย์จะเริ่มสอนแล้วครับ มีเจ้าหน้าที่มาดูให้ได้ไหมครับ", time: "14:18" }
    ]
  },
  {
    id: "conv-3",
    userId: "web-guest-4401",
    userName: "Web Visitor #4401",
    channel: "WEB",
    lastMessage: "สรุปเนื้อหาบทที่ 3 วิชา CS201 ให้หน่อย",
    timestamp: "25 นาทีที่แล้ว",
    status: "BOT",
    intent: "study_tutor",
    messages: [
      { role: "user", content: "สรุปเนื้อหาบทที่ 3 วิชา CS201 ให้หน่อย", time: "13:58" },
      { 
        role: "assistant", 
        content: "นี่คือสรุปเนื้อหา CS201 Data Structures: Binary Search Tree (BST) คุณสมบัติหลักคือ โหนดซ้ายมีค่าน้อยกว่าโหนดพ่อแม่ และโหนดขวามีค่ามากกว่า...", 
        time: "13:59",
        metadata: { intent: "study_tutor", latency: 1250 }
      }
    ]
  }
];

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string>(mockConversations[0].id);
  const [channelFilter, setChannelFilter] = useState<"ALL" | "LINE" | "WEB">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");

  const activeChat = mockConversations.find((c) => c.id === selectedId) || mockConversations[0];

  const filteredList = mockConversations.filter((c) => {
    if (channelFilter !== "ALL" && c.channel !== channelFilter) return false;
    if (searchQuery && !c.userName.toLowerCase().includes(searchQuery.toLowerCase()) && !c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <main className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Live Inbox (LINE + Web)</h1>
          <p className="mt-1 text-sm text-slate-600">กล่องข้อความรวมศูนย์ ติดตามบทสนทนาแบบเรียลไทม์ระหว่างนักศึกษากับ AI Agent</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/chat"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            <Play className="h-3.5 w-3.5" />
            เปิด Web Chat Playground
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Split Pane Inbox */}
      <div className="grid h-[calc(100vh-270px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-12">
        {/* Left Column: Conversation List */}
        <div className="border-r border-slate-200 md:col-span-4 lg:col-span-5 flex flex-col h-full bg-slate-50/50">
          {/* Search & Channel Tabs */}
          <div className="border-b border-slate-200 p-3 space-y-2 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาข้อความ หรือชื่อผู้ใช้..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="flex gap-1.5">
              {(["ALL", "LINE", "WEB"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setChannelFilter(tab)}
                  className={`flex-1 rounded-md py-1 text-center text-xs font-medium transition ${
                    channelFilter === tab ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab === "ALL" ? "ทั้งหมด" : tab === "LINE" ? "LINE OA" : "Web Widget"}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredList.map((chat) => {
              const active = chat.id === selectedId;
              return (
                <button
                  key={chat.id}
                  onClick={() => setSelectedId(chat.id)}
                  className={`w-full text-left p-3.5 transition flex gap-3 items-start ${
                    active ? "bg-emerald-50/80 border-l-4 border-emerald-600" : "hover:bg-slate-100/70"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                      {chat.channel === "LINE" ? <Smartphone className="h-4 w-4 text-emerald-600" /> : <Globe className="h-4 w-4 text-cyan-600" />}
                    </div>
                    {chat.status === "HANDOVER_REQUESTED" && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs font-semibold text-slate-900">{chat.userName}</span>
                      <span className="text-[10px] text-slate-400">{chat.timestamp}</span>
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">{chat.lastMessage}</p>

                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                        {chat.intent}
                      </span>
                      {chat.status === "HANDOVER_REQUESTED" ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          รอมนุษย์ตอบ
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          AI ตอบปกติ
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Chat Thread View */}
        <div className="md:col-span-8 lg:col-span-7 flex flex-col h-full bg-white">
          {/* Thread Header */}
          <div className="border-b border-slate-200 p-3.5 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold text-xs">
                {activeChat.channel === "LINE" ? "LINE" : "WEB"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{activeChat.userName}</h3>
                  <span className="text-[11px] font-mono text-slate-400">{activeChat.userId}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Intent: {activeChat.intent}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert("เข้าแทรกแซงการสนทนาเรียบร้อย (Human Takeover)")}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition"
              >
                <Headphones className="h-3.5 w-3.5" />
                รับช่วงต่อ (Takeover)
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]">
            {activeChat.messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                  {m.role === "user" ? <span>ผู้ใช้ ({m.time})</span> : <span>StudyMate AI ({m.time})</span>}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "rounded-tl-xs bg-white text-slate-800 border border-slate-200"
                      : "rounded-tr-xs bg-emerald-700 text-white"
                  }`}
                >
                  <p>{m.content}</p>
                </div>
                {m.metadata && (
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 px-1">
                    <span>⚡ Latency: {m.metadata.latency}ms</span>
                    <span>•</span>
                    <span>Router: {m.metadata.intent}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-3 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="พิมพ์ข้อความตอบกลับในฐานะเจ้าหน้าที่..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && replyText.trim()) {
                    alert(`ส่งข้อความ: "${replyText}" ไปยังนักศึกษาแล้ว (Mock Sent)`);
                    setReplyText("");
                  }
                }}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
              <button
                onClick={() => {
                  if (replyText.trim()) {
                    alert(`ส่งข้อความ: "${replyText}" ไปยังนักศึกษาแล้ว (Mock Sent)`);
                    setReplyText("");
                  }
                }}
                className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
              >
                <Send className="h-3.5 w-3.5" />
                ส่ง
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
