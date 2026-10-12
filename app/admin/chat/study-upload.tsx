"use client";

import { useState, type FormEvent } from "react";
import { Files } from "lucide-react";
import type { SavedStudyFileDto } from "@/src/dtos/chat.dto";

export function StudyUpload({ sessionId, disabled, onBusyChange, onSaved }: {
  sessionId: string; disabled: boolean; onBusyChange: (busy: boolean) => void; onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [courseName, setCourseName] = useState("");
  const [result, setResult] = useState<SavedStudyFileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultSessionId, setResultSessionId] = useState<string | null>(null);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || disabled) return;
    setUploading(true); onBusyChange(true); setError(null); setResult(null); setResultSessionId(sessionId);
    const body = new FormData();
    body.set("file", file); body.set("sessionId", sessionId); body.set("courseName", courseName);
    try {
      const response = await fetch("/api/chat/upload", { method: "POST", body });
      const data = await response.json();
      if (response.status === 401) window.location.assign("/login");
      if (!response.ok) throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
      setResult(data);
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "อัปโหลดไม่สำเร็จ"); }
    finally { setUploading(false); onBusyChange(false); }
  }

  return <details className="group w-full open:w-full sm:w-auto">
    <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium hover:bg-emerald-50 focus-visible:outline-emerald-700"><Files aria-hidden="true" className="h-4 w-4" />เพิ่มเอกสาร (PDF / DOCX)</summary>
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <form onSubmit={upload} className="space-y-3">
      <label className="block text-xs text-slate-600">ชื่อวิชา (ไม่บังคับ)<input value={courseName} onChange={(event) => setCourseName(event.target.value)} disabled={disabled} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-emerald-600" /></label>
      <label className="block text-xs text-slate-600">ไฟล์บทเรียน<input type="file" accept=".pdf,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={disabled} className="mt-2 block w-full min-w-0 text-xs" /></label>
      <button disabled={disabled || !file} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">{uploading ? "กำลังอัปโหลด…" : "อัปโหลดและบันทึก"}</button>
    </form>
    {resultSessionId === sessionId && error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {resultSessionId === sessionId && result && <div role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6"><p className="break-words font-medium">บันทึก {result.fileName} แล้ว · {result.note.courseName}</p><p className="whitespace-pre-wrap break-words">{result.note.summary}</p>{result.note.assignments.map((assignment, index) => <p key={index}>{assignment.title} · {assignment.dueDateText ?? "ไม่มีวันกำหนดส่ง"}</p>)}{result.warnings?.map((warning, index) => <p key={index} className="text-amber-900">{warning}</p>)}</div>}
    <p className="mt-3 text-xs leading-5 text-slate-500">บันทึกลง study memory ของ session นี้จริง ผลอัปโหลดแสดงในหน้านี้และไม่เป็นเทิร์นในรายงานแชท</p>
    </div>
  </details>;
}
