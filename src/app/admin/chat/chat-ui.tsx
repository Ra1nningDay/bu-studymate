import { ExternalLink } from "lucide-react";

export function ChatAvatar() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="h-10 w-10 shrink-0">
    <path d="M10 31c-4-6-4-13 0-17L9 5l10 7h10l10-7-1 10c4 6 3 13-1 17" fill="white" stroke="#22354b" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M11 30h26l4 13H7z" fill="#008968" stroke="#22354b" strokeWidth="1.5" strokeLinejoin="round" />
    <ellipse cx="17" cy="23" rx="2" ry="2.5" fill="#22354b" /><ellipse cx="31" cy="23" rx="2" ry="2.5" fill="#22354b" />
    <path d="M21 27l3 2 3-2 M24 29v3 M18 31q3 4 6 1 3 3 6-1" fill="none" stroke="#22354b" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 11l4 3 M36 11l-4 3" stroke="#f4b5c3" strokeWidth="3" strokeLinecap="round" />
    <circle cx="12" cy="28" r="2.5" fill="#fbd2db" /><circle cx="36" cy="28" r="2.5" fill="#fbd2db" /><circle cx="24" cy="38" r="2" fill="white" />
  </svg>;
}

export function ChatSources({ sources }: { sources: string[] }) {
  return <ul className="flex flex-wrap gap-2">
    {sources.map((source, index) => <li key={index} className="min-w-0 max-w-full">
      {/^https?:\/\//i.test(source)
        ? <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-xs text-sky-700 hover:bg-cyan-100 focus-visible:outline-emerald-700"><span className="truncate">{source}</span><ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" /></a>
        : <span className="block break-words rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{source}</span>}
    </li>)}
  </ul>;
}
