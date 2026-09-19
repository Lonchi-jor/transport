import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const paths = [
    "/tmp/transitlive-tunnel-url",
    join(process.cwd(), ".tunnel-url"),
  ];
  for (const path of paths) {
    try {
      const url = (await readFile(path, "utf8")).trim();
      if (url.startsWith("https://") || url.startsWith("http://")) {
        return NextResponse.json({ url });
      }
    } catch {
      /* try next */
    }
  }
  return NextResponse.json({ url: null });
}
