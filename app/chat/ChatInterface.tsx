"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  sources?: Array<{
    title: string;
    url: string;
  }>;
  text: string;
  flexMessage?: any;
  usedWebSearch?: boolean;
};

const starterPrompts = [
  `/addnote Data Structure
Homework 3 due May 27, 2024 23:59
Details:

* Implement Linked List
* Write in C++
* Upload .cpp and .pdf via BU Online
Professor explained Queue follows FIFO and is useful for task scheduling and BFS.`,
  "When is the Data Structure assignment due?",
  "What did the professor say about Queues?",
  "Can you summarize the latest Data Structure class?",
  "What did the professor say about Stacks?",
  "How do I connect to BU Wi-Fi?",
  "Where can I check university holidays?",
  "The AC in A3 Building, 2nd floor, LAB 2 is not cold.",
  "Check ticket BU-TICKET-0001"
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hello, I am BU StudyMate. You can ask me about BU information or report classroom issues."
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [courseName, setCourseName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionIdRef = useRef(createId("browser"));

  const canSend = input.trim().length > 0 && !isSending;
  const canUpload = Boolean(selectedFile) && !isSending;
  const statusLabel = useMemo(() => {
    if (isSending) return "StudyMate is typing...";
    if (aiConfigured === true) return "OpenAI enabled on the server";
    if (aiConfigured === false) return "OpenAI key not configured, using local fallback";
    return "Connected to server bot handler";
  }, [aiConfigured, isSending]);

  async function sendMessage(text: string) {
    const cleanText = text.trim();
    if (!cleanText || isSending) return;

    setError(null);
    setInput("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      text: cleanText
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanText,
          sessionId: sessionIdRef.current
        })
      });

      const data = (await response.json()) as {
        aiConfigured?: boolean;
        reply?: string;
        flexMessage?: any;
        error?: string;
        sources?: Array<{
          title: string;
          url: string;
        }>;
        usedWebSearch?: boolean;
      };
      if (!response.ok) {
        throw new Error(data.error || "Chat request failed");
      }

      if (typeof data.aiConfigured === "boolean") {
        setAiConfigured(data.aiConfigured);
      }

      setMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          sources: data.sources ?? [],
          text: data.reply || "No answer from the system yet.",
          flexMessage: data.flexMessage,
          usedWebSearch: data.usedWebSearch
        }
      ]);
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "Failed to send message. Please try again.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: createId("assistant-error"),
          role: "assistant",
          text: "Sorry, the web tester is currently unable to connect to the bot."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function uploadStudyFile() {
    if (!selectedFile || isSending) return;

    setError(null);
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: createId("user-file"),
      role: "user",
      text: `Uploaded file: ${selectedFile.name}${courseName.trim() ? `\nCourse: ${courseName.trim()}` : ""}`
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("sessionId", sessionIdRef.current);
      if (courseName.trim()) {
        formData.append("courseName", courseName.trim());
      }

      const response = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as {
        aiConfigured?: boolean;
        error?: string;
        fileName?: string;
        note?: {
          assignments: Array<{ dueDateText: string | null; title: string }>;
          courseName: string;
          summary: string | null;
        };
        pageCount?: number;
        sourceType?: string;
        usedOcr?: boolean;
        warnings?: string[];
      };

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      if (typeof data.aiConfigured === "boolean") {
        setAiConfigured(data.aiConfigured);
      }

      const lines = [
        `Saved ${data.fileName || selectedFile.name} as study memory.`,
        data.note?.courseName ? `Course: ${data.note.courseName}` : null,
        data.sourceType ? `Source: ${data.sourceType}${data.usedOcr ? " with OCR" : ""}` : null,
        data.pageCount ? `Pages: ${data.pageCount}` : null,
        data.note?.summary ? `Summary: ${data.note.summary}` : null,
        data.note?.assignments?.length
          ? `Assignments:\n${data.note.assignments
              .map((assignment) =>
                `- ${assignment.title}${assignment.dueDateText ? `, due ${assignment.dueDateText}` : ""}`
              )
              .join("\n")}`
          : null,
        data.warnings?.length ? `Notes: ${data.warnings.join(" ")}` : null
      ].filter(Boolean);

      setMessages((current) => [
        ...current,
        {
          id: createId("assistant-file"),
          role: "assistant",
          text: lines.join("\n")
        }
      ]);
      setSelectedFile(null);
      setCourseName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload file. Please try again.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: createId("assistant-upload-error"),
          role: "assistant",
          text: "Sorry, the web tester could not save that study file."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleInput(value: string) {
    setInput(value);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  return (
    <section className="grid min-h-[calc(100vh-96px)] gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
      <aside className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bu-purple">
            BU StudyMate
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-bu-ink md:text-4xl">
            Web chat tester for the LINE bot
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Use this page to test the bot responses from the browser by calling the same bot handler as the LINE webhook, without sending actual messages to LINE.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Try a prompt
          </p>
          <div className="grid gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                data-testid="starter-prompt"
                onClick={() => void sendMessage(prompt)}
                disabled={isSending}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-bu-purple/40 hover:bg-white hover:text-bu-purple disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-bu-ink">StudyMate Chat</h2>
            <p className="text-xs text-slate-500">{statusLabel}</p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7f7fb] px-4 py-5">
          {messages.map((message) => (
            <div
              key={message.id}
              data-testid={`chat-message-${message.role}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === "user"
                    ? "bg-bu-purple text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                {message.text}
                {message.sources?.length ? (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Sources
                    </p>
                    <div className="mt-2 grid gap-1.5">
                      {message.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-words text-xs font-medium text-bu-purple underline-offset-2 hover:underline"
                        >
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {message.flexMessage && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-700">
                        {message.flexMessage.altText || "Flex Message Payload"}
                      </summary>
                      <pre className="mt-2 max-h-[300px] overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
                        {JSON.stringify(message.flexMessage, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isSending ? (
            <div className="flex justify-start">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                กำลังคิดคำตอบ...
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4">
          {error ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <textarea
              data-testid="chat-input"
              value={input}
              onChange={(event) => handleInput(event.target.value)}
              onInput={(event) => handleInput(event.currentTarget.value)}
              placeholder="พิมพ์ข้อความทดสอบ เช่น BU Wi-Fi ใช้ยังไง"
              rows={2}
              className="min-h-[48px] flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-bu-ink outline-none transition focus:border-bu-purple focus:ring-2 focus:ring-bu-purple/15"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
            />
            <button
              type="submit"
              data-testid="chat-send"
              disabled={!canSend}
              className="h-12 rounded-md bg-bu-purple px-5 text-sm font-semibold text-white transition hover:bg-[#3a0f70] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Send
            </button>
          </div>
          <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.55fr)_auto]">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700"
            />
            <input
              type="text"
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              placeholder="Course name"
              className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-bu-ink outline-none transition focus:border-bu-purple focus:ring-2 focus:ring-bu-purple/15"
            />
            <button
              type="button"
              onClick={() => void uploadStudyFile()}
              disabled={!canUpload}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Upload
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
