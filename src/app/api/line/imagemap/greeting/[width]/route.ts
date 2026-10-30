import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const allowedWidths = new Set([240, 300, 460, 700, 1040]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ width: string }> }
) {
  const { width: rawWidth } = await params;
  const width = Number(rawWidth);

  if (!allowedWidths.has(width)) {
    return NextResponse.json({ error: "Unsupported imagemap width" }, { status: 404 });
  }

  const sourcePath = path.join(process.cwd(), "public", "Greeting-hero-fixed.png");
  const source = await readFile(sourcePath);
  const image = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .png()
    .toBuffer();

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Cache-Control": "public, max-age=86400, immutable",
      "Content-Type": "image/png"
    }
  });
}
