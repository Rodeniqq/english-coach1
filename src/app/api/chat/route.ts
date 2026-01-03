import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: Msg[] };
    const messagesRaw = body.messages ?? [];

    // ✅ Sanitize básico (solo roles válidos + content string)
    const messages: Msg[] = messagesRaw
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta OPENAI_API_KEY" }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";

    // ✅ Instrucciones desde Vercel (tu prompt “friendly V2”)
    const instructions =
      process.env.COACH_INSTRUCTIONS ||
      "Eres un tutor de inglés cercano y motivador. Responde en micro-pasos (máximo 2 preguntas por turno).";

    const client = new OpenAI({ apiKey });

    // ✅ Si es primera interacción (solo 1 mensaje del user), fuerza bienvenida breve
    const isFirstTurn = messages.length <= 1;

    const response = await client.responses.create({
      model,
      // ✅ CAPA de longitud para evitar “ladrillos”
      max_output_tokens: isFirstTurn ? 260 : 350,

      input: [
        { role: "developer", content: instructions },

        // ✅ Empujón de estilo SOLO al inicio (opcional pero ayuda muchísimo)
        ...(isFirstTurn
          ? [
              {
                role: "developer",
                content:
                  "INICIO: Sé ultra breve, cálido y motivador. Haz solo 2 preguntas. No entregues tests largos ni planes extensos.",
              },
            ]
          : []),

        ...messages,
      ],
    });

    return NextResponse.json({ reply: response.output_text ?? "" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
