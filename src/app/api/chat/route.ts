import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    // ✅ Tus instrucciones desde Vercel
    const instructions =
      process.env.COACH_INSTRUCTIONS ||
      "Eres un asistente experto en enseñanza de inglés. (Falta COACH_INSTRUCTIONS en Vercel).";

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model,
      input: [{ role: "developer", content: instructions }, ...messages],
    });

    return NextResponse.json({ reply: response.output_text ?? "" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
