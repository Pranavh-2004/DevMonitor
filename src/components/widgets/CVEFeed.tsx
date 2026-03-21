"use client";
import { useState } from "react";
import WidgetCard from "../WidgetCard";
import { useFetch } from "@/hooks/useFetch";
import { timeAgo } from "@/utils/api";
import styles from "./widgets.module.css";

interface CVEItem {
  id: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  cvssScore: number | null;
  published: string;
  nvdUrl: string;
}

const SEVERITY_TABS = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "badge badge-red",
  HIGH: "badge badge-orange",
  MEDIUM: "badge badge-amber",
  LOW: "badge badge-green",
  UNKNOWN: "badge badge-blue",
};

export default function CVEFeed() {
  const [tab, setTab] = useState("all");

  const { data, loading, error, lastUpdated, refresh } = useFetch<CVEItem[]>(
    "/api/cve-feed",
    {
      cacheKey: "cve-feed",
      refreshInterval: 10 * 60 * 1000,
    }
  );

  const filtered =
    tab === "all"
      ? data
      : data?.filter((cve) => cve.severity === tab.toUpperCase());

  return (
    <WidgetCard
      title="CVE Feed"
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
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      }
      accentColor="red"
      loading={loading}
      error={error}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      tabs={SEVERITY_TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {filtered && filtered.length > 0 ? (
        filtered.map((cve, i) => (
          <div key={cve.id || i} className={styles.feedItem}>
            <div className={styles.feedContent}>
              <div className={styles.feedTitle}>
                <a href={cve.nvdUrl} target="_blank" rel="noopener noreferrer">
                  {cve.id}
                </a>
              </div>
              <div className={styles.paperAbstract}>{cve.description}</div>
              <div className={styles.feedMeta}>
                <span className={SEVERITY_BADGE[cve.severity] ?? "badge"}>
                  {cve.severity}
                </span>
                {cve.cvssScore !== null && (
                  <>
                    <span className={styles.metaDot} />
                    <span>CVSS {cve.cvssScore}</span>
                  </>
                )}
                <span className={styles.metaDot} />
                <span>{timeAgo(cve.published)}</span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className={styles.emptyState}>No CVEs found</div>
      )}
    </WidgetCard>
  );
}
