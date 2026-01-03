import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: Msg[] };
    const messages = body.messages ?? [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta OPENAI_API_KEY" }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";

    // Responses API (recomendada para proyectos nuevos)
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "developer",
          content:
            "Eres un profesor de inglés. Corrige con tacto, explica breve y claro, y luego haz una pregunta para continuar. Si el usuario escribe en español, responde en español pero enseña inglés.",
        },
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
