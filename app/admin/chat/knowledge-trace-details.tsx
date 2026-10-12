import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";

export function KnowledgeTraceDetails({ data, expanded = false }: { data: ExecutionLogEntry["rag"]; expanded?: boolean }) {
  if (!data) return null;
  return <div className="mt-3 min-w-0 space-y-3 text-xs">
    {(data.originalQuery !== undefined || data.query !== undefined) && <dl className="space-y-3 rounded-lg border border-slate-200 p-3">
      {[["คำถามเดิม", data.originalQuery], ["Query ที่ใช้ค้น", data.query]].map(([label, value]) => value !== undefined && <div key={label}>
        <dt className="font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">{value}</dd>
      </div>)}
    </dl>}
    <dl className="flex flex-wrap gap-x-4 gap-y-2 text-slate-600">
      {[["Model", data.model], ["Tokens", data.tokens], ["Keyword", data.keywordCount], ["Vector", data.vectorCount]].map(([label, value]) => value !== undefined && <div key={label} className="min-w-0">
        <dt className="inline text-slate-500">{label}: </dt><dd className="inline break-all font-medium">{value}</dd>
      </div>)}
    </dl>
    {!!data.chunks?.length && <ol className="space-y-2" aria-label="Knowledge chunks">
      {data.chunks.map((chunk) => <li key={chunk.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 break-words font-medium leading-5">{chunk.title}</p>
          <span className="shrink-0 rounded bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800">RRF #{chunk.rank}{chunk.selectedRank !== undefined && ` → Selected #${chunk.selectedRank}`}</span>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
          <span>RRF {chunk.rrfScore.toFixed(5)}</span>
          {chunk.similarity !== null && <span>Cosine {chunk.similarity.toFixed(3)}</span>}
          {chunk.keywordRank != null && <span>Keyword #{chunk.keywordRank}</span>}
          {chunk.vectorRank != null && <span>Vector #{chunk.vectorRank}</span>}
        </p>
        <p className="mt-2 break-all text-[10px] text-slate-500">Chunk ID: {chunk.id}</p>
        <p className="mt-1 break-all leading-5">{/^https?:\/\//i.test(chunk.sourceUrl)
          ? <a href={chunk.sourceUrl} title={chunk.sourceUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-emerald-700 underline">{chunk.sourceUrl}</a>
          : <span>{chunk.sourceUrl}</span>}</p>
        {chunk.content !== undefined && <details open={expanded} className="mt-2">
          <summary className="cursor-pointer rounded text-emerald-700 focus-visible:outline-emerald-700">อ่านข้อความ chunk</summary>
          <p className="mt-2 whitespace-pre-wrap break-words border-t border-slate-100 pt-2 leading-6 [overflow-wrap:anywhere]">{chunk.content}</p>
        </details>}
      </li>)}
    </ol>}
  </div>;
}
