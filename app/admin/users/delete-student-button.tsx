"use client";

import { useRef, useState } from "react";

export function DeleteStudentButton({ lineUserId, email }: { lineUserId: string; email: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <>
      <button type="button" onClick={() => { setTyped(""); dialog.current?.showModal(); }} className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-red-600">
        Delete
      </button>
      <dialog ref={dialog} aria-labelledby={`del-${lineUserId}`} className="w-full max-w-md rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-950/40">
        <form action="/api/admin/users/delete" method="POST" className="space-y-4 p-6">
          <h2 id={`del-${lineUserId}`} className="text-lg font-semibold text-bu-ink">Delete this student?</h2>
          <p className="text-sm leading-6 text-slate-600">
            This unlinks <strong className="break-all">{email}</strong> from LINE. The student must verify again before the bot answers.
            Their chat history, notes and tickets are kept.
          </p>
          <label className="block text-sm text-slate-700">
            Type the email to confirm
            <input name="confirmEmail" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15" />
          </label>
          <input type="hidden" name="lineUserId" value={lineUserId} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button disabled={!matches} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
