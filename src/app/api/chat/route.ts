import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    // ✅ Mejor detección de “primer turno”: cuenta mensajes del usuario
    const userTurns = messages.filter((m) => m.role === "user").length;
    const isFirstTurn = userTurns <= 1;

    const input = [
      { role: "developer", content: instructions },
      ...(isFirstTurn
        ? [
            {
              role: "developer",
              content:
                "INICIO: Sé breve, cálido y motivador. Máximo 2 preguntas. No des tests largos ni planes extensos.",
            },
          ]
        : []),
      ...messages,
    ] as any;

    const response = await client.responses.create({
      model,
      max_output_tokens: isFirstTurn ? 260 : 350,
      input,
    });

    return NextResponse.json({ reply: response.output_text ?? "" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
