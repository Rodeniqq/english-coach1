"use client";

import { useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! I’m your English Coach. Tell me what you want to practice today.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading]
  );

  async function send() {
    if (!canSend) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Msg = { role: "user", content: input.trim() };
    const nextWithUser = [...messages, userMsg];

    // Placeholder del assistant para ir llenándolo
    setMessages([...nextWithUser, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      // Enviamos mensajes reales (sin el placeholder vacío)
      const payloadMessages = nextWithUser.filter((m) => m.content?.trim().length > 0);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errText = `API error (${res.status})`;
        try {
          const j = await res.json();
          errText = j?.error ? JSON.stringify(j.error) : errText;
        } catch {}
        throw new Error(errText);
      }

      if (!res.body) throw new Error("No stream body returned");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";
      let buffer = "";

      const pushAssistant = (text: string) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          if (last >= 0 && copy[last].role === "assistant") {
            copy[last] = { role: "assistant", content: text };
          }
          return copy;
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE por bloques separados por "\n\n"
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          // Ignora comentarios SSE (líneas que empiezan con :)
          if (chunk.startsWith(":")) continue;

          // Extrae líneas "data: ..."
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr) continue;

            const data = JSON.parse(dataStr);

            if (data.error) {
              throw new Error(data.error);
            }

            if (typeof data.delta === "string") {
              assistantText += data.delta;
              pushAssistant(assistantText);
            }

            if (data.done) {
              // terminado
              break;
            }
          }
        }
      }

      if (!assistantText.trim()) {
        pushAssistant("…");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;

      setMessages((prev) => {
        const copy = [...prev];
        const last = copy.length - 1;
        if (last >= 0 && copy[last].role === "assistant" && copy[last].content === "") {
          copy[last] = { role: "assistant", content: `Error: ${e?.message ?? "falló"}` };
          return copy;
        }
        return [...copy, { role: "assistant", content: `Error: ${e?.message ?? "falló"}` }];
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
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
                  "inline-block max-w-[85%] rounded-2xl px-4 py-2 whitespace-pre-wrap " +
                  (m.role === "user" ? "bg-white text-black" : "bg-white/10 text-white")
                }
              >
                {m.content || (m.role === "assistant" && loading && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}
          {loading && <div className="text-white/50 text-sm">Streaming…</div>}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-xl bg-white/10 border border-white/10 px-4 py-3 outline-none"
            placeholder="Write something…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? send() : null)}
            disabled={loading}
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
