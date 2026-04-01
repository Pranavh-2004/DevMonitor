<div align="center">

# 🖥️ DevMonitor

**Developer Intelligence Dashboard**

A real-time, customizable dashboard that aggregates developer-relevant feeds, AI model status, research papers, and LLM leaderboards — all in one dark-themed, draggable interface.

Built with **Next.js 16** · **React 19** · **TypeScript** · **Zero external UI dependencies**

[Getting Started](#-getting-started) · [Features](#-features) · [Widgets](#-widgets) · [Architecture](#-architecture) · [API Routes](#-api-routes)

</div>

---

## ✨ Features

- **🧩 Drag-and-Drop Grid** — Rearrange widgets by dragging. Layout persists in `localStorage`.
- **🎛️ Widget Picker** — Toggle any of the 10 widgets on/off from the header. Reset to default layout anytime.
- **📡 Live Data** — All widgets fetch real-time data from public APIs. No API keys required.
- **🏆 LLM Leaderboard** — Real ELO scores from [LMSYS Chatbot Arena](https://lmarena.ai) across 9 categories (Text, Code, Vision, and more), enriched with live pricing from [OpenRouter](https://openrouter.ai).
- **🔗 Quick Links** — One-click access to ChatGPT, Gemini, Claude, and Perplexity from the header.
- **🌙 Dark Theme** — Purpose-built dark UI with glassmorphism and subtle animations.
- **📱 Responsive** — Adapts from 4-column desktop to single-column mobile.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm (comes with Node.js)

### Installation

```bash
# Clone the repo
git clone https://github.com/Pranavh-2004/DevMonitor.git
cd DevMonitor

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## 🧩 Widgets

DevMonitor ships with **10 widgets** (9 enabled by default):

| Widget | Description | Data Source |
|--------|-------------|-------------|
| **GitHub Trending** | Top trending repositories (today/week) | GitHub Trending |
| **LLM Status** | Real-time operational status of major LLM providers | Provider status pages |
| **LLM Leaderboard** | Live ELO rankings across 9 categories with pricing | [lmarena.ai](https://lmarena.ai) + [OpenRouter](https://openrouter.ai) |
| **Hacker News** | Top, New, and Best stories | Hacker News API |
| **arXiv Papers** | Latest AI/ML research papers by category | arXiv API |
| **Anthropic Updates** | Latest Claude announcements and blog posts | Anthropic RSS |
| **OpenAI Updates** | Latest ChatGPT/GPT announcements | OpenAI RSS |
| **Google AI Updates** | Latest Gemini and Google AI news | Google AI Blog RSS |
| **Dev Tools Releases** | Latest releases from popular dev tools | GitHub Releases API |
| **CVE Feed** | Recent security vulnerabilities with severity ratings and CVSS scores | [NIST NVD API](https://nvd.nist.gov/) |

### LLM Leaderboard Categories

The LLM Leaderboard widget supports **9 categories** with tabbed navigation:

| Category | Icon | What it Ranks |
|----------|------|---------------|
| Text | 💬 | General text/chat tasks |
| Code | 🧑‍💻 | Code generation and understanding |
| Vision | 👁️ | Multimodal image understanding |
| Document | 📄 | Document understanding and analysis |
| Txt→Img | 🎨 | Text-to-image generation |
| Img Edit | ✏️ | Image editing capabilities |
| Search | 🔍 | Search and RAG tasks |
| Txt→Vid | 🎬 | Text-to-video generation |
| Img→Vid | 📹 | Image-to-video generation |

---

## 🏗️ Architecture

```
src/
├── app/
│   ├── api/                          # Next.js API routes (server-side)
│   │   ├── anthropic-feed/route.ts   # Anthropic blog RSS
│   │   ├── arxiv/route.ts            # arXiv paper search
│   │   ├── cve-feed/route.ts         # NIST NVD CVE data
│   │   ├── dev-releases/route.ts     # GitHub releases for dev tools
│   │   ├── google-feed/route.ts      # Google AI blog RSS
│   │   ├── llm-leaderboard/route.ts  # LMSYS Arena + OpenRouter
│   │   ├── llm-status/route.ts       # LLM provider status
│   │   └── openai-feed/route.ts      # OpenAI blog RSS
│   ├── globals.css                   # Global styles and design tokens
│   ├── layout.tsx                    # Root layout with metadata
│   └── page.tsx                      # Dashboard page (DashboardGrid)
├── components/
│   ├── widgets/                      # Individual widget components
│   │   ├── ArxivPapers.tsx
│   │   ├── ChatGPTReleases.tsx
│   │   ├── ClaudeReleases.tsx
│   │   ├── CVEFeed.tsx
│   │   ├── DevToolsReleases.tsx
│   │   ├── GeminiReleases.tsx
│   │   ├── GithubTrending.tsx
│   │   ├── HackerNews.tsx
│   │   ├── LLMLeaderboard.tsx
│   │   ├── LLMStatus.tsx
│   │   └── widgets.module.css
│   ├── DashboardGrid.tsx             # Drag-and-drop grid container
│   ├── Header.tsx                    # Top bar with quick links
│   ├── WidgetCard.tsx                # Reusable widget card wrapper
│   ├── WidgetPicker.tsx              # Widget toggle panel
│   └── widgetRegistry.ts            # Widget definitions and defaults
├── hooks/
│   └── useFetch.ts                   # Data fetching hook with caching
└── utils/
    └── api.ts                        # API endpoint constants
```

### Key Design Decisions

- **Zero external UI libraries** — No Tailwind, no component libraries. All styling via CSS Modules + CSS custom properties for full design control.
- **Server-side data fetching** — All external API calls go through Next.js API routes to avoid CORS issues and keep API logic server-side.
- **Client-side caching** — `useFetch` hook caches responses in memory with configurable refresh intervals to minimize redundant requests.
- **Drag-and-drop** — Implemented with native HTML5 Drag and Drop API. No external DnD library needed.
- **Dynamic imports** — Widgets are loaded via `next/dynamic` to enable code splitting per widget.

---

## 🔌 API Routes

All API routes are under `/api/` and require **no API keys**:

| Endpoint | Method | Description | External Source |
|----------|--------|-------------|-----------------|
| `/api/llm-leaderboard` | GET | ELO rankings + pricing for 9 categories | lmarena.ai, openrouter.ai |
| `/api/llm-status` | GET | Operational status of LLM providers | Provider status pages |
| `/api/arxiv?category=cs.AI` | GET | Latest papers from arXiv | arxiv.org |
| `/api/anthropic-feed` | GET | Anthropic blog/announcements | anthropic.com RSS |
| `/api/openai-feed` | GET | OpenAI blog/announcements | openai.com RSS |
| `/api/google-feed` | GET | Google AI blog/announcements | blog.google RSS |
| `/api/cve-feed` | GET | Recent CVEs from the past 7 days with CVSS scores and severity | nvd.nist.gov |
| `/api/dev-releases` | GET | Latest releases of popular dev tools | GitHub API |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Runtime | [React 19](https://react.dev/) |
| Language | TypeScript 5.9 |
| Styling | CSS Modules + Custom Properties |
| Data Fetching | Native `fetch` + custom `useFetch` hook |
| Drag & Drop | HTML5 native DnD API |
| Persistence | `localStorage` (layout + active widgets) |

---

## 📄 License

This project is open source. See [LICENSE](LICENSE) for details.

---
