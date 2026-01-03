"use client";

import { useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I’m your English Coach. Tell me what you want to practice today." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function send() {
    if (!canSend) return;

    const userMsg: Msg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];

    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter(m => m.role !== "assistant" || m.content) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ? JSON.stringify(data.error) : "API error");

      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "…" }]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${e?.message ?? "no se pudo responder"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">English Coach</h1>
        <p className="text-white/60 mt-1">Practica conversación, correcciones y vocabulario.</p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  "inline-block max-w-[85%] rounded-2xl px-4 py-2 " +
                  (m.role === "user"
                    ? "bg-white text-black"
                    : "bg-white/10 text-white")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-white/50">Thinking…</div>}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-xl bg-white/10 border border-white/10 px-4 py-3 outline-none"
            placeholder="Write something…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? send() : null)}
          />
          <button
            className="rounded-xl px-4 py-3 bg-white text-black disabled:opacity-50"
            onClick={send}
            disabled={!canSend}
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
