import { AdminPageHeader } from "../../admin-page-header";

export default function WorkflowLoading() {
  return <main aria-busy="true" className="min-w-0 space-y-5">
    <AdminPageHeader title="Agent Workflow" description="เส้นทางของคำถามและหลักฐานจากการทำงานที่บันทึกไว้" />
    <p role="status" className="text-sm text-slate-600">กำลังโหลด Bot Runs…</p>
    <div aria-hidden="true" className="space-y-5">
      <div className="h-32 rounded-lg bg-slate-100" />
      <div className="h-28 rounded-lg bg-slate-100" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="h-72 rounded-lg bg-slate-100" /><div className="h-72 rounded-lg bg-slate-100" /></div>
    </div>
  </main>;
}
