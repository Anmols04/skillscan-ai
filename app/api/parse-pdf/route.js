// app/api/parse-pdf/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // pdf-parse needs Node.js, not edge

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Use the internal path to avoid pdf-parse test file issues on Vercel
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract text. PDF may be a scanned image — please paste the text manually." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: data.text, pages: data.numpages, chars: data.text.length });
  } catch (err) {
    return NextResponse.json({ error: "PDF parse failed: " + err.message }, { status: 500 });
  }
}
