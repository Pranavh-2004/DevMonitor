import { NextResponse } from "next/server";

interface FeedItem {
  title: string;
  description: string;
  link: string;
  category: string;
  pubDate: string;
}

export async function GET() {
  try {
    const res = await fetch("https://www.anthropic.com/news", {
      next: { revalidate: 900 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
    });

    if (!res.ok) throw new Error(`Anthropic news returned ${res.status}`);

    const html = await res.text();
    const items = parseAnthropicNews(html);

    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function parseAnthropicNews(html: string): FeedItem[] {
  const items: FeedItem[] = [];
  const seen = new Set<string>();

  // Find all FeaturedGrid article blocks:
  // <a href="/news/slug" class="FeaturedGrid-...">
  //   <span class="caption bold">Category</span>
  //   <time ...>Date</time>
  //   <p class="body-3 serif ...body">Description</p>
  const featuredRegex =
    /<a\s+href="(\/news\/[^"]+)"[^>]*class="[^"]*FeaturedGrid[^"]*"[^>]*>([\s\S]*?)(?=<\/a>)/g;
  let match;

  while ((match = featuredRegex.exec(html)) !== null) {
    const slug = match[1];
    const block = match[2];

    if (seen.has(slug)) continue;
    seen.add(slug);

    const category = extractContent(block, /<span[^>]*class="caption bold"[^>]*>\s*([\s\S]*?)\s*<\/span>/);
    const date = extractContent(block, /<time[^>]*>\s*([\s\S]*?)\s*<\/time>/);
    const description = extractContent(block, /<p[^>]*class="[^"]*body[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/);
    // Title for featured item is in <h2> or infer from slug
    const h2Title = extractContent(block, /<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/);

    const title = h2Title || slugToTitle(slug);

    if (title) {
      items.push({
        title: cleanText(title),
        description: cleanText(description || ""),
        link: `https://www.anthropic.com${slug}`,
        category: cleanText(category || "Update"),
        pubDate: formatDate(cleanText(date || "")),
      });
    }
  }

  // Also parse PublicationList items:
  // <a href="/news/slug" class="PublicationList-...listItem">
  //   <time>Date</time>
  //   <span class="...subject">Category</span>
  //   <span class="...title">Title</span>
  const listRegex =
    /<a\s+href="(\/news\/[^"]+)"[^>]*class="[^"]*PublicationList[^"]*listItem[^"]*"[^>]*>([\s\S]*?)(?=<\/a>)/g;

  while ((match = listRegex.exec(html)) !== null && items.length < 15) {
    const slug = match[1];
    const block = match[2];

    if (seen.has(slug)) continue;
    seen.add(slug);

    const date = extractContent(block, /<time[^>]*>\s*([\s\S]*?)\s*<\/time>/);
    const category = extractContent(block, /<span[^>]*class="[^"]*subject[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/);
    const title = extractContent(block, /<span[^>]*class="[^"]*title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/);

    if (title || slug) {
      items.push({
        title: cleanText(title || slugToTitle(slug)),
        description: "",
        link: `https://www.anthropic.com${slug}`,
        category: cleanText(category || "Update"),
        pubDate: formatDate(cleanText(date || "")),
      });
    }
  }

  items.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return items.slice(0, 10);
}

function extractContent(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match ? match[1] : null;
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugToTitle(slug: string): string {
  return slug
    .replace("/news/", "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}
