"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, FileText, Plus, RefreshCw, Search, AlertTriangle, Clock3, Play, X, ChevronLeft, ChevronRight, PencilLine, Trash2 } from "lucide-react";
import type { KnowledgeAdminList } from "@/src/services/knowledge-admin.service";
import type { KnowledgeFilters } from "@/src/dtos/knowledge-admin.dto";

type Item = KnowledgeAdminList["items"][number];
type Draft = {
  title: string; category: string; content: string; keywords: string; sourceUrl: string;
  sourceHash: string; verifiedBy: string; verifiedAt: string; reviewAfter: string;
  validFrom: string; validUntil: string;
};
const fieldClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50";
const buttonClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-emerald-50 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const defaultFilters: KnowledgeFilters = { category: "", status: "all", source: "all", limit: 10 };
const detailTabs = ["ข้อมูลทั่วไป", "เนื้อหา", "Chunks", "การใช้งาน"] as const;
type DetailTab = typeof detailTabs[number];
type Chunk = { id: string; ordinal: number; content: string; embeddingModel: string };

function sourceName(item: Item) {
  try { return new URL(item.sourceUrl ?? item.source ?? "").hostname || "แหล่งข้อมูลเดิม"; }
  catch { return item.sourceUrl || item.source ? "แหล่งข้อมูลเดิม" : "ไม่ระบุ"; }
}

function StatusBadge({ item }: { item: Item }) {
  const ready = item.availability === "พร้อมใช้ใน RAG";
  const unapproved = item.availability === "ยังไม่ผ่านการตรวจทาน";
  return <span title={item.availability} className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${ready ? "bg-emerald-50 text-emerald-700" : unapproved ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-700"}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /><span>{ready ? "พร้อมใช้งาน" : unapproved ? "รอตรวจทาน" : "ต้องตรวจสอบ"}</span></span>;
}

function thaiDateInput(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(value)).replace(" ", "T");
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "—";
}

function sourceLink(value: string | null) {
  try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

function draftFor(item?: Item): Draft {
  return { title: item?.title ?? "", category: item?.category ?? "", content: item?.content ?? "",
    keywords: item?.keywords.join(", ") ?? "", sourceUrl: item?.sourceUrl ?? "",
    sourceHash: item?.sourceHash ?? "", verifiedBy: item?.verifiedBy ?? "",
    verifiedAt: thaiDateInput(new Date().toISOString()), reviewAfter: thaiDateInput(item?.reviewAfter ?? null),
    validFrom: thaiDateInput(item?.validFrom ?? null), validUntil: thaiDateInput(item?.validUntil ?? null) };
}

async function requestJson(url: string, body?: unknown) {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.issues?.map((issue: { field: string; message: string }) => `${issue.field}: ${issue.message}`).join(" · ");
    throw new Error(response.status === 401 ? "session หมดอายุ กรุณาเข้าสู่ระบบใหม่" : [data.error, detail].filter(Boolean).join(" · ") || "ดำเนินการไม่สำเร็จ");
  }
  return data;
}

export function KnowledgeWorkspace({ initialData }: { initialData: KnowledgeAdminList }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [selected, setSelected] = useState<Item | null>(initialData.items[0] ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(draftFor());
  const [dirty, setDirty] = useState(false);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<DetailTab>("ข้อมูลทั่วไป");
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkCategoryEnabled, setBulkCategoryEnabled] = useState(false);
  const [bulkKeywordsEnabled, setBulkKeywordsEnabled] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkKeywords, setBulkKeywords] = useState("");
  const [bulkDirty, setBulkDirty] = useState(false);
  const editorRef = useRef<HTMLElement>(null);

  function canLeave(checkBulk = true) {
    return (!(editing && dirty) && !(checkBulk && bulkEditing && bulkDirty)) || window.confirm("ยังไม่ได้บันทึกบทความ ต้องการออกจากการแก้ไขหรือไม่?");
  }

  function open(item: Item | null, edit = false) {
    if (!canLeave(edit)) return;
    if (edit) { setCheckedIds(new Set()); setBulkEditing(false); setBulkDirty(false); }
    setSelected(item); setEditing(edit); setDraft(draftFor(item ?? undefined));
    setDirty(false); setApproved(false); setError(""); setNotice("");
    setTab("ข้อมูลทั่วไป"); setChunks(null);
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  async function load(term: string, page: number, selectedId?: string, nextFilters = filters) {
    const next: KnowledgeAdminList = await requestJson(`/api/admin/knowledge?${new URLSearchParams({ search: term, page: String(page), ...nextFilters, limit: String(nextFilters.limit) })}`);
    setData(next); setQuery(term); setFilters(nextFilters);
    setSelected(next.items.find((item) => item.id === selectedId) ?? next.items[0] ?? null);
    setTab("ข้อมูลทั่วไป"); setChunks(null);
    setCheckedIds(new Set()); setBulkEditing(false); setBulkDirty(false);
    return next;
  }

  const checkedItems = data.items.filter((item) => checkedIds.has(item.id));
  const allChecked = data.items.length > 0 && checkedItems.length === data.items.length;

  function toggleChecked(id: string) {
    if (checkedIds.has(id) && checkedIds.size === 1) { clearChecked(); return; }
    setCheckedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearChecked() {
    if (!canLeave()) return;
    setCheckedIds(new Set()); setBulkEditing(false); setBulkDirty(false);
  }

  async function bulkAction(action: "delete" | "update") {
    if (!checkedItems.length || busy) return;
    if (action === "delete" && !window.confirm(`ลบ ${checkedItems.length} บทความพร้อม passages ทั้งหมดหรือไม่?\n${checkedItems.slice(0, 5).map((item) => `• ${item.title}`).join("\n")}${checkedItems.length > 5 ? `\nและอีก ${checkedItems.length - 5} บทความ` : ""}\nกู้คืนจากหน้านี้ไม่ได้`)) return;
    setBusy(true); setError(""); setNotice("");
    let committed = false;
    try {
      const result = await requestJson("/api/admin/knowledge/bulk", {
        action, selection: checkedItems.map(({ id, updatedAt }) => ({ id, updatedAt })),
        ...(action === "update" ? { changes: {
          ...(bulkCategoryEnabled ? { category: bulkCategory } : {}),
          ...(bulkKeywordsEnabled ? { keywords: bulkKeywords.split(",").map((word) => word.trim()).filter(Boolean) } : {})
        } } : {})
      });
      committed = true; setCheckedIds(new Set()); setBulkEditing(false); setBulkDirty(false);
      await load(query, data.page, action === "update" ? selected?.id : undefined);
      setNotice(`${action === "delete" ? "ลบ" : "แก้ไข"}แล้ว ${result.count} บทความ`);
    } catch (failure) {
      setError(committed ? "ดำเนินการสำเร็จ แต่โหลดรายการใหม่ไม่ได้ กรุณารีเฟรช" : failure instanceof Error ? failure.message : "ดำเนินการไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  async function browse(term: string, page: number, nextFilters = filters) {
    if (!canLeave()) return;
    setBusy(true); setError(""); setNotice("");
    try { await load(term, page, undefined, nextFilters); setEditing(false); setDirty(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "โหลดรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  function change(key: keyof Draft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value, ...(key === "sourceUrl" ? { sourceHash: "" } : {}) }));
    setDirty(true); setApproved(false);
  }

  async function snapshot() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await requestJson("/api/admin/knowledge/source", { sourceUrl: draft.sourceUrl });
      setDraft((previous) => ({ ...previous, sourceHash: result.sourceHash })); setDirty(true); setApproved(false);
      setNotice("ดึง snapshot แล้ว กรุณาตรวจทานเนื้อหากับแหล่งอ้างอิงก่อนบันทึก");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "ดึง snapshot ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!approved || busy) return;
    setBusy(true); setError(""); setNotice("");
    let saved = false;
    try {
      const toIso = (value: string) => new Date(`${value}+07:00`).toISOString();
      const result = await requestJson("/api/admin/knowledge", {
        ...(selected ? { id: selected.id } : {}),
        document: { ...draft, keywords: draft.keywords.split(",").map((word) => word.trim()).filter(Boolean),
          verifiedAt: toIso(draft.verifiedAt), reviewAfter: toIso(draft.reviewAfter),
          validFrom: draft.validFrom ? toIso(draft.validFrom) : undefined,
          validUntil: draft.validUntil ? toIso(draft.validUntil) : undefined }
      });
      saved = true; setEditing(false); setDirty(false); setApproved(false); setSearch("");
      await load("", 1, result.id, defaultFilters);
      setNotice(`บันทึกแล้ว · ${result.chunks} passages · ${result.embedded ? "สร้างดัชนีใหม่" : "ใช้ดัชนีเดิม"}`);
    } catch (failure) {
      setError(saved ? "บันทึกสำเร็จ แต่โหลดรายการใหม่ไม่ได้ กรุณารีเฟรช" : failure instanceof Error ? failure.message : "บันทึกไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  async function check() {
    if (!selected || !canLeave()) return;
    setBusy(true); setError(""); setNotice("");
    let checked = false;
    try {
      const { result } = await requestJson(`/api/admin/knowledge/${selected.id}/check`, {});
      checked = true;
      await load(query, data.page, selected.id);
      setNotice(`ตรวจแหล่งข้อมูลแล้ว: ${result.status}${result.reviewOverdue ? " · ถึงกำหนดตรวจทานใหม่" : ""}`);
    } catch (failure) {
      setError(checked ? "ตรวจแหล่งข้อมูลแล้ว แต่โหลดรายการใหม่ไม่ได้ กรุณารีเฟรช" : failure instanceof Error ? failure.message : "ตรวจไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  async function selectTab(value: DetailTab) {
    if (busy) return;
    setTab(value);
    if (value !== "Chunks" || chunks !== null || !selected) return;
    if (!selected.chunkCount) { setChunks([]); return; }
    setBusy(true); setError("");
    try { setChunks((await requestJson(`/api/admin/knowledge/${selected.id}`)).chunks); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "อ่าน passages ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.limit));
  const fields: Array<{ key: keyof Draft; label: string; type?: string; maxLength?: number; optional?: boolean }> = [
    { key: "title", label: "ชื่อบทความ", maxLength: 200 }, { key: "category", label: "หมวดหมู่", maxLength: 100 },
    { key: "keywords", label: "คำค้น (คั่นด้วย comma)", optional: true },
    { key: "verifiedBy", label: "ผู้ตรวจทาน / หน่วยงานเจ้าของข้อมูล", maxLength: 200 },
    { key: "verifiedAt", label: "ตรวจทานเมื่อ (เวลาไทย UTC+7)", type: "datetime-local" },
    { key: "reviewAfter", label: "ตรวจทานครั้งถัดไป (เวลาไทย UTC+7)", type: "datetime-local" },
    { key: "validFrom", label: "เริ่มใช้ (เวลาไทย UTC+7)", type: "datetime-local", optional: true },
    { key: "validUntil", label: "สิ้นสุด (เวลาไทย UTC+7)", type: "datetime-local", optional: true }
  ];

  return <main className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">BU StudyMate</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">Knowledge Base</h1>
        <p className="mt-1 text-sm text-slate-500">จัดการบทความ ความรู้ และแหล่งข้อมูลที่ใช้ตอบคำถามของ StudyMate</p></div>
      <div className="flex flex-wrap items-center gap-3"><Link href="/admin/chat" title="ทดสอบคำถามและดูการค้นคืนใน Web Chat / Execution Trace" className={`${buttonClass} flex items-center gap-2`}><Play aria-hidden="true" className="h-4 w-4 text-emerald-700" />Retrieval Playground</Link><button type="button" disabled={busy} onClick={() => open(null, true)} className={`${primaryClass} flex items-center gap-2`}><Plus aria-hidden="true" className="h-4 w-4" />เพิ่มบทความ</button></div>
    </div>
    <div aria-live="polite" aria-atomic="true">{error && <p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {busy && <p role="status" className="mt-2 text-sm text-slate-500">กำลังดำเนินการ…</p>}</div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "บทความทั้งหมด", value: data.stats.total, icon: FileText, color: "bg-emerald-50 text-emerald-700", caption: "ข้อมูลทั้งหมดในคลังความรู้" },
        { label: "พร้อมใช้งาน", value: data.stats.ready, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700", caption: "ผ่านเงื่อนไขสำหรับตอบคำถาม" },
        { label: "รอตรวจทาน", value: data.stats.unapproved, icon: Clock3, color: "bg-sky-50 text-sky-600", caption: "ยังไม่มีข้อมูลการอนุมัติครบถ้วน" },
        { label: "ต้องตรวจสอบ", value: data.stats.review, icon: AlertTriangle, color: "bg-rose-50 text-rose-600", caption: "ตรวจแหล่งอ้างอิง อายุข้อมูล หรือดัชนี" }
      ].map(({ label, value, icon: Icon, color, caption }) => <div key={label} className="flex items-start gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-5"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${color}`}><Icon aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-[28px] font-semibold leading-8">{value}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{caption}</p></div></div>)}
    </div>
    <div className={`grid grid-cols-1 items-start gap-3 ${!editing && selected ? "xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`} aria-busy={busy}>
      {!editing && <section className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-4" aria-label="รายการบทความ">
        <form onSubmit={(event) => { event.preventDefault(); void browse(search.trim(), 1); }} className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(200px,1fr)_120px_120px_130px]">
          <div className="flex min-w-0 items-center gap-1"><label className="min-w-0 flex-1"><span className="sr-only">ค้นหาบทความ</span><input value={search} onChange={(event) => setSearch(event.target.value)} disabled={busy} maxLength={200} placeholder="ค้นหาบทความ หรือเนื้อหา…" className={`${fieldClass} mt-0`} /></label><button disabled={busy} className={buttonClass} aria-label="ค้นหา"><Search aria-hidden="true" className="h-4 w-4" /></button></div>
          <label className="min-w-0 text-xs text-slate-500">หมวดหมู่<select aria-label="หมวดหมู่บทความ" disabled={busy} value={filters.category} onChange={(event) => void browse(search.trim(), 1, { ...filters, category: event.target.value })} className={fieldClass}><option value="">ทั้งหมด</option>{data.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="min-w-0 text-xs text-slate-500">สถานะ<select aria-label="สถานะบทความ" disabled={busy} value={filters.status} onChange={(event) => void browse(search.trim(), 1, { ...filters, status: event.target.value as KnowledgeFilters["status"] })} className={fieldClass}><option value="all">ทั้งหมด</option><option value="ready">พร้อมใช้งาน</option><option value="unapproved">รอตรวจทาน</option><option value="review">ต้องตรวจสอบ</option></select></label>
          <label className="min-w-0 text-xs text-slate-500">แหล่งอ้างอิง<select aria-label="แหล่งอ้างอิงบทความ" disabled={busy} value={filters.source} onChange={(event) => void browse(search.trim(), 1, { ...filters, source: event.target.value as KnowledgeFilters["source"] })} className={fieldClass}><option value="all">ทั้งหมด</option><option value="official">เว็บไซต์ BU</option><option value="legacy">ข้อมูลแหล่งที่มาเดิม</option><option value="missing">ไม่ระบุ</option></select></label>
        </form>
        {checkedItems.length > 0 && <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-xs font-semibold text-emerald-800">เลือก {checkedItems.length} บทความในหน้านี้</p><div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => { if (!bulkEditing) { setBulkCategoryEnabled(false); setBulkKeywordsEnabled(false); setBulkCategory(""); setBulkKeywords(""); setBulkDirty(false); } setBulkEditing(true); setError(""); }} className={`${buttonClass} flex items-center gap-2`}><PencilLine aria-hidden="true" className="h-3.5 w-3.5" />แก้ไขที่เลือก</button>
            <button disabled={busy} onClick={() => void bulkAction("delete")} className={`${buttonClass} flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50`}><Trash2 aria-hidden="true" className="h-3.5 w-3.5" />ลบที่เลือก</button>
            <button disabled={busy} onClick={clearChecked} className={buttonClass}>ยกเลิกการเลือก</button>
          </div></div>
          {bulkEditing && <form aria-label="แก้ไขบทความที่เลือก" onSubmit={(event) => { event.preventDefault(); void bulkAction("update"); }} className="mt-4 border-t border-emerald-100 pt-4">
            <fieldset disabled={busy} className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={bulkCategoryEnabled} onChange={(event) => { setBulkCategoryEnabled(event.target.checked); setBulkDirty(true); }} className="h-4 w-4 accent-emerald-700" />เปลี่ยนหมวดหมู่</label>
              {bulkCategoryEnabled && <label className="block text-xs text-slate-600">หมวดหมู่ใหม่<input required maxLength={100} value={bulkCategory} onChange={(event) => { setBulkCategory(event.target.value); setBulkDirty(true); }} className={fieldClass} /></label>}
              <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={bulkKeywordsEnabled} onChange={(event) => { setBulkKeywordsEnabled(event.target.checked); setBulkDirty(true); }} className="h-4 w-4 accent-emerald-700" />แทนที่คำค้นเดิม</label>
              {bulkKeywordsEnabled && <label className="block text-xs text-slate-600">คำค้นใหม่ (คั่นด้วย comma; เว้นว่างเพื่อล้างคำค้น)<input value={bulkKeywords} onChange={(event) => { setBulkKeywords(event.target.value); setBulkDirty(true); }} className={fieldClass} /></label>}
              <p className="text-xs leading-5 text-slate-500">ใช้ค่าข้างต้นกับทุกบทความที่เลือก การเปลี่ยนหมวดหมู่จะปรับ embeddings ของดัชนีที่ใช้ได้ก่อนบันทึก เนื้อหาและวันที่ตรวจทานคงเดิม บทความที่ยังไม่มีดัชนีที่ใช้ได้ยังต้องตรวจทานรายบทความ</p>
              <div className="flex flex-wrap gap-2"><button disabled={busy || (!bulkCategoryEnabled && !bulkKeywordsEnabled)} className={primaryClass}>บันทึกบทความที่เลือก</button><button type="button" disabled={busy} onClick={() => { if (canLeave()) { setBulkEditing(false); setBulkDirty(false); } }} className={buttonClass}>ปิดฟอร์มแก้ไขเป็นชุด</button></div>
            </fieldset>
          </form>}
        </div>}
        <div className="max-h-[650px] overflow-auto"><table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs"><caption className="sr-only">บทความในคลังความรู้ เลือกชื่อเพื่อดูรายละเอียด</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] text-slate-500"><tr><th className="w-8 p-2"><input type="checkbox" aria-label="เลือกทั้งหมดในหน้านี้" aria-checked={checkedItems.length > 0 && !allChecked ? "mixed" : allChecked} ref={(node) => { if (node) node.indeterminate = checkedItems.length > 0 && !allChecked; }} checked={allChecked} disabled={busy || !data.items.length} onChange={() => { if (allChecked) clearChecked(); else setCheckedIds(new Set(data.items.map((item) => item.id))); }} className="h-3.5 w-3.5 accent-emerald-700" /></th><th className="w-[29%] py-3 font-medium">ชื่อบทความ</th><th className="w-[15%] px-2 font-medium">หมวดหมู่</th><th className="w-[14%] px-2 font-medium">แหล่งอ้างอิง</th><th className="w-[9%] px-2 font-medium">Passages</th><th className="w-[14%] px-2 font-medium">อัปเดตล่าสุด</th><th className="w-[15%] px-2 font-medium">สถานะ</th><th className="w-9"><span className="sr-only">แก้ไข</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.items.map((item) => <tr key={item.id} className={selected?.id === item.id ? "bg-emerald-50/65" : "hover:bg-slate-50/70"}>
            <td className="px-2"><input type="checkbox" aria-label={`เลือก ${item.title}`} checked={checkedIds.has(item.id)} onChange={() => toggleChecked(item.id)} disabled={busy} className="h-3.5 w-3.5 accent-emerald-700" /></td>
            <td className="py-3 pr-2"><button disabled={busy} onClick={() => open(item)} aria-pressed={selected?.id === item.id} className="flex w-full items-start gap-2 text-left focus-visible:outline-emerald-600"><FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="min-w-0"><span className="block truncate font-semibold text-emerald-800" title={item.title}>{item.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{item.content}</span></span></button></td>
            <td className="px-2"><span title={item.category} className={`inline-block max-w-full truncate rounded-full px-2 py-1 text-[10px] ${["bg-violet-50 text-violet-600", "bg-sky-50 text-sky-600", "bg-emerald-50 text-emerald-700", "bg-amber-50 text-amber-700"][data.categories.indexOf(item.category) % 4]}`}>• {item.category}</span></td>
            <td className="truncate px-2 text-slate-500" title={sourceName(item)}>{sourceName(item)}</td><td className="px-2 text-slate-500">{item.chunkCount}</td>
            <td className="px-2 text-[10px] leading-5 text-slate-600">{displayDate(item.updatedAt)}</td><td className="px-2"><StatusBadge item={item} /></td>
            <td><button disabled={busy} onClick={() => open(item, true)} aria-label={`แก้ไข ${item.title}`} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-emerald-50 focus-visible:outline-emerald-600"><PencilLine aria-hidden="true" className="h-3 w-3" /></button></td>
          </tr>)}</tbody></table>
          {!data.items.length && <p className="p-10 text-center text-sm text-slate-500">{query || filters.category || filters.status !== "all" || filters.source !== "all" ? "ไม่พบบทความที่ตรงกับคำค้นหรือตัวกรอง" : "ยังไม่มีบทความ เริ่มเพิ่มข้อมูลที่ผ่านการตรวจทาน"}</p>}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><span>แสดง {data.total ? (data.page - 1) * data.limit + 1 : 0}–{Math.min(data.page * data.limit, data.total)} จาก {data.total} รายการ <span className="sr-only">หน้า {data.page} / {pageCount}</span></span>
          <div className="flex items-center gap-1"><button aria-label="ก่อนหน้า" disabled={busy || data.page === 1} onClick={() => void browse(query, data.page - 1)} className={buttonClass}><ChevronLeft aria-hidden="true" className="h-3 w-3" /></button><span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-emerald-700 px-2 font-semibold text-white">{data.page}</span><span className="px-1 text-slate-400">/ {pageCount}</span><button aria-label="ถัดไป" disabled={busy || data.page * data.limit >= data.total} onClick={() => void browse(query, data.page + 1)} className={buttonClass}><ChevronRight aria-hidden="true" className="h-3 w-3" /></button></div>
          <label className="flex items-center gap-2 text-xs">แสดง<select aria-label="จำนวนรายการต่อหน้า" disabled={busy} value={filters.limit} onChange={(event) => void browse(query, 1, { ...filters, limit: Number(event.target.value) as KnowledgeFilters["limit"] })} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">{[10, 20, 50].map((limit) => <option key={limit} value={limit}>{limit} รายการ</option>)}</select></label>
        </div>
      </section>}
      {(editing || selected) && <section ref={editorRef} tabIndex={-1} className={`min-w-0 rounded-xl border border-slate-200/80 bg-white p-5 focus:outline-none ${editing ? "mx-auto w-full max-w-4xl md:p-6" : ""}`} aria-label={editing ? "ฟอร์มบทความ" : "รายละเอียดบทความ"}>
        {editing ? <form onSubmit={save}>
          <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{selected ? "แก้ไขและตรวจทานบทความ" : "เพิ่มบทความ"}</h2><button type="button" disabled={busy} onClick={() => { if (canLeave()) { setEditing(false); setDirty(false); setError(""); setNotice(""); } }} className={buttonClass}>ยกเลิก</button></div>
          <fieldset disabled={busy} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.slice(0, 3).map((field) => <div key={field.key} className={`min-w-0 ${field.key === "keywords" ? "sm:col-span-2" : ""}`}><label className="text-sm font-medium">{field.label}<input required={!field.optional} maxLength={field.maxLength} readOnly={field.key === "title" && Boolean(selected)} aria-describedby={field.key === "title" && selected ? "knowledge-title-help" : undefined} value={draft[field.key]} onChange={(event) => change(field.key, event.target.value)} className={fieldClass} /></label>{field.key === "title" && selected && <p id="knowledge-title-help" className="mt-1 text-xs text-slate-500">ใช้ชื่อเดิมเพื่อรักษาตัวตนของบทความ</p>}</div>)}</div>
            <div><label htmlFor="knowledge-content" className="block text-sm font-medium">เนื้อหาที่ผ่านการตรวจทาน</label><textarea id="knowledge-content" required maxLength={20000} rows={10} value={draft.content} onChange={(event) => change("content", event.target.value)} className={fieldClass} /></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <label className="block text-sm font-medium">URL แหล่งอ้างอิง<input type="url" required value={draft.sourceUrl} onChange={(event) => change("sourceUrl", event.target.value)} placeholder="https://…bu.ac.th/…" className={fieldClass} /></label>
              <div className="mt-3 flex flex-wrap items-center gap-3">{sourceLink(draft.sourceUrl) && <a href={sourceLink(draft.sourceUrl)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-700 underline">เปิดแหล่งอ้างอิง</a>}<button type="button" disabled={busy || !draft.sourceUrl} onClick={() => void snapshot()} className={buttonClass}>ดึง snapshot</button></div>
              <label className="mt-3 block text-xs text-slate-500">SHA-256 ของแหล่งอ้างอิง<input readOnly required value={draft.sourceHash} className={`${fieldClass} font-mono text-xs`} placeholder="ดึง snapshot หลังตรวจแหล่งอ้างอิง" /></label>
              <p className="mt-2 text-xs leading-5 text-slate-500">รองรับ HTTPS ของ bu.ac.th และโดเมนย่อย การดึง snapshot ยังไม่ถือว่าบทความผ่านการตรวจทาน</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.slice(3).map((field) => <label key={field.key} className={`min-w-0 text-sm font-medium ${field.key === "verifiedBy" ? "sm:col-span-2" : ""}`}>{field.label}{field.optional && <span className="font-normal text-slate-400"> · ไม่บังคับ</span>}<input type={field.type ?? "text"} step={field.type === "datetime-local" ? 1 : undefined} required={!field.optional} maxLength={field.maxLength} value={draft[field.key]} onChange={(event) => change(field.key, event.target.value)} className={fieldClass} /></label>)}</div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6"><input type="checkbox" required checked={approved} onChange={(event) => { setApproved(event.target.checked); setDirty(true); }} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" /><span>ฉันตรวจทานเนื้อหากับแหล่งอ้างอิงแล้ว และยืนยันผู้ตรวจทานกับวันที่ข้างต้น</span></label>
            <div className="flex flex-wrap items-center gap-3"><button disabled={busy || !approved || !draft.sourceHash} className={primaryClass}>{busy ? "กำลังดำเนินการ…" : "บันทึกและสร้างดัชนี"}</button><span className="text-xs text-slate-500">ข้อมูลเดิมจะถูกแทนเมื่อเตรียมดัชนีสำเร็จ</span></div>
          </fieldset>
        </form> : selected ? <>
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><h2 className="break-words text-sm font-bold leading-6">{selected.title}</h2></div><button disabled={busy} aria-label="ปิดรายละเอียดบทความ" onClick={() => open(null)} className="rounded p-1 text-slate-400 hover:bg-slate-50 focus-visible:outline-emerald-600"><X aria-hidden="true" className="h-4 w-4" /></button></div>
          <div role="tablist" aria-label="รายละเอียดความรู้" className="-mx-5 mt-5 flex overflow-x-auto border-b border-slate-200 px-2">{detailTabs.map((value, index) => <button key={value} id={`knowledge-tab-${index}`} role="tab" aria-selected={tab === value} aria-controls="knowledge-tab-panel" tabIndex={tab === value ? 0 : -1} disabled={busy} onClick={() => void selectTab(value)} onKeyDown={(event) => {
            const directions: Record<string, number> = { ArrowRight: (index + 1) % detailTabs.length, ArrowLeft: (index + detailTabs.length - 1) % detailTabs.length, Home: 0, End: detailTabs.length - 1 };
            const next = directions[event.key];
            if (next === undefined) return;
            event.preventDefault(); void selectTab(detailTabs[next]);
            document.getElementById(`knowledge-tab-${next}`)?.focus();
          }} className={`shrink-0 border-b-2 px-2.5 py-3 text-[11px] focus-visible:outline-emerald-600 ${tab === value ? "border-emerald-600 font-semibold text-emerald-700" : "border-transparent text-slate-500 hover:text-emerald-700"}`}>{value === "Chunks" ? `Chunks (${selected.chunkCount})` : value}</button>)}</div>
          <div id="knowledge-tab-panel" role="tabpanel" aria-labelledby={`knowledge-tab-${detailTabs.indexOf(tab)}`} tabIndex={0} className="pt-5 focus-visible:outline-emerald-600">
            {tab === "ข้อมูลทั่วไป" && <>
              <dl className="space-y-3 text-xs">{[
                ["ชื่อบทความ", selected.title], ["ประเภทข้อมูล", "บทความที่ผ่านการจัดเตรียม"], ["หมวดหมู่", selected.category],
                ["แหล่งอ้างอิง", sourceName(selected)], ["จำนวน passages", String(selected.chunkCount)],
                ["อัปเดตล่าสุด", displayDate(selected.updatedAt)], ["ผู้ตรวจทาน", selected.verifiedBy ?? "—"],
                ["ตรวจทานเมื่อ", displayDate(selected.verifiedAt)], ["ตรวจทานครั้งถัดไป", displayDate(selected.reviewAfter)]
              ].map(([label, value]) => <div key={label} className="grid grid-cols-[105px_minmax(0,1fr)] gap-2"><dt className="leading-5 text-slate-500">{label}</dt><dd className="break-words leading-5 text-slate-700">{value}</dd></div>)}
                <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-2"><dt className="text-slate-500">สถานะ</dt><dd><StatusBadge item={selected} /></dd></div>
              </dl>
              <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-semibold">พรีวิวเนื้อหา</h3><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between text-[10px] text-slate-500"><span>บทความ · {selected.chunkCount} passages</span><BookOpen aria-hidden="true" className="h-3.5 w-3.5" /></div><div className="mt-3 border border-slate-100 bg-white p-5 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">BU StudyMate</p><h4 className="mt-3 break-words text-lg font-bold leading-7">{selected.title}</h4><div className="my-4 h-0.5 w-12 bg-emerald-600" /><p className="line-clamp-6 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{selected.content}</p></div><button onClick={() => void selectTab("เนื้อหา")} className="mt-3 text-xs font-semibold text-emerald-700 underline">อ่านเนื้อหาทั้งหมด</button></div></div>
            </>}
            {tab === "เนื้อหา" && <><h3 className="text-sm font-semibold">เนื้อหาบทความ</h3><div className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm leading-7">{selected.content}</div>{selected.keywords.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{selected.keywords.map((word, index) => <span key={`${index}-${word}`} className="break-all rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">{word}</span>)}</div>}</>}
            {tab === "Chunks" && <div className="space-y-3">{busy ? <p className="text-sm text-slate-500">กำลังอ่าน passages…</p> : chunks === null ? <button onClick={() => void selectTab("Chunks")} className={buttonClass}>อ่าน passages อีกครั้ง</button> : chunks.length ? chunks.map((chunk) => <article key={chunk.id} className="rounded-lg border border-slate-200 p-3"><h3 className="text-xs font-semibold text-emerald-700">Passage {chunk.ordinal + 1}</h3><p className="mt-1 break-all text-[10px] text-slate-500">{chunk.embeddingModel}</p><p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6">{chunk.content}</p></article>) : <p className="text-sm text-slate-500">ยังไม่มี passages ที่สร้างไว้สำหรับบทความนี้</p>}</div>}
            {tab === "การใช้งาน" && <div className="space-y-4 text-xs leading-6"><div className="rounded-lg bg-emerald-50 p-3"><h3 className="font-semibold text-emerald-800">สถานะสำหรับ RAG</h3><p className="mt-1 text-emerald-700">{selected.availability}</p></div><p className="text-slate-500">ระบบใช้ passages ที่ผ่านการตรวจทานเพื่อค้นคืนและสร้างคำตอบพร้อมแหล่งอ้างอิง ยังไม่มีสถิติการใช้งานที่ผูกกับบทความรายชิ้น</p><Link href="/admin/chat" className="block font-semibold text-emerald-700 underline">ทดสอบคำถามใน Web Chat / Execution Trace</Link><Link href="/admin/runs?target=knowledge_base" className="block font-semibold text-emerald-700 underline">ดู Bot Runs ของ Knowledge Base</Link></div>}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-semibold">แหล่งอ้างอิงและความพร้อมใช้งาน</h3><p className="mt-2 text-xs leading-5 text-slate-500">{selected.availability}</p>
            {sourceLink(selected.sourceUrl ?? selected.source) ? <a href={sourceLink(selected.sourceUrl ?? selected.source)} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-emerald-700 underline">{selected.sourceUrl ?? selected.source}</a> : <p className="mt-2 break-all text-xs text-slate-500">{selected.sourceUrl ?? selected.source ?? "ยังไม่มีแหล่งอ้างอิง"}</p>}
            <p className="mt-3 text-[11px] leading-5 text-slate-500">ตรวจล่าสุด: {displayDate(selected.sourceCheckedAt)} · {selected.sourceStatus ?? "ยังไม่ตรวจ"}<br />ช่วงใช้งาน: {displayDate(selected.validFrom)} — {displayDate(selected.validUntil)}</p>
            <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => open(selected, true)} className={primaryClass}>แก้ไข / ตรวจทาน</button><button disabled={busy || !selected.verifiedAt || !selected.sourceUrl || !selected.sourceHash} onClick={() => void check()} className={`${buttonClass} flex items-center gap-2`}><RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />{busy ? "กำลังตรวจ…" : "ตรวจแหล่งข้อมูล"}</button></div>
          </div>
        </> : null}
      </section>}
    </div>
  </main>;
}
