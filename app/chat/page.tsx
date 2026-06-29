import Link from "next/link";
import { ChatInterface } from "./ChatInterface";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-5 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-bu-purple">
            BU StudyMate
          </Link>
          <Link
            href="/admin/tickets"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-bu-purple/40 hover:text-bu-purple"
          >
            Open tickets
          </Link>
        </nav>
        <ChatInterface />
      </div>
    </main>
  );
}
