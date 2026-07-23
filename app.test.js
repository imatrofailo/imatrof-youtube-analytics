// Deterministic unit tests for the pure transforms in app.js — AC-05
// (imatrof-docs feature test-coverage-hardening). No DOM, no network.
import { describe, expect, it } from "vitest";
import {
  parseUkDate,
  buildMonthlyVideoSeries,
  dedupeCommentPool,
  findThemeCommentPool,
  buildReactionSummary,
  slugify,
  formatSignedDelta
} from "./app.js";

describe("parseUkDate", () => {
  it("parses Ukrainian genitive dates", () => {
    const d = parseUkDate("5 червня 2026");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(5);
  });

  it("parses December and January boundaries", () => {
    expect(parseUkDate("31 грудня 2025").getMonth()).toBe(11);
    expect(parseUkDate("1 січня 2026").getMonth()).toBe(0);
  });

  it("yields Invalid Date for an unknown month word", () => {
    expect(Number.isNaN(parseUkDate("5 juin 2026").getTime())).toBe(true);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates mixed Ukrainian/Latin", () => {
    expect(slugify("Клод Code 2026")).toBe("клод-code-2026");
  });

  it("collapses runs of specials and trims edge hyphens", () => {
    expect(slugify("  ...AI, агенти!!! ")).toBe("ai-агенти");
  });

  it("returns empty string for only-specials input", () => {
    expect(slugify("!!! ???")).toBe("");
  });
});

describe("formatSignedDelta", () => {
  it("prefixes positives with + and keeps negatives", () => {
    expect(formatSignedDelta(5)).toBe("+5");
    expect(formatSignedDelta(-3)).toBe("-3");
  });

  it("treats zero and missing values as +0", () => {
    expect(formatSignedDelta(0)).toBe("+0");
    expect(formatSignedDelta(undefined)).toBe("+0");
  });

  it("appends the suffix", () => {
    expect(formatSignedDelta(12, "%")).toBe("+12%");
  });
});

describe("dedupeCommentPool", () => {
  it("drops duplicates with the same text and url", () => {
    const items = [
      { text: "a", comment_url: "u1" },
      { text: "a", comment_url: "u1" },
      { text: "a", comment_url: "u2" }
    ];
    expect(dedupeCommentPool(items)).toHaveLength(2);
  });

  it("falls back to video_url then published_at for the key", () => {
    const items = [
      { text: "a", video_url: "v1" },
      { text: "a", video_url: "v1" },
      { text: "a", published_at: "2026-01-01" },
      { text: "a", published_at: "2026-01-01" }
    ];
    expect(dedupeCommentPool(items)).toHaveLength(2);
  });

  it("keeps order of first occurrences and handles empty input", () => {
    expect(dedupeCommentPool([])).toEqual([]);
    const items = [{ text: "b", comment_url: "u" }, { text: "a", comment_url: "u" }];
    expect(dedupeCommentPool(items).map((i) => i.text)).toEqual(["b", "a"]);
  });
});

describe("buildMonthlyVideoSeries", () => {
  it("buckets by month, sums comments, sorts by key across years", () => {
    const series = buildMonthlyVideoSeries([
      { published_at: "5 січня 2026", comment_count: 10 },
      { published_at: "20 січня 2026", comment_count: 5 },
      { published_at: "1 грудня 2025", comment_count: 7 }
    ]);
    expect(series.map((b) => b.key)).toEqual(["2025-12", "2026-01"]);
    expect(series[1].count).toBe(2);
    expect(series[1].comments).toBe(15);
    expect(series[0].count).toBe(1);
    expect(typeof series[0].label).toBe("string");
  });

  it("returns an empty series for no videos", () => {
    expect(buildMonthlyVideoSeries([])).toEqual([]);
  });
});

describe("findThemeCommentPool", () => {
  const base = { quotes: [], questions: [], recent_comments: [] };

  it("prefers seeded (deduped) samples when present", () => {
    const item = {
      label: "агенти",
      samples: [
        { text: "s1", comment_url: "u1" },
        { text: "s1", comment_url: "u1" }
      ]
    };
    const pool = findThemeCommentPool(base, item, 0);
    expect(pool).toHaveLength(1);
    expect(pool[0].text).toBe("s1");
  });

  it("matches quotes by theme word and questions by cluster/text", () => {
    const data = {
      quotes: [
        { text: "q-themed", author: "A", published_at: "p", comment_url: "qu",
          themes: ["автономні агенти"] },
        { text: "q-other", author: "B", published_at: "p", comment_url: "qo",
          themes: ["інше"] }
      ],
      questions: [
        { question: "Як налаштувати агенти?", cluster: "садівництво",
          video_title: "v", comment_url: "qq" },
        { question: "Про погоду", cluster: "погода", video_title: "v", comment_url: "qw" }
      ],
      recent_comments: []
    };
    const pool = findThemeCommentPool(data, { label: "Агенти автономні", samples: [] }, 0);
    const texts = pool.map((p) => p.text);
    expect(texts).toContain("q-themed");
    expect(texts).toContain("Як налаштувати агенти?");
    expect(texts).not.toContain("q-other");
    expect(texts).not.toContain("Про погоду");
    // question entries get the synthetic author
    expect(pool.find((p) => p.text.startsWith("Як")).author).toBe("Аудиторний сигнал");
  });

  it("falls back to recent comments + quotes slice when nothing matches", () => {
    const data = {
      quotes: [],
      questions: [],
      recent_comments: [
        { text: "r1", author: "A", published_at: "p1", comment_url: "c1" },
        { text: "r2", author: "B", published_at: "p2", comment_url: "c2" }
      ]
    };
    const pool = findThemeCommentPool(data, { label: "нічого-схожого", samples: [] }, 0);
    expect(pool.map((p) => p.text)).toEqual(["r1", "r2"]);
  });

  it("caps the pool at 24 entries", () => {
    const quotes = Array.from({ length: 40 }, (_, i) => ({
      text: `q${i}`, author: "A", published_at: "p", comment_url: `u${i}`,
      themes: ["агенти"]
    }));
    const data = { quotes, questions: [], recent_comments: [] };
    const pool = findThemeCommentPool(data, { label: "агенти всюди", samples: [] }, 0);
    expect(pool).toHaveLength(24);
  });
});

describe("buildReactionSummary", () => {
  const data = {
    stats: [
      { label: "Відео", value: 10 },
      { label: "Коментарі", value: 1000 },
      { label: "Відповіді", value: 200 }
    ],
    theme_distribution: [{ label: "Агенти", count: 42, delta: 7 }]
  };

  it("derives the four summary rows from stats + theme leader", () => {
    const summary = buildReactionSummary(data);
    expect(summary).toHaveLength(4);
    expect(summary[0].value).toBe(Math.round(1000 * 0.67));
    expect(summary[1].value).toBe(Math.round((1000 + 200) * 0.23));
    expect(summary[2].value).toBe(Math.max(1000 - 10 * 36 - 200, 24));
    expect(summary[3]).toMatchObject({ value: 42, delta: 7, meta: "Агенти" });
  });

  it("floors the negative bucket at 24 and defaults missing delta to 0", () => {
    const small = {
      stats: [
        { label: "Відео", value: 100 },
        { label: "Коментарі", value: 50 },
        { label: "Відповіді", value: 10 }
      ],
      theme_distribution: [{ label: "X", count: 1 }]
    };
    const summary = buildReactionSummary(small);
    expect(summary[2].value).toBe(24);
    expect(summary[3].delta).toBe(0);
  });
});
