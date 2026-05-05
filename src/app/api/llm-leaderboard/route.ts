import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface LeaderboardModel {
    rank: number;
    name: string;
    creator: string;
    score: number;       // Arena ELO score
    votes: number;
    context_window: number | null;
    input_price: number | null;
    output_price: number | null;
}

interface CategoryData {
    models: LeaderboardModel[];
    updated: string; // e.g. "1 day ago"
}

// Infer the creator/company from the model name
function inferCreator(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("claude") || n.includes("sonnet") || n.includes("opus") || n.includes("haiku")) return "Anthropic";
    if (n.includes("gpt") || n.startsWith("o1") || n.startsWith("o3") || n.startsWith("o4") || n.includes("chatgpt")) return "OpenAI";
    if (n.includes("gemini") || n.includes("gemma")) return "Google";
    if (n.includes("grok")) return "xAI";
    if (n.includes("deepseek")) return "DeepSeek";
    if (n.includes("llama")) return "Meta";
    if (n.includes("mistral") || n.includes("magistral")) return "Mistral";
    if (n.includes("qwen") || n.includes("qwq")) return "Alibaba";
    if (n.includes("command") || n.includes("aya")) return "Cohere";
    if (n.includes("phi-")) return "Microsoft";
    if (n.includes("glm")) return "Zhipu";
    if (n.includes("ernie")) return "Baidu";
    if (n.includes("nova-") || n.includes("amazon")) return "Amazon";
    if (n.includes("kimi")) return "Moonshot";
    if (n.includes("dola-seed")) return "ByteDance";
    if (n.includes("minimax")) return "MiniMax";
    if (n.includes("nemotron") || n.includes("nvidia")) return "NVIDIA";
    if (n.includes("step-")) return "StepFun";
    if (n.includes("hunyuan")) return "Tencent";
    return "Other";
}

// Categories to parse from the lmarena.ai overview page
const CATEGORIES = [
    { key: "text", label: "Text", mdLabel: "Text", slug: "text" },
    { key: "code", label: "Code", mdLabel: "Code", slug: "code" },
    { key: "vision", label: "Vision", mdLabel: "Vision", slug: "vision" },
    { key: "document", label: "Document", mdLabel: "Document", slug: "document" },
    { key: "text-to-image", label: "Txt→Img", mdLabel: "Text-to-Image", slug: "text-to-image" },
    { key: "image-edit", label: "Img Edit", mdLabel: "Image Edit", slug: "image-edit" },
    { key: "search", label: "Search", mdLabel: "Search", slug: "search" },
    { key: "text-to-video", label: "Txt→Vid", mdLabel: "Text-to-Video", slug: "text-to-video" },
    { key: "image-to-video", label: "Img→Vid", mdLabel: "Image-to-Video", slug: "image-to-video" },
    { key: "video-edit", label: "Vid Edit", mdLabel: "Video Edit", slug: "video-edit" },
];

// Parse a single category block from the markdown
function parseCategoryBlock(text: string, mdLabel: string, slug: string): { models: LeaderboardModel[]; updated: string } {
    const escapedLabel = mdLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Current format (2026-05): entire section is a single-line H2 link:
    //   ## [Text 2 days ago View | Rank | Model | Score | | --- | --- | --- | | 1 | [name](url) | 1503 | ...](url)
    // Match the whole line starting with ## [Label
    const lineRegex = new RegExp(`## \\[${escapedLabel}\\s[^\\n]*`, "i");
    const match = text.match(lineRegex);

    if (!match) return { models: [], updated: "" };
    const block = match[0];

    const updatedMatch = block.match(/(\d+\s*(?:day|hour|minute|week)s?\s*ago)/i);
    const updated = updatedMatch ? updatedMatch[1] : "";

    const models: LeaderboardModel[] = [];

    // Format: | rank | [name](url "title") | score |  (no votes column)
    // .+? instead of [^\]]+ to handle nested brackets e.g. [web-search] in model names
    // [^|]* instead of [^)]* to handle parens in URL titles e.g. "gpt-image-2 (medium)"
    const tableRowRegex = /\|\s*(\d{1,2})\s*\|\s*\[(.+?)\]\([^|]*\)\s*\|\s*(\d{3,4})\s*\|/g;
    let rowMatch;
    while ((rowMatch = tableRowRegex.exec(block)) !== null && models.length < 10) {
        const rank = parseInt(rowMatch[1], 10);
        const name = rowMatch[2].trim();
        const score = parseInt(rowMatch[3], 10);

        if (name && score > 1000 && score < 2000 && rank >= 1 && rank <= 10) {
            models.push({
                rank,
                name,
                creator: inferCreator(name),
                score,
                votes: 0,
                context_window: null,
                input_price: null,
                output_price: null,
            });
        }
    }

    return { models, updated };
}

// Fetch all leaderboard categories via Jina Reader
async function fetchArenaLeaderboards(): Promise<Record<string, CategoryData>> {
    const res = await fetch("https://r.jina.ai/https://lmarena.ai/leaderboard", {
        headers: { Accept: "text/plain" },
        cache: "no-store", // Force clear cache to debug
    });

    if (!res.ok) throw new Error(`Jina reader returned ${res.status}`);
    const text = await res.text();

    const categories: Record<string, CategoryData> = {};
    for (const cat of CATEGORIES) {
        const result = parseCategoryBlock(text, cat.mdLabel, cat.slug);
        if (result.models.length > 0) {
            categories[cat.key] = result;
        }
    }

    return categories;
}

// Enrich models with live pricing and context from OpenRouter
async function enrichAllWithOpenRouter(
    categories: Record<string, CategoryData>
): Promise<Record<string, CategoryData>> {
    try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { Accept: "application/json" },
        });
        if (!res.ok) return categories;
        const raw = await res.json();
        if (!raw.data || !Array.isArray(raw.data)) return categories;

        const enrichModel = (model: LeaderboardModel): LeaderboardModel => {
            const lowerName = model.name.toLowerCase();
            const orMatch = raw.data.find((or: any) => {
                const orId = (or.id || "").toLowerCase();
                return orId.includes(lowerName) || lowerName.includes(orId.split("/").pop() || "");
            });

            if (orMatch) {
                return {
                    ...model,
                    context_window: orMatch.context_length || null,
                    input_price: orMatch.pricing?.prompt ? parseFloat(orMatch.pricing.prompt) * 1_000_000 : null,
                    output_price: orMatch.pricing?.completion ? parseFloat(orMatch.pricing.completion) * 1_000_000 : null,
                };
            }
            return model;
        };

        const enriched: Record<string, CategoryData> = {};
        for (const [key, data] of Object.entries(categories)) {
            enriched[key] = {
                ...data,
                models: data.models.map(enrichModel),
            };
        }
        return enriched;
    } catch (err) {
        console.error("Open router enrichment failed", err);
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
                categoryOrder: CATEGORIES.filter(c => c.key in enriched).map(c => ({
                    key: c.key,
                    label: c.label,
                })),
                source: "live-arena",
            });
        }
    } catch (err) {
        console.error("Failed to fetch arena leaderboard:", err);
    }

    return NextResponse.json({
        categories: {},
        categoryOrder: [],
        source: "error",
        error: "Could not fetch live leaderboard data",
    });
}
