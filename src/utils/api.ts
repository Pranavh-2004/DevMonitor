// API endpoints and data transformers for DevMonitor

export const ENDPOINTS = {
  GITHUB_TRENDING_TODAY: (): string => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const d = date.toISOString().split("T")[0];
    return `https://api.github.com/search/repositories?q=created:>${d}&sort=stars&order=desc&per_page=15`;
  },
  GITHUB_TRENDING_WEEK: (): string => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const d = date.toISOString().split("T")[0];
    return `https://api.github.com/search/repositories?q=created:>${d}&sort=stars&order=desc&per_page=15`;
  },

  HN_TOP: "https://hacker-news.firebaseio.com/v0/topstories.json",
  HN_NEW: "https://hacker-news.firebaseio.com/v0/newstories.json",
  HN_BEST: "https://hacker-news.firebaseio.com/v0/beststories.json",
  HN_ITEM: (id: number): string =>
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,

  ARXIV_AI: "/api/arxiv?category=cs.AI",
  ARXIV_ML: "/api/arxiv?category=cs.LG",
  ARXIV_CL: "/api/arxiv?category=cs.CL",
  ARXIV_SE: "/api/arxiv?category=cs.SE",
  ARXIV_DC: "/api/arxiv?category=cs.DC",

  LLM_STATUS: "/api/llm-status",
  LLM_LEADERBOARD: "/api/llm-leaderboard",
  DEV_RELEASES: "/api/dev-releases",
  CVE_FEED: "/api/cve-feed",
} as const;

export const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  PHP: "#4F5D95",
  Shell: "#89e051",
  Lua: "#000080",
  Zig: "#ec915c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Jupyter: "#DA5B0B",
  R: "#198CE7",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
};

export function timeAgo(date: string | number | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}
