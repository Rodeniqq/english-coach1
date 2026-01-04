import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Msg = { role: "user" | "assistant"; content: string };
type Body = { messages?: Msg[] };

export async function POST(req: Request) {
  try {
    const { messages = [] } = (await req.json()) as Body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta OPENAI_API_KEY" }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";
    const instructions =
      process.env.COACH_INSTRUCTIONS ||
      "Eres un tutor de inglés cercano y motivador. Responde en micro-pasos (máximo 2 preguntas).";

    const client = new OpenAI({ apiKey });

    // mejor que messages.length, porque tu UI ya tiene un saludo del assistant
    const userTurns = messages.filter((m) => m.role === "user").length;
    const isFirstTurn = userTurns <= 1;

    const input = [
      { role: "developer" as const, content: instructions },
      ...(isFirstTurn
        ? [
            {
              role: "developer" as const,
              content:
                "INICIO: Sé breve, cálido y motivador. Máximo 2 preguntas. No des tests largos ni planes extensos.",
            },
          ]
        : []),
      ...messages,
    ];

    // ✅ Streaming Responses API
    const stream = await client.responses.create({
      model,
      input,
      max_output_tokens: isFirstTurn ? 260 : 350,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream as any) {
            if (event?.type === "response.output_text.delta" && event?.delta) {
              controller.enqueue(encoder.encode(event.delta));
            }
            if (event?.type === "response.completed") break;
            if (event?.type === "error") break;
          }
        } catch (e: any) {
          controller.enqueue(
            encoder.encode(`\n[stream_error] ${e?.message ?? "unknown"}\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
