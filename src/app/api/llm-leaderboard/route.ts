import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface LeaderboardModel {
    rank: number;
    name: string;
    creator: string;
    score: number;      // Arena ELO score
    ci: number | null;  // +/- confidence interval on the score
    context_window: number | null;
    input_price: number | null;
    output_price: number | null;
}

interface CategoryData {
    models: LeaderboardModel[];
}

interface CategoryMeta {
    key: string;
    label: string;
    url: string;
}

// Infer the creator/company from the model name
function inferCreator(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("claude") || n.includes("sonnet") || n.includes("opus") || n.includes("haiku") || n.includes("fable")) return "Anthropic";
    if (n.includes("gpt") || n.startsWith("o1") || n.startsWith("o3") || n.startsWith("o4") || n.includes("chatgpt") || n.includes("codex") || n.includes("sora")) return "OpenAI";
    if (n.includes("gemini") || n.includes("gemma") || n.includes("imagen") || n.includes("veo")) return "Google";
    if (n.includes("grok")) return "xAI";
    if (n.includes("deepseek")) return "DeepSeek";
    if (n.includes("llama") || n.includes("muse-")) return "Meta";
    if (n.includes("mistral") || n.includes("magistral") || n.includes("flux")) return "Mistral";
    if (n.includes("qwen") || n.includes("qwq") || n.includes("wan")) return "Alibaba";
    if (n.includes("command") || n.includes("aya")) return "Cohere";
    if (n.includes("phi-") || n.includes("mai-")) return "Microsoft";
    if (n.includes("glm")) return "Zhipu";
    if (n.includes("ernie")) return "Baidu";
    if (n.includes("nova-") || n.includes("amazon")) return "Amazon";
    if (n.includes("kimi")) return "Moonshot";
    if (n.includes("seed") || n.includes("doubao") || n.includes("dreamina")) return "ByteDance";
    if (n.includes("minimax")) return "MiniMax";
    if (n.includes("nemotron") || n.includes("nvidia")) return "NVIDIA";
    if (n.includes("step-")) return "StepFun";
    if (n.includes("hunyuan")) return "Tencent";
    if (n.includes("kling")) return "Kuaishou";
    if (n.includes("runway")) return "Runway";
    if (n.includes("reve-")) return "Reve";
    if (n.includes("hidream")) return "HiDream";
    return "Other";
}

// Preferred tab order; anything the page adds later is appended after these.
const CATEGORY_ORDER = [
    "text",
    "code-webdev",
    "code-image-to-webdev",
    "vision",
    "document",
    "search",
    "text-to-image",
    "image-edit",
    "text-to-video",
    "image-to-video",
    "video-edit",
];

// Shorter tab labels where the page's own label is too long for the card.
const SHORT_LABELS: Record<string, string> = {
    "code-webdev": "WebDev",
    "code-image-to-webdev": "Img→Web",
    "text-to-image": "Txt→Img",
    "image-edit": "Img Edit",
    "text-to-video": "Txt→Vid",
    "image-to-video": "Img→Vid",
    "video-edit": "Vid Edit",
};

/* -------------------------------------------------------------- scraping */

// Each leaderboard section on the overview page renders as one H2 link, e.g.
//   ## [Text 🏆Overall 1 claude-fable-5 1506±5 2 ... View all](https://lmarena.ai/leaderboard/text)
const SECTION_RE =
    /^## \[([^\n]*?)\]\((https:\/\/lmarena\.ai\/leaderboard[^)\n]*)\)\s*$/gm;

// One ranked row: "<rank> <name> <score><uncertainty>". The name may contain
// spaces, parens or bracket tags, and the score may run straight into it
// ("gpt-image-2 (medium)1381±4"). Uncertainty is "±4" or "+16/-16".
const ENTRY_RE =
    /(\d{1,2})\s+(.+?)\s*(\d{3,4})\s*(?:±\s*(\d+(?:\.\d+)?)|\+\s*(\d+)\s*\/\s*-\s*\d+)/g;

const MIN_SCORE = 500;
const MAX_SCORE = 3000;
const MODELS_PER_CATEGORY = 10;

function parseSection(content: string): { models: LeaderboardModel[]; label: string } {
    const models: LeaderboardModel[] = [];
    let firstEntryIndex = content.length;

    ENTRY_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ENTRY_RE.exec(content)) !== null) {
        const rank = parseInt(match[1], 10);
        const name = match[2].trim();
        const score = parseInt(match[3], 10);
        const ci = match[4] ?? match[5];

        // Rows are always a contiguous 1..10 run, so a rank that breaks the
        // sequence is stray text that merely looks like a row - skip it.
        if (rank !== models.length + 1) continue;
        if (score < MIN_SCORE || score > MAX_SCORE) continue;
        if (!name || name.length > 80 || !/[a-z]/i.test(name)) continue;

        if (models.length === 0) firstEntryIndex = match.index;

        models.push({
            rank,
            name,
            creator: inferCreator(name),
            score,
            ci: ci !== undefined ? Math.round(parseFloat(ci)) : null,
            context_window: null,
            input_price: null,
            output_price: null,
        });

        if (models.length >= MODELS_PER_CATEGORY) break;
    }

    // The label is whatever precedes the first row, minus the "🏆Overall"
    // sub-leaderboard note the page appends to some sections.
    const label = content.slice(0, firstEntryIndex).split("🏆")[0].trim();

    return { models, label };
}

function keyFromUrl(url: string): string {
    const slug = url
        .replace(/^https:\/\/lmarena\.ai\/leaderboard\/?/, "")
        .replace(/\/+$/, "");
    return slug ? slug.replace(/\//g, "-") : "overall";
}

// Fetch the overview page as markdown via Jina Reader and parse every section.
async function fetchArenaLeaderboards(): Promise<{
    categories: Record<string, CategoryData>;
    order: CategoryMeta[];
}> {
    const res = await fetch("https://r.jina.ai/https://lmarena.ai/leaderboard", {
        headers: { Accept: "text/plain" },
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Jina reader returned ${res.status}`);

    const text = await res.text();
    const categories: Record<string, CategoryData> = {};
    const found: CategoryMeta[] = [];

    SECTION_RE.lastIndex = 0;
    let section: RegExpExecArray | null;

    while ((section = SECTION_RE.exec(text)) !== null) {
        const [, content, url] = section;
        const { models, label } = parseSection(content);

        // Sections with no ELO rows (e.g. Agent, scored as a win-rate
        // percentage) are skipped so the ELO column stays meaningful.
        if (models.length === 0) continue;

        const key = keyFromUrl(url);
        if (categories[key]) continue;

        categories[key] = { models };
        found.push({ key, label: SHORT_LABELS[key] || label || key, url });
    }

    const order = found.sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a.key);
        const bi = CATEGORY_ORDER.indexOf(b.key);
        return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi);
    });

    return { categories, order };
}

/* ------------------------------------------------- OpenRouter enrichment */

const EFFORT_SUFFIXES =
    /-(max|xhigh|high|medium|low|minimal|thinking|reasoning|preview|latest|search|grounding|batch|free|chat|instruct|it)(?=-|$)/g;

// Reduce an Arena display name or an OpenRouter id to a comparable slug:
// "claude-opus-4-6-high" and "anthropic/claude-opus-4.6" both -> "claude-opus-4.6"
function normalizeModelName(name: string): string {
    let slug = name
        .toLowerCase()
        .replace(/\[[^\]]*\]/g, " ")   // bracket tags, e.g. [web-search]
        .replace(/\([^)]*\)/g, " ")    // parenthetical notes, e.g. (medium)
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "");

    // Arena writes version numbers with dashes ("4-6"), OpenRouter with dots.
    let previous: string;
    do {
        previous = slug;
        slug = slug.replace(/(\d)-(\d)/g, "$1.$2");
    } while (slug !== previous);

    return slug
        .replace(EFFORT_SUFFIXES, "")
        .replace(/-\d{4,8}$/, "")      // dated snapshots, e.g. -0902, -20260811
        .replace(/^-+|-+$/g, "");
}

function normalizeOpenRouterId(id: string): string {
    const slug = id.replace(/^~/, "").split("/").pop() || "";
    return normalizeModelName(slug.split(":")[0]);
}

interface OpenRouterModel {
    id?: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
}

// OpenRouter ids are "<vendor>/<model>", which beats guessing from the name.
const VENDOR_NAMES: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    "x-ai": "xAI",
    deepseek: "DeepSeek",
    "meta-llama": "Meta",
    meta: "Meta",
    mistralai: "Mistral",
    qwen: "Alibaba",
    alibaba: "Alibaba",
    cohere: "Cohere",
    microsoft: "Microsoft",
    "z-ai": "Zhipu",
    baidu: "Baidu",
    amazon: "Amazon",
    moonshotai: "Moonshot",
    bytedance: "ByteDance",
    minimax: "MiniMax",
    nvidia: "NVIDIA",
    stepfun: "StepFun",
    tencent: "Tencent",
};

function creatorFromOpenRouterId(id: string | undefined): string | null {
    if (!id) return null;
    const vendor = id.replace(/^~/, "").split("/")[0].toLowerCase();
    return VENDOR_NAMES[vendor] || null;
}

function perMillion(value: string | undefined): number | null {
    if (value === undefined) return null;
    const parsed = parseFloat(value);
    if (!isFinite(parsed) || parsed < 0) return null;
    // Round away float noise, e.g. 13.282724250000001
    return Math.round(parsed * 1_000_000 * 10000) / 10000;
}

async function enrichAllWithOpenRouter(
    categories: Record<string, CategoryData>
): Promise<Record<string, CategoryData>> {
    try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { Accept: "application/json" },
            next: { revalidate: 3600 },
        });
        if (!res.ok) return categories;

        const raw = await res.json();
        if (!Array.isArray(raw?.data)) return categories;

        // Index base models only - ":batch"/":free" variants and "~" aliases
        // duplicate a base entry with different pricing.
        const bySlug = new Map<string, OpenRouterModel>();
        for (const model of raw.data as OpenRouterModel[]) {
            const id = model.id;
            if (!id || id.startsWith("~") || id.includes(":")) continue;
            const slug = normalizeOpenRouterId(id);
            if (slug && !bySlug.has(slug)) bySlug.set(slug, model);
        }

        // Exact match on the normalized slug only. Fuzzy prefix matching was
        // tried and mostly produced wrong pairings ("gemini-3-pro-grounding"
        // onto an image model), and a wrong price is worse than a blank one.
        const findMatch = (name: string): OpenRouterModel | undefined => {
            const slug = normalizeModelName(name);
            return slug ? bySlug.get(slug) : undefined;
        };

        const enriched: Record<string, CategoryData> = {};
        for (const [key, data] of Object.entries(categories)) {
            enriched[key] = {
                models: data.models.map((model) => {
                    const match = findMatch(model.name);
                    if (!match) return model;
                    return {
                        ...model,
                        creator: creatorFromOpenRouterId(match.id) || model.creator,
                        context_window: match.context_length ?? null,
                        input_price: perMillion(match.pricing?.prompt),
                        output_price: perMillion(match.pricing?.completion),
                    };
                }),
            };
        }
        return enriched;
    } catch (err) {
        console.error("OpenRouter enrichment failed:", err);
        return categories;
    }
}

/* ------------------------------------------------------------------ route */

export async function GET() {
    try {
        const { categories, order } = await fetchArenaLeaderboards();

        if (order.length > 0) {
            return NextResponse.json({
                categories: await enrichAllWithOpenRouter(categories),
                categoryOrder: order,
                source: "live-arena",
            });
        }

        console.error("Arena leaderboard page parsed to zero categories");
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
