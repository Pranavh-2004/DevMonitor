import { NextResponse } from "next/server";

// Cache the assembled response for 30 minutes (the dataset is republished ~daily)
export const revalidate = 1800;

interface LeaderboardModel {
    rank: number;
    name: string;
    creator: string;
    score: number;       // Arena rating
    votes: number;
    context_window: number | null;
    input_price: number | null;
    output_price: number | null;
}

interface CategoryData {
    models: LeaderboardModel[];
    updated: string; // e.g. "1 day ago"
}

interface ArenaRow {
    model_name: string;
    organization: string;
    rating: number;
    vote_count: number;
    rank: number;
    category: string;
    leaderboard_publish_date: string;
}

// lmarena.ai / arena.ai sit behind a Cloudflare bot check, so scraping the site no longer works.
// The official Hugging Face dataset publishes the same leaderboards as structured data.
const DATASET = "lmarena-ai/leaderboard-dataset";
const ROWS_URL = "https://datasets-server.huggingface.co/rows";
const TOP_N = 10;

// key = widget tab key (also used for the arena.ai link), config = HF dataset config
const CATEGORIES = [
    { key: "text", label: "Text", config: "text" },
    { key: "webdev", label: "WebDev", config: "webdev" },
    { key: "vision", label: "Vision", config: "vision" },
    { key: "document", label: "Document", config: "document" },
    { key: "text-to-image", label: "Txt→Img", config: "text_to_image" },
    { key: "image-edit", label: "Img Edit", config: "image_edit" },
    { key: "search", label: "Search", config: "search" },
    { key: "text-to-video", label: "Txt→Vid", config: "text_to_video" },
    { key: "image-to-video", label: "Img→Vid", config: "image_to_video" },
    { key: "video-edit", label: "Vid Edit", config: "video_edit" },
];

// Dataset organization slugs → display names used by the widget's colour map
const ORG_NAMES: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    xai: "xAI",
    deepseek: "DeepSeek",
    meta: "Meta",
    mistral: "Mistral",
    alibaba: "Alibaba",
    cohere: "Cohere",
    microsoft: "Microsoft",
    zhipu: "Zhipu",
    "z.ai": "Zhipu",
    baidu: "Baidu",
    amazon: "Amazon",
    moonshot: "Moonshot",
    bytedance: "ByteDance",
    minimax: "MiniMax",
    nvidia: "NVIDIA",
    stepfun: "StepFun",
    tencent: "Tencent",
    xiaomi: "Xiaomi",
};

function creatorName(org: string | null | undefined): string {
    if (!org) return "Other";
    const key = org.toLowerCase();
    return ORG_NAMES[key] ?? org.charAt(0).toUpperCase() + org.slice(1);
}

function relativeDate(isoDate: string): string {
    const published = new Date(`${isoDate}T00:00:00Z`).getTime();
    if (Number.isNaN(published)) return "";
    const days = Math.floor((Date.now() - published) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "1 day ago";
    if (days < 14) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
}

async function fetchRows(config: string): Promise<ArenaRow[]> {
    // Ask for a few extra rows: the "overall" ranking comes first in each split,
    // followed by sub-category rankings which we filter out.
    const url = `${ROWS_URL}?dataset=${encodeURIComponent(DATASET)}&config=${config}&split=latest&offset=0&length=${TOP_N + 10}`;

    // The datasets-server occasionally returns transient errors, so retry once
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate } });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json.rows)) return json.rows.map((r: { row: ArenaRow }) => r.row);
            }
        } catch {
            // fall through to retry
        }
    }
    throw new Error(`Failed to fetch leaderboard rows for ${config}`);
}

async function fetchCategory(config: string): Promise<CategoryData> {
    const rows = await fetchRows(config);
    const models = rows
        .filter((r) => r.category === "overall" && r.rank != null && r.rating != null)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, TOP_N)
        .map<LeaderboardModel>((r) => ({
            rank: Math.round(r.rank),
            name: r.model_name,
            creator: creatorName(r.organization),
            score: Math.round(r.rating),
            votes: Math.round(r.vote_count ?? 0),
            context_window: null,
            input_price: null,
            output_price: null,
        }));

    return { models, updated: rows[0] ? relativeDate(rows[0].leaderboard_publish_date) : "" };
}

async function fetchArenaLeaderboards(): Promise<Record<string, CategoryData>> {
    const results = await Promise.allSettled(CATEGORIES.map((c) => fetchCategory(c.config)));

    const categories: Record<string, CategoryData> = {};
    results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.models.length > 0) {
            categories[CATEGORIES[i].key] = result.value;
        } else if (result.status === "rejected") {
            console.error(result.reason);
        }
    });
    return categories;
}

// "Claude Opus 5.5 (Max)" → "claude-opus-5.5"
function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/\(.*?\)/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

// Enrich models with live pricing and context from OpenRouter
async function enrichAllWithOpenRouter(
    categories: Record<string, CategoryData>
): Promise<Record<string, CategoryData>> {
    try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { Accept: "application/json" },
            next: { revalidate },
        });
        if (!res.ok) return categories;
        const raw = await res.json();
        if (!raw.data || !Array.isArray(raw.data)) return categories;

        const bySlug = new Map<string, any>();
        for (const or of raw.data) {
            const slug = (or.id || "").toLowerCase().split("/").pop();
            if (slug && !bySlug.has(slug)) bySlug.set(slug, or);
        }

        const enrichModel = (model: LeaderboardModel): LeaderboardModel => {
            const orMatch = bySlug.get(slugify(model.name));
            if (!orMatch) return model;
            return {
                ...model,
                context_window: orMatch.context_length || null,
                input_price: orMatch.pricing?.prompt ? parseFloat(orMatch.pricing.prompt) * 1_000_000 : null,
                output_price: orMatch.pricing?.completion ? parseFloat(orMatch.pricing.completion) * 1_000_000 : null,
            };
        };

        const enriched: Record<string, CategoryData> = {};
        for (const [key, data] of Object.entries(categories)) {
            enriched[key] = { ...data, models: data.models.map(enrichModel) };
        }
        return enriched;
    } catch (err) {
        console.error("OpenRouter enrichment failed", err);
        return categories;
    }
}

export async function GET() {
    try {
        const categories = await fetchArenaLeaderboards();

        if (Object.keys(categories).length > 0) {
            const enriched = await enrichAllWithOpenRouter(categories);
            return NextResponse.json({
                categories: enriched,
                categoryOrder: CATEGORIES.filter((c) => c.key in enriched).map((c) => ({
                    key: c.key,
                    label: c.label,
                })),
                source: "arena-hf-dataset",
            });
        }
    } catch (err) {
        console.error("Failed to fetch arena leaderboard:", err);
    }

    return NextResponse.json(
        {
            categories: {},
            categoryOrder: [],
            source: "error",
            error: "Could not fetch live leaderboard data",
        },
        { status: 502 }
    );
}
    