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

    const stream = await client.responses.create({
      model,
      input,
      max_output_tokens: isFirstTurn ? 260 : 350,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        // primer “byte” para que el navegador empiece a renderizar
        controller.enqueue(encoder.encode(`:ok\n\n`));

        let gotDelta = false;

        try {
          for await (const event of stream as any) {
            // ✅ deltas de texto (lo normal)
            if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
              gotDelta = true;
              send({ delta: event.delta });
            }

            // ✅ fallback: algunos flujos emiten el texto final en *.done
            if (!gotDelta && event?.type === "response.output_text.done" && typeof event.text === "string") {
              send({ delta: event.text });
            }

            if (event?.type === "response.completed") break;
            if (event?.type === "error" || event?.type === "response.failed") {
              send({ error: "Error en streaming" });
              break;
            }
          }

          send({ done: true });
        } catch (e: any) {
          send({ error: e?.message ?? "stream_error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
