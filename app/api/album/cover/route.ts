import { NextResponse } from "next/server";
import { z } from "zod";
import { approvedFronts } from "@/lib/images/album";
import { itunesArtworks } from "@/lib/itunes/api";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("itunes"), id: z.string().regex(/^\d{1,20}$/) }),
  z.object({ type: z.enum(["release", "release-group"]), id: z.string().uuid() }),
]);
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = schema.safeParse({ type: params.get("type"), id: params.get("id") });
  if (!parsed.success) return NextResponse.json({ covers: [] }, { status: 400 });
  try {
    const { type, id } = parsed.data;
    if (type === "itunes") return NextResponse.json({ covers: (await itunesArtworks([id])).map(cover => cover.url) });
    const response = await fetch(`https://coverartarchive.org/${type}/${id}`, { signal: AbortSignal.timeout(4500), next: { revalidate: 3600 } });
    if (response.status === 404) return NextResponse.json({ covers: [] });
    if (!response.ok) throw new Error("Cover archive unavailable");
    return NextResponse.json({ covers: approvedFronts(await response.json()) });
  } catch {
    return NextResponse.json({ covers: [], error: "No pudimos recuperar la portada." }, { status: 502 });
  }
}
