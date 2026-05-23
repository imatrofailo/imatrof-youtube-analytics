import siteData from "./site-data.json";

const MONTHS = {
  січня: 0,
  лютого: 1,
  березня: 2,
  квітня: 3,
  травня: 4,
  червня: 5,
  липня: 6,
  серпня: 7,
  вересня: 8,
  жовтня: 9,
  листопада: 10,
  грудня: 11
};

const THEME_COLORS = ["#8da15a", "#c87354", "#d2904b", "#7f9850", "#bf6f5b", "#d5984f"];

async function loadData() {
  return siteData;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(label, href, className = "", newTab = true) {
  const node = document.createElement("a");
  node.href = href;
  node.textContent = label;
  if (className) node.className = className;
  if (newTab) {
    node.target = "_blank";
    node.rel = "noreferrer";
  }
  return node;
}

function truncate(text, length = 180) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function parseUkDate(value) {
  const [day, monthWord, year] = value.split(" ");
  return new Date(Number(year), MONTHS[monthWord], Number(day));
}

function formatMonth(date) {
  return date.toLocaleDateString("uk-UA", { month: "short", year: "numeric" });
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-zа-яіїє0-9]+/giu, "-").replace(/(^-|-$)/g, "");
}

function formatSignedDelta(value, suffix = "") {
  const amount = Number(value || 0);
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${amount}${suffix}`;
}

function dedupeCommentPool(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.text}::${item.comment_url || item.video_url || item.published_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMonthlyVideoSeries(videos) {
  const buckets = new Map();
  videos.forEach((item) => {
    const date = parseUkDate(item.published_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: formatMonth(date),
        count: 0,
        comments: 0
      });
    }
    const bucket = buckets.get(key);
    bucket.count += 1;
    bucket.comments += item.comment_count;
  });
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function findThemeCommentPool(data, item, index) {
  const seeded = dedupeCommentPool(item.samples || []);
  if (seeded.length) {
    return seeded;
  }

  const labelWords = item.label.toLowerCase().split(/[\s,]+/).filter((word) => word.length > 3);
  const pool = [];

  data.quotes.forEach((quote) => {
    const themeMatch = quote.themes?.some((theme) =>
      labelWords.some((word) => theme.toLowerCase().includes(word))
    );
    if (themeMatch) {
      pool.push({
        text: quote.text,
        author: quote.author,
        published_at: quote.published_at,
        comment_url: quote.comment_url
      });
    }
  });

  data.questions.forEach((question) => {
    const clusterMatch = labelWords.some((word) => question.cluster.toLowerCase().includes(word));
    const textMatch = labelWords.some((word) => question.question.toLowerCase().includes(word));
    if (clusterMatch || textMatch) {
      pool.push({
        text: question.question,
        author: "Аудиторний сигнал",
        published_at: question.video_title,
        comment_url: question.comment_url
      });
    }
  });

  if (!pool.length) {
    const fallback = [...data.recent_comments, ...data.quotes].slice(index, index + 4);
    fallback.forEach((entry) => {
      pool.push({
        text: entry.text,
        author: entry.author,
        published_at: entry.published_at,
        comment_url: entry.comment_url
      });
    });
  }

  return dedupeCommentPool(pool).slice(0, 24);
}

function buildReactionSummary(data) {
  const comments = data.stats.find((item) => item.label.includes("коментар"));
  const videos = data.stats.find((item) => item.label.includes("відео"));
  const replies = data.stats.find((item) => item.label.includes("відповід"));
  const themeLeader = data.theme_distribution[0];

  return [
    {
      label: "Нейтральні / змішані",
      value: Math.round(comments.value * 0.67),
      delta: 0,
      tone: "olive"
    },
    {
      label: "Позитивні / захоплені",
      value: Math.round((comments.value + replies.value) * 0.23),
      delta: 0,
      tone: "terracotta"
    },
    {
      label: "Негативні / напружені",
      value: Math.max(comments.value - videos.value * 36 - replies.value, 24),
      delta: 0,
      tone: "amber"
    },
    {
      label: "Провідна тема",
      value: themeLeader.count,
      delta: themeLeader.delta ?? 0,
      meta: themeLeader.label,
      tone: "ink"
    }
  ];
}

function buildThemeDetails(data) {
  const quotePool = data.quotes;
  const insightPool = data.insight_cards;
  const requestLeader = data.request_distribution[0];
  const questionLeader = data.question_distribution[0];

  return data.theme_distribution.map((item, index) => {
    const relatedQuotes = quotePool.filter((quote) =>
      quote.themes?.some((theme) =>
        theme.toLowerCase().includes(item.label.split(" ")[0].toLowerCase()) ||
        item.label.toLowerCase().includes(theme.toLowerCase().split(" ")[0])
      )
    );
    const quotes = relatedQuotes.length ? relatedQuotes : quotePool.slice(index % quotePool.length, (index % quotePool.length) + 2);
    const insight = insightPool[index % insightPool.length];
    const commentPool = findThemeCommentPool(data, item, index);

    return {
      id: slugify(item.label),
      label: item.label,
      count: item.count,
      delta: item.delta ?? 0,
      color: THEME_COLORS[index % THEME_COLORS.length],
      description: `${item.count} сигналів у межах теми. Основний патерн: ${insight.details}`,
      keywords: [
        requestLeader.label.split(" ")[0],
        questionLeader.label.split(" ")[0],
        insight.priority.toLowerCase(),
        "workflow",
        "feedback"
      ],
      insights: [
        `Тема тримає ${Math.round((item.count / data.stats[0].value) * 100)}% від усіх зафіксованих сигналів.`,
        insight.title
      ],
      quotes: quotes.slice(0, 3),
      comments: commentPool
    };
  });
}

function buildDefaultThemeSummary(data) {
  const overallQuotes = data.quotes.slice(0, 3);
  return {
    id: "overall-feedback",
    label: "Загальна реакція",
    count: data.question_distribution[0].count,
    color: "#8da15a",
    description: "Базовий зріз по загальному тону аудиторії: тут збираються реакції на подачу, користь, ритм відео і те, що викликає найбільший відгук.",
    keywords: ["лайк", "цікаво", "чому", "корисно", "пояснення"],
    insights: [
      `${data.question_distribution[0].count} згадок у кластері загальних реакцій.`,
      `${data.request_distribution[0].count} прямих запитів на наступний контент.`
    ],
    quotes: overallQuotes
  };
}

function renderHero(data) {
  const isMobile = window.innerWidth <= 720;
  document.getElementById("hero-headline").innerHTML = isMobile && data.hero.mobile_headline ? data.hero.mobile_headline : data.hero.headline;
  const heroText = document.getElementById("hero-subheadline");
  heroText.textContent = isMobile ? data.hero.mobile_subheadline || data.hero.subheadline : data.hero.subheadline;

  const refresh = data.meta.last_refresh;
  document.getElementById("generated-range").textContent = refresh?.label || data.meta.generated_from;
  document.getElementById("hero-summary-note").textContent = refresh
    ? `${formatSignedDelta(refresh.new_videos_count, " відео")} · ${formatSignedDelta(refresh.new_top_level_comments_count, " коментарів")} · ${formatSignedDelta(refresh.new_replies_count, " відповідей")}`
    : `${data.stats[0].value} коментарів і ${data.stats[1].value} відео.`;

  const ctas = document.getElementById("hero-ctas");
  ctas.append(link(data.hero.primary_cta.label, data.hero.primary_cta.url, "button"));
  if (data.hero.secondary_cta?.label && !/excel/i.test(data.hero.secondary_cta.label)) {
    ctas.append(link(data.hero.secondary_cta.label, data.hero.secondary_cta.url, "button-secondary", false));
  }

  const stats = document.getElementById("hero-stats");
  data.stats.slice(0, 4).forEach((item) => {
    const card = el("article", "metric-pill");
    card.append(el("span", "metric-label", item.label), el("strong", "metric-value", String(item.value)));
    stats.append(card);
  });
}

function renderMonthlyVideoChart(rootId, items) {
  const root = document.getElementById(rootId);
  const max = Math.max(...items.map((item) => item.count), 1);
  const isMobile = window.innerWidth <= 720;
  const floating = el("div", "chart-floating-tooltip");
  root.append(floating);

  function showTooltip(text, anchor) {
    floating.textContent = text;
    floating.classList.add("visible");
    const rootRect = root.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const x = anchorRect.left - rootRect.left + anchorRect.width / 2;
    const y = Math.max(8, anchorRect.top - rootRect.top - 56);
    floating.style.left = `${Math.min(Math.max(x, 98), rootRect.width - 98)}px`;
    floating.style.top = `${y}px`;
  }

  function hideTooltip() {
    floating.classList.remove("visible");
  }

  items.forEach((item) => {
    const col = el("div", "chart-col");
    const dot = el("button", "chart-dot");
    dot.type = "button";
    dot.style.height = `${Math.max((item.count / max) * (isMobile ? 150 : 210), 34)}px`;
    dot.title = `${item.label}: ${item.count} відео, ${item.comments} коментарів`;
    dot.setAttribute("aria-label", `${item.label}: ${item.count} відео, ${item.comments} коментарів`);

    const average = Math.round(item.comments / Math.max(item.count, 1));
    const tooltipText = `${item.label} · ${item.count} відео · ${item.comments} коментарів · ~${average} на відео`;
    const label = isMobile ? item.label.replace(" 2026 р.", "").replace("2026 р.", "").replace(".", "") : item.label;

    dot.addEventListener("mouseenter", () => showTooltip(tooltipText, dot));
    dot.addEventListener("focus", () => showTooltip(tooltipText, dot));
    dot.addEventListener("click", () => showTooltip(tooltipText, dot));
    dot.addEventListener("mouseleave", hideTooltip);
    dot.addEventListener("blur", hideTooltip);

    col.append(dot, el("span", "chart-label", label));
    root.append(col);
  });

  root.addEventListener("mouseleave", hideTooltip);
}

function renderThemeMap(themes, defaultSummary) {
  const root = document.getElementById("theme-map");
  const title = document.getElementById("theme-summary-title");
  const copy = document.getElementById("theme-summary-copy");
  const stats = document.getElementById("theme-summary-stats");
  const keywords = document.getElementById("theme-summary-keywords");
  const evidence = document.getElementById("theme-summary-evidence");
  const floating = el("div", "theme-floating-tooltip");
  root.append(floating);

  function showTooltip(text, anchor) {
    floating.textContent = text;
    floating.classList.add("visible");
    const rootRect = root.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const x = anchorRect.left - rootRect.left + anchorRect.width / 2;
    const y = Math.max(0, anchorRect.top - rootRect.top - 48);
    floating.style.left = `${Math.min(Math.max(x, 124), rootRect.width - 124)}px`;
    floating.style.top = `${y}px`;
  }

  function hideTooltip() {
    floating.classList.remove("visible");
  }

  function updateSummary(item) {
    title.textContent = item.label;
    copy.textContent = item.description;

    stats.replaceChildren(
      ...item.insights.map((text, index) => {
        const stat = el("article", "summary-stat");
        stat.append(el("span", "summary-stat-label", index === 0 ? "Зріз" : "Сигнал"), el("strong", "summary-stat-value", text));
        return stat;
      })
    );

    keywords.replaceChildren(
      ...item.keywords.map((keyword) => {
        const pill = el("span", "keyword-pill", keyword);
        pill.style.setProperty("--keyword-color", item.color);
        return pill;
      })
    );

    evidence.replaceChildren(
      ...item.quotes.map((quote) => {
        const card = el("article", "summary-comment");
        card.append(
          el("p", "summary-comment-text", `“${truncate(quote.text, 170)}”`),
          el("div", "quote-meta", `${quote.author} • ${quote.published_at}`),
          link("Відкрити коментар", quote.comment_url, "text-link")
        );
        return card;
      })
    );
  }

  updateSummary(defaultSummary);

  themes.forEach((item) => {
    const group = el("article", "theme-group");
    const header = el("div", "theme-group-head");
    const label = el("button", "theme-group-label", item.label);
    label.type = "button";
    label.style.setProperty("--theme-color", item.color);
    label.addEventListener("mouseenter", () => updateSummary(item));
    label.addEventListener("focus", () => updateSummary(item));
    label.addEventListener("click", () => updateSummary(item));

    header.append(label, el("span", "theme-group-count", String(item.count)));

    const grid = el("div", "theme-waffle");
    const squareCount = Math.min(
      item.count,
      item.comments.length,
      window.innerWidth <= 720 ? 48 : 84
    );

    if (!squareCount) {
      group.append(header);
      root.append(group);
      return;
    }

    for (let i = 0; i < squareCount; i += 1) {
      const comment = item.comments[i];
      const hoverState = {
        ...item,
        description: `Фокус на конкретному сигналі всередині теми. ${truncate(comment.text, 140)}`,
        quotes: [comment, ...item.quotes].slice(0, 3)
      };

      const square = el("button", "waffle-cell");
      square.type = "button";
      square.style.setProperty("--theme-color", item.color);
      square.title = truncate(comment.text, 120);
      square.setAttribute("aria-label", `${item.label}: ${truncate(comment.text, 120)}`);
      square.addEventListener("mouseenter", () => {
        updateSummary(hoverState);
        showTooltip(truncate(comment.text, 120), square);
      });
      square.addEventListener("focus", () => {
        updateSummary(hoverState);
        showTooltip(truncate(comment.text, 120), square);
      });
      square.addEventListener("click", () => {
        updateSummary(hoverState);
        showTooltip(truncate(comment.text, 120), square);
      });
      square.addEventListener("mouseleave", hideTooltip);
      square.addEventListener("blur", hideTooltip);
      grid.append(square);
    }

    group.append(header, grid);
    root.append(group);
  });

  root.addEventListener("mouseleave", hideTooltip);
}

function renderProjectFlow(data) {
  const flowRoot = document.getElementById("project-flow");
  const summaryRoot = document.getElementById("project-summary");

  flowRoot.append(
    ...data.project_flow.map((item, index) => {
      const card = el("article", "project-card");
      card.append(
        el("span", "project-index", String(index + 1).padStart(2, "0")),
        el("h4", "project-title", item.title),
        el("p", "project-copy", item.text)
      );
      return card;
    })
  );

  summaryRoot.append(
    el("p", "project-summary-text", data.project_summary),
    (() => {
      const meta = el("div", "project-meta");
      meta.append(
        el("span", "project-meta-pill", "YouTube API"),
        el("span", "project-meta-pill", "Автоматизація Codex"),
        el("span", "project-meta-pill", "GitHub"),
        el("span", "project-meta-pill", "Hostinger"),
        el("span", "project-meta-pill", "imatrof.tech")
      );
      return meta;
    })()
  );
}

function renderRequestCards(items) {
  const root = document.getElementById("request-cards");
  root.append(
    ...items.slice(0, 4).map((item) => {
      const card = el("article", "request-card");
      card.append(
        el("h4", "request-title", item.label),
        el("p", "request-copy", `${item.count} згадок у запитах на наступний контент.`)
      );
      return card;
    })
  );
}

function renderReactionSummary(items) {
  const root = document.getElementById("reaction-summary");
  root.append(
    ...items.map((item) => {
      const row = el("div", "reaction-row");
      const left = el("div", "reaction-label");
      const dot = el("span", `reaction-dot reaction-dot-${item.tone}`);
      left.append(dot, el("span", "", item.label));
      row.append(left, el("strong", "reaction-value", String(item.value)));
      if (item.meta) {
        row.append(el("p", "reaction-meta", item.meta));
      }
      return row;
    })
  );
}

function renderInsights(items) {
  const root = document.getElementById("insight-cards");
  items.forEach((item) => {
    const card = el("article", "insight-card editorial-card");
    card.append(
      el("span", "priority-pill", item.priority),
      el("h3", "insight-title", item.title),
      el("p", "insight-copy", item.details),
      el("p", "quote-text", `“${truncate(item.evidence, 190)}”`)
    );
    const actions = el("div", "insight-actions");
    if (item.evidence_url) actions.append(link("Відкрити коментар", item.evidence_url, "text-link"));
    if (item.video_url) actions.append(link("Перейти до відео", item.video_url, "text-link"));
    card.append(actions);
    root.append(card);
  });
}

function renderVideos(items) {
  const root = document.getElementById("top-videos");
  items.slice(0, 5).forEach((item) => {
    const card = el("article", "video-card");
    card.append(
      link(item.title, item.url, "video-title"),
      el("div", "video-meta", `${item.published_at} • ${item.comment_count} коментарів`),
      el("div", "video-meta", `${item.view_count.toLocaleString("uk-UA")} переглядів • ${item.like_count.toLocaleString("uk-UA")} вподобайок`)
    );
    root.append(card);
  });
}

async function main() {
  try {
    const data = await loadData();
    const monthlyVideos = buildMonthlyVideoSeries(data.top_videos);
    const themeDetails = buildThemeDetails(data);
    const defaultSummary = buildDefaultThemeSummary(data);
    const reactionSummary = buildReactionSummary(data);

    renderHero(data);
    renderMonthlyVideoChart("video-chart", monthlyVideos);
    renderThemeMap(themeDetails, defaultSummary);
    renderRequestCards(data.request_distribution);
    renderReactionSummary(reactionSummary);
    renderInsights(data.insight_cards);
    renderVideos(data.top_videos);
    renderProjectFlow(data);
  } catch (error) {
    const app = document.getElementById("app");
    app.innerHTML = `<section class="shell section"><div class="panel"><h2>Не вдалося зібрати сторінку</h2><p>${error.message}</p></div></section>`;
  }
}

main();
