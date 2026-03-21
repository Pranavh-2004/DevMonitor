"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export interface WidgetDef {
  id: string;
  label: string;
  accentColor: string;
  defaultEnabled: boolean;
  component: ComponentType;
}

const registry: WidgetDef[] = [
  {
    id: "github-trending",
    label: "GitHub Trending",
    accentColor: "var(--accent-amber)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/GithubTrending")),
  },
  {
    id: "llm-status",
    label: "LLM Status",
    accentColor: "var(--accent-green)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/LLMStatus")),
  },
  {
    id: "llm-leaderboard",
    label: "LLM Leaderboard",
    accentColor: "var(--accent-purple)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/LLMLeaderboard")),
  },
  {
    id: "hacker-news",
    label: "Hacker News",
    accentColor: "var(--accent-orange)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/HackerNews")),
  },
  {
    id: "arxiv-papers",
    label: "arXiv Papers",
    accentColor: "var(--accent-purple)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/ArxivPapers")),
  },
  {
    id: "claude-releases",
    label: "Claude Releases",
    accentColor: "var(--accent-orange)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/ClaudeReleases")),
  },
  {
    id: "chatgpt-releases",
    label: "ChatGPT Releases",
    accentColor: "var(--accent-green)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/ChatGPTReleases")),
  },
  {
    id: "gemini-releases",
    label: "Gemini Releases",
    accentColor: "var(--accent-blue)",
    defaultEnabled: true,
    component: dynamic(() => import("./widgets/GeminiReleases")),
  },
  {
    id: "devtools-releases",
    label: "Dev Tools Releases",
    accentColor: "var(--accent-cyan)",
    defaultEnabled: false,
    component: dynamic(() => import("./widgets/DevToolsReleases")),
  },
  {
    id: "cve-feed",
    label: "CVE Feed",
    accentColor: "var(--accent-red)",
    defaultEnabled: false,
    component: dynamic(() => import("./widgets/CVEFeed")),
  },
];

export default registry;

export function getWidgetById(id: string): WidgetDef | undefined {
  return registry.find((w) => w.id === id);
}

export const DEFAULT_LAYOUT = registry.map((w) => w.id);
export const DEFAULT_ACTIVE = registry
  .filter((w) => w.defaultEnabled)
  .map((w) => w.id);
