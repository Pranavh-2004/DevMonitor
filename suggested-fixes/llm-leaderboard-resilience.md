# Plan: Make LLM Leaderboard Resilient to Upstream Format Changes

## Context

The LLM leaderboard widget scrapes `lmarena.ai/leaderboard` via Jina Reader and parses the markdown with regex. When lmarena.ai changes their HTML/markdown format (which has happened multiple times), the regex breaks and categories silently disappear. There is no public JSON API — lmarena.ai uses Next.js SSR, so all data is embedded in the page HTML.

**Goal**: Make the scraping resilient so that format changes degrade gracefully rather than silently failing.

## Investigation Summary

- **No official API** from lmarena.ai (403 on all `/api/` routes)
- **Community alternatives** (`nakasyou/lmarena-history`) track historical scores but use different category structure (subcategories within text/vision only) and the JSON is >10MB — not a viable primary source
- **Current approach** (Jina Reader → regex) is the most practical for covering all 10 category tabs, but is fragile to format changes

## Approach: Defense-in-Depth with Caching + Flexible Parsing + Monitoring

### 1. Add server-side response caching (stale-while-revalidate)

Cache the last successful response in a module-level variable with a timestamp. When scraping fails or returns 0 categories, serve the cached data instead of an error.

**File**: `src/app/api/llm-leaderboard/route.ts`

```ts
let cachedResponse: { data: LeaderboardAPIResponse; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
```

In the `GET` handler:
- On success → update cache, return fresh data
- On failure or 0 categories → return cached data if available (with `source: "cached"`)
- Only return error if cache is also empty

### 2. Make parsing more flexible with multiple strategies

Instead of one regex, try multiple patterns in order. If the current format changes again, one of the fallback patterns may still work.

**File**: `src/app/api/llm-leaderboard/route.ts` — `parseCategoryBlock()`

Strategy chain:
1. **Current format**: `[## Label ...` (the format we just fixed)
2. **Legacy format**: `[Label ---- ...`
3. **Heading format**: `## Label\n...` (plain markdown heading)
4. **Slug-based fallback**: Search for the `View all` link containing the category slug and work backwards

Similarly for table row parsing, try the existing `| rank | name | score | votes |` regex first, then fall back to other patterns.

### 3. Add category count validation with console warnings

After parsing, log a warning if fewer categories than expected were found. This makes it immediately obvious in server logs when parsing breaks, rather than silently returning partial data.

```ts
if (Object.keys(categories).length < 5) {
    console.warn(`[llm-leaderboard] Only parsed ${Object.keys(categories).length}/${CATEGORIES.length} categories — upstream format may have changed`);
}
```

### 4. Per-category fetching as ultimate fallback

If the overview page parsing yields <3 categories, fall back to fetching individual category pages (`/leaderboard/text`, `/leaderboard/code`, etc.) via Jina Reader. This is slower (multiple requests) but more resilient since each page will always show its own data.

**File**: `src/app/api/llm-leaderboard/route.ts`

```ts
async function fetchCategoryPage(slug, mdLabel): Promise<CategoryData | null> {
    const res = await fetch(`https://r.jina.ai/https://lmarena.ai/leaderboard/${slug}`, ...);
    // parse with same strategies
}
```

Only used as fallback — the overview page fetch remains primary.

## Files to Modify

- `src/app/api/llm-leaderboard/route.ts` — all changes are in this single file

## Verification

1. Run `npm run dev` and hit `http://localhost:3000/api/llm-leaderboard`
2. Verify all 10 categories appear in the response with models populated
3. Test cache fallback: temporarily break the Jina URL and verify cached data is served
4. Check console for any category count warnings