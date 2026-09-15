import { NextRequest, NextResponse } from "next/server";

interface ArxivPaper {
  id: string;
  title: string;
  authors: string;
  summary?: string;
  published: string;
  category: string;
  link: string;
}

const MAX_RESULTS = 15;
const DEFAULT_CATEGORY = "cs.AI";

// arXiv archive/category identifiers only (e.g. cs.AI, math.ST, econ.EM).
const VALID_CATEGORY = /^[a-z-]+(\.[A-Za-z-]+)?$/;

// arXiv asks automated clients to identify themselves.
const USER_AGENT =
  "DevMonitor/0.1 (+https://github.com/Sampriti2803/DevMonitor)";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("category") || DEFAULT_CATEGORY;
  const category = VALID_CATEGORY.test(requested) ? requested : DEFAULT_CATEGORY;

  const errors: string[] = [];

  // The Atom API (export.arxiv.org/api/query) rate-limits shared/cloud IPs
  // hard enough that it returns a persistent 429, so the RSS feed is primary.
  for (const source of [fetchFromRss, fetchFromAtomApi]) {
    try {
      const papers = await source(category);
      if (papers.length > 0) return NextResponse.json(papers);
      errors.push(`${source.name}: no entries`);
    } catch (err) {
      errors.push(
        `${source.name}: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  return NextResponse.json(
    { error: `Could not reach arXiv (${errors.join("; ")})` },
    { status: 502 }
  );
}

/* ---------------------------------------------------------------- RSS feed */

async function fetchFromRss(category: string): Promise<ArxivPaper[]> {
  const res = await fetch(`https://rss.arxiv.org/rss/${category}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml" },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`RSS feed returned ${res.status}`);

  return parseArxivRSS(await res.text());
}

function parseArxivRSS(xml: string): ArxivPaper[] {
  const fresh: ArxivPaper[] = [];
  const revised: ArxivPaper[] = [];
  const seen = new Set<string>();

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const title = clean(extractTag(item, "title"));
    if (!title) continue;

    const link = clean(extractTag(item, "link"));
    const guid = clean(extractTag(item, "guid"));
    // guid looks like "oai:arXiv.org:2609.13356v1"
    const id = guid.split(":").pop() || link;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    // Description is "arXiv:<id> Announce Type: new \nAbstract: <text>"
    const rawDescription = clean(extractTag(item, "description"));
    const summary = rawDescription
      .replace(/^arXiv:\S+\s*/i, "")
      .replace(/Announce Type:\s*\S+\s*/i, "")
      .replace(/^Abstract:\s*/i, "")
      .trim();

    const authors = clean(extractTag(item, "dc:creator"))
      .split(/,\s*/)
      .filter(Boolean);

    const paper: ArxivPaper = {
      id,
      title,
      authors: formatAuthors(authors),
      summary: summary.slice(0, 200) || undefined,
      published: toISODate(clean(extractTag(item, "pubDate"))),
      category: clean(extractTag(item, "category")),
      link: link || `https://arxiv.org/abs/${id}`,
    };

    // "replace" entries are revisions of older papers - keep them last.
    const announceType = clean(extractTag(item, "arxiv:announce_type"));
    (announceType.startsWith("replace") ? revised : fresh).push(paper);

    if (fresh.length >= MAX_RESULTS) break;
  }

  return [...fresh, ...revised].slice(0, MAX_RESULTS);
}

/* --------------------------------------------------------- Atom API (fallback) */

async function fetchFromAtomApi(category: string): Promise<ArxivPaper[]> {
  const url =
    `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(category)}` +
    `&sortBy=submittedDate&sortOrder=descending&start=0&max_results=${MAX_RESULTS}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Atom API returned ${res.status}`);

  return parseArxivXML(await res.text());
}

function parseArxivXML(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const id = clean(extractTag(entry, "id"));
    const title = clean(extractTag(entry, "title"));
    if (!title) continue;

    const summary = clean(extractTag(entry, "summary"));
    const published = clean(extractTag(entry, "published")).split("T")[0];

    const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/g;
    const authors: string[] = [];
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(clean(authorMatch[1]));
    }

    const catMatch = entry.match(/arxiv:primary_category[^>]*term="([^"]+)"/);
    const linkMatch = entry.match(
      /<link[^>]*href="(https?:\/\/arxiv\.org\/abs\/[^"]+)"/
    );

    papers.push({
      id,
      title,
      authors: formatAuthors(authors),
      summary: summary.slice(0, 200) || undefined,
      published,
      category: catMatch ? catMatch[1] : "",
      link: linkMatch ? linkMatch[1] : id,
    });
  }

  return papers;
}

/* ------------------------------------------------------------------ helpers */

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(String.raw`<${tag}(?:\s[^>]*)?>([\s\S]*?)</${tag}>`, "i")
  );
  return match ? match[1] : null;
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "";
  return (
    authors.slice(0, 3).join(", ") +
    (authors.length > 3 ? ` +${authors.length - 3}` : "")
  );
}

function toISODate(value: string): string {
  const date = new Date(value);
  return isNaN(date.getTime())
    ? value.split("T")[0]
    : date.toISOString().split("T")[0];
}

// Strip CDATA wrappers, decode XML entities and collapse whitespace.
function clean(value: string | null): string {
  if (!value) return "";
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" does not become "<"
}
