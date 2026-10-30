"use client";

import { useState, type FormEvent } from "react";
import { Files } from "lucide-react";
import type { SavedStudyFileDto } from "@/src/dtos/chat.dto";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; result: SavedStudyFileDto; sessionId: string }
  | { status: "error"; error: string; sessionId: string };

type StudyForm = {
  file: File | null;
  courseName: string;
};

export function StudyUpload({ sessionId, disabled, onBusyChange, onSaved }: {
  sessionId: string; disabled: boolean; onBusyChange: (busy: boolean) => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<StudyForm>({ file: null, courseName: "" });
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!form.file || disabled) return;
    setUploadState({ status: "uploading" });
    onBusyChange(true);
    const body = new FormData();
    body.set("file", form.file); body.set("sessionId", sessionId); body.set("courseName", form.courseName);
    try {
      const response = await fetch("/api/chat/upload", { method: "POST", body });
      const data = await response.json();
      if (response.status === 401) window.location.assign("/login");
      if (!response.ok) throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
      setUploadState({ status: "success", result: data, sessionId });
      await onSaved();
    } catch (cause) {
      setUploadState({
        status: "error",
        error: cause instanceof Error ? cause.message : "อัปโหลดไม่สำเร็จ",
        sessionId
      });
    } finally {
      onBusyChange(false);
    }
  }

  const isUploading = uploadState.status === "uploading";

  return <details className="group w-full open:w-full sm:w-auto">
    <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium hover:bg-emerald-50 focus-visible:outline-emerald-700"><Files aria-hidden="true" className="h-4 w-4" />เพิ่มเอกสาร (PDF / DOCX)</summary>
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <form onSubmit={upload} className="space-y-3">
      <label className="block text-xs text-slate-600">ชื่อวิชา (ไม่บังคับ)<input value={form.courseName} onChange={(event) => setForm((prev) => ({ ...prev, courseName: event.target.value }))} disabled={disabled} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-emerald-600" /></label>
      <label className="block text-xs text-slate-600">ไฟล์บทเรียน<input type="file" accept=".pdf,.docx" onChange={(event) => setForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))} disabled={disabled} className="mt-2 block w-full min-w-0 text-xs" /></label>
      <button disabled={disabled || !form.file || isUploading} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">{isUploading ? "กำลังอัปโหลด…" : "อัปโหลดและบันทึก"}</button>
    </form>
    {uploadState.status === "error" && uploadState.sessionId === sessionId && (
      <p role="alert" className="mt-3 text-sm text-rose-700">{uploadState.error}</p>
    )}
    {uploadState.status === "success" && uploadState.sessionId === sessionId && (
      <div role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6">
        <p className="break-words font-medium">บันทึก {uploadState.result.fileName} แล้ว · {uploadState.result.note.courseName}</p>
        <p className="whitespace-pre-wrap break-words">{uploadState.result.note.summary}</p>
        {uploadState.result.note.assignments.map((assignment, index) => <p key={index}>{assignment.title} · {assignment.dueDateText ?? "ไม่มีวันกำหนดส่ง"}</p>)}
        {uploadState.result.warnings?.map((warning, index) => <p key={index} className="text-amber-900">{warning}</p>)}
      </div>
    )}
    <p className="mt-3 text-xs leading-5 text-slate-500">บันทึกลง study memory ของ session นี้จริง ผลอัปโหลดแสดงในหน้านี้และไม่เป็นเทิร์นในรายงานแชท</p>
    </div>
  </details>;
}
