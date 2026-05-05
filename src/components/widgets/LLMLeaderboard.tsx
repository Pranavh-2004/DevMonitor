"use client";
import { useState } from "react";
import WidgetCard from "../WidgetCard";
import { useFetch } from "@/hooks/useFetch";
import styles from "./widgets.module.css";
import widgetCardStyles from "../WidgetCard.module.css";

interface LeaderboardModel {
    rank: number;
    name: string;
    creator: string;
    score: number;
    votes: number;
    context_window: number | null;
    input_price: number | null;
    output_price: number | null;
}

interface CategoryData {
    models: LeaderboardModel[];
    updated: string;
}

interface LeaderboardResponse {
    categories: Record<string, CategoryData>;
    categoryOrder: { key: string; label: string }[];
    source: string;
}

const CREATOR_COLORS: Record<string, string> = {
    OpenAI: "var(--accent-green)",
    Google: "var(--accent-blue)",
    Anthropic: "var(--accent-orange)",
    xAI: "var(--accent-red)",
    DeepSeek: "var(--accent-cyan)",
    Meta: "var(--accent-blue)",
    Mistral: "var(--accent-amber)",
    Alibaba: "var(--accent-purple)",
    Cohere: "var(--accent-purple)",
    Microsoft: "var(--accent-cyan)",
    Zhipu: "var(--accent-green)",
    Baidu: "var(--accent-red)",
    Moonshot: "var(--accent-amber)",
    ByteDance: "var(--accent-blue)",
    MiniMax: "var(--accent-purple)",
    NVIDIA: "var(--accent-green)",
    Other: "var(--text-muted)",
};



function formatCtx(ctx: number | null): string {
    if (ctx === null) return "—";
    if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M`;
    if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}k`;
    return ctx.toString();
}

function formatPrice(price: number | null): string {
    if (price === null) return "—";
    if (price < 0.1) return `$${price.toFixed(3)}`;
    if (price < 10) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(1)}`;
}

function formatVotes(votes: number): string {
    if (votes === 0) return "—";
    if (votes >= 1000) return `${(votes / 1000).toFixed(1)}k`;
    return votes.toString();
}

export default function LLMLeaderboard() {
    const [activeCategory, setActiveCategory] = useState("text");

    const { data, loading, error, lastUpdated, refresh } =
        useFetch<LeaderboardResponse>("/api/llm-leaderboard", {
            cacheKey: "llm-leaderboard-v2",
            refreshInterval: 30 * 60 * 1000, // 30 min
        });

    const categories = data?.categoryOrder || [];
    const currentData = data?.categories?.[activeCategory];
    const models = currentData?.models || [];

    return (
        <WidgetCard
            title="LLM Leaderboard"
            icon={
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 20V10" />
                    <path d="M18 20V4" />
                    <path d="M6 20v-4" />
                </svg>
            }
            accentColor="purple"
            loading={loading}
            error={error}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
        >
            {/* Horizontal Scrolling Category Tabs */}
            {categories.length > 0 && (
                <div
                    style={{
                        padding: "8px 14px",
                        borderBottom: "1px solid var(--border-primary)",
                        marginBottom: 2,
                        overflowX: "auto",
                        overflowY: "hidden",
                    }}
                >
                    <div className={widgetCardStyles.tabs} style={{ width: "max-content" }}>
                        {categories.map((cat) => (
                            <button
                                key={cat.key}
                                onClick={() => setActiveCategory(cat.key)}
                                className={`${widgetCardStyles.tab} ${activeCategory === cat.key ? widgetCardStyles.tabActive : ""
                                    }`}
                                style={
                                    activeCategory === cat.key
                                        ? { color: "var(--accent-purple)" }
                                        : undefined
                                }
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {models.length > 0 ? (
                <div>
                    {/* Column headers */}
                    <div className={styles.feedItem} style={{ borderBottom: "1px solid var(--border-primary)", paddingTop: 4, paddingBottom: 4 }}>
                        <span className={styles.feedRank} style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>#</span>
                        <div className={styles.feedContent}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                Model
                            </span>
                        </div>
                        <div style={{ display: "flex", gap: 12, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            <span style={{ width: 36, textAlign: "right" }}>ELO</span>
                            <span style={{ width: 40, textAlign: "right" }}>Votes</span>
                            <span style={{ width: 50, textAlign: "right" }}>Price</span>
                        </div>
                    </div>

                    {models.map((m) => (
                        <a
                            key={`${m.rank}-${m.name}`}
                            href={`https://lmarena.ai/leaderboard/${activeCategory}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.feedItem}
                            style={{ textDecoration: "none", color: "inherit" }}
                        >
                            <span className={styles.feedRank}>{m.rank}</span>
                            <div className={styles.feedContent}>
                                <div className={styles.feedTitle} style={{ fontSize: 12 }}>
                                    {m.name}
                                </div>
                                <div className={styles.feedMeta} style={{ marginTop: 1 }}>
                                    <span>
                                        <span
                                            className={styles.langDot}
                                            style={{
                                                background: CREATOR_COLORS[m.creator] || "var(--text-muted)",
                                                width: 6,
                                                height: 6,
                                            }}
                                        />
                                        {m.creator}
                                    </span>
                                    {m.context_window && (
                                        <>
                                            <span className={styles.metaDot} />
                                            <span>{formatCtx(m.context_window)} ctx</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 12, flexShrink: 0, alignItems: "center" }}>
                                <span
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: m.score >= 1490 ? "var(--accent-green)" : m.score >= 1450 ? "var(--accent-amber)" : "var(--text-secondary)",
                                        width: 36,
                                        textAlign: "right",
                                    }}
                                >
                                    {m.score}
                                </span>
                                <span
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 11,
                                        color: "var(--text-tertiary)",
                                        width: 40,
                                        textAlign: "right",
                                    }}
                                >
                                    {formatVotes(m.votes)}
                                </span>
                                <span
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 11,
                                        color: "var(--text-tertiary)",
                                        width: 50,
                                        textAlign: "right",
                                    }}
                                >
                                    {formatPrice(m.output_price)}
                                </span>
                            </div>
                        </a>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px 12px", fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        <a href="https://lmarena.ai/leaderboard" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)" }}>LMSYS Chatbot Arena</a>
                        {currentData?.updated && <span>Updated {currentData.updated}</span>}
                    </div>
                </div>
            ) : (
                <div className={styles.emptyState}>
                    {loading ? "Loading leaderboard..." : "No leaderboard data available"}
                </div>
            )}
        </WidgetCard>
    );
}
