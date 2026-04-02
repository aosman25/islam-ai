import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const apiKey = process.env.AZURE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Translation service not configured" }, { status: 500 });
  }

  const res = await fetch(
    `${process.env.AZURE_TRANSLATE_BASE_URL || "https://api.cognitive.microsofttranslator.com"}/translator/text/v3.0/translate?from=ar&to=en`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Ocp-Apim-Subscription-Region": process.env.AZURE_TRANSLATE_REGION || "eastus",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ Text: text }]),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "Translation failed", details: err }, { status: res.status });
  }

  const data = await res.json();
  const translated = data[0]?.translations?.[0]?.text ?? "";

  return NextResponse.json({ translated });
}
