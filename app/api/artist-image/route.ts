import { NextResponse } from "next/server";
import { artistImageUrl, isMusicSummary } from "@/lib/images/artist";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = params.get("name")?.trim();
  const hint = params.get("hint")?.trim() || "musician";
  if (!name || name.length > 150 || hint.length > 300)
    return NextResponse.json({ url: null }, { status: 400 });
  try {
    async function summary(title: string) {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        {signal:AbortSignal.timeout(2500),next:{revalidate:86400}},
      );
      return response.ok ? response.json() : null;
    }
    // Names such as Future, Air and Train also name non-musical articles.
    let data = await summary(name);
    if (!isMusicSummary(data)) {
      const search = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + " " + hint)}&format=json&srlimit=1`,
        {signal:AbortSignal.timeout(2000),next:{revalidate:86400}},
      );
      const title = search.ok ? (await search.json())?.query?.search?.[0]?.title : null;
      data = typeof title === "string" ? await summary(title) : null;
    }
    return NextResponse.json(
      { url: isMusicSummary(data) ? artistImageUrl(data?.thumbnail?.source) : null },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch { return NextResponse.json({ url: null }); }
}
