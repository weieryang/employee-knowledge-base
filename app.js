const data = window.KB_DATA;

const state = {
  query: "",
  category: "all",
  unreadOnly: false,
  selectedId: "",
  readIds: new Set(JSON.parse(localStorage.getItem("employeeKbReadIds") || "[]")),
};

const els = {
  quickStats: document.querySelector("#quickStats"),
  categoryList: document.querySelector("#categoryList"),
  timelineList: document.querySelector("#timelineList"),
  searchInput: document.querySelector("#searchInput"),
  unreadOnly: document.querySelector("#unreadOnly"),
  articleList: document.querySelector("#articleList"),
  readerPane: document.querySelector("#readerPane"),
  resultTitle: document.querySelector("#resultTitle"),
  activeFilters: document.querySelector("#activeFilters"),
  resetBtn: document.querySelector("#resetBtn"),
  printBtn: document.querySelector("#printBtn"),
  sourceBtn: document.querySelector("#sourceBtn"),
  sourceDialog: document.querySelector("#sourceDialog"),
  closeSourceBtn: document.querySelector("#closeSourceBtn"),
  sourceList: document.querySelector("#sourceList"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categoryLabel(id) {
  return data.categories.find((category) => category.id === id)?.label || "全部";
}

function articleSearchText(article) {
  return [
    article.title,
    article.summary,
    article.priority,
    article.source,
    ...(article.tags || []),
    ...(article.highlights || []),
    ...(article.sections || []).flatMap((section) => [
      section.heading,
      ...(section.body || []),
      ...(section.bullets || []),
      ...(section.steps || []),
      ...(section.template || []),
      ...(section.table?.headers || []),
      ...(section.table?.rows || []).flat(),
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

function getFilteredArticles() {
  const query = state.query.trim().toLowerCase();
  return data.articles.filter((article) => {
    const matchCategory = state.category === "all" || article.category === state.category;
    const matchQuery = !query || articleSearchText(article).includes(query);
    const matchUnread = !state.unreadOnly || !state.readIds.has(article.id);
    return matchCategory && matchQuery && matchUnread;
  });
}

function saveReadState() {
  localStorage.setItem("employeeKbReadIds", JSON.stringify([...state.readIds]));
}

function renderStats() {
  els.quickStats.innerHTML = data.quickStats
    .map(
      (item) => `
        <div class="stat-card">
          <span class="stat-value">${escapeHtml(item.value)}</span>
          <span class="stat-label">${escapeHtml(item.label)}</span>
        </div>
      `
    )
    .join("");
}

function renderCategories() {
  const counts = data.articles.reduce((acc, article) => {
    acc[article.category] = (acc[article.category] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, {});

  els.categoryList.innerHTML = data.categories
    .map(
      (category) => `
        <button class="category-button ${category.id === state.category ? "active" : ""}" data-category="${escapeHtml(category.id)}" type="button">
          <span>${escapeHtml(category.label)}</span>
          <span>${counts[category.id] || 0}</span>
        </button>
      `
    )
    .join("");
}

function renderTimeline() {
  els.timelineList.innerHTML = data.onboardingTimeline
    .map(
      (phase) => `
        <div class="timeline-item">
          <strong>${escapeHtml(phase.phase)}</strong>
          <ul>${phase.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      `
    )
    .join("");
}

function renderFilters(filteredCount) {
  const chips = [];
  chips.push(`${filteredCount} 篇文章`);
  if (state.category !== "all") chips.push(categoryLabel(state.category));
  if (state.query.trim()) chips.push(`搜索：${state.query.trim()}`);
  if (state.unreadOnly) chips.push("只看未读");
  els.activeFilters.innerHTML = chips.map((chip) => `<span class="filter-pill">${escapeHtml(chip)}</span>`).join("");
  els.resultTitle.textContent = state.category === "all" ? "全部文章" : categoryLabel(state.category);
}

function renderArticles() {
  const articles = getFilteredArticles();
  renderFilters(articles.length);

  if (!articles.length) {
    els.articleList.innerHTML = `<div class="empty-state">没有找到匹配内容。换个关键词或清空筛选。</div>`;
    renderReader(null);
    return;
  }

  if (!state.selectedId || !articles.some((article) => article.id === state.selectedId)) {
    state.selectedId = articles[0].id;
  }

  els.articleList.innerHTML = articles
    .map((article) => {
      const isRead = state.readIds.has(article.id);
      const priorityClass = article.priority === "红线" || article.priority === "敏感" ? "red" : article.priority;
      return `
        <button class="article-card ${article.id === state.selectedId ? "active" : ""}" data-article="${escapeHtml(article.id)}" type="button">
          <div class="card-topline">
            <span class="priority ${escapeHtml(priorityClass)}">${escapeHtml(article.priority)}</span>
            <span class="read-dot ${isRead ? "read" : ""}" title="${isRead ? "已读" : "未读"}"></span>
          </div>
          <h3>${escapeHtml(article.title)}</h3>
          <p>${escapeHtml(article.summary)}</p>
          <div class="card-tags">${article.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </button>
      `;
    })
    .join("");

  renderReader(data.articles.find((article) => article.id === state.selectedId));
}

function renderTable(table) {
  if (!table) return "";
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${table.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderGuideGroup(articleId) {
  const group = data.guideGroups?.[articleId];
  if (!group) return "";
  return `
    <section class="guide-section">
      <h3>${escapeHtml(group.title)}</h3>
      <p>${escapeHtml(group.note)}</p>
      <div class="guide-gallery">
        ${group.items
          .map(
            (item) => `
              <a class="guide-card" href="${escapeHtml(item.src)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.label)}" loading="lazy">
                <span>${escapeHtml(item.label)}</span>
              </a>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSection(section) {
  return `
    <section class="content-section">
      <h3>${escapeHtml(section.heading)}</h3>
      ${(section.body || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      ${section.bullets ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${section.steps ? `<ol class="step-list">${section.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : ""}
      ${section.template ? `<pre class="template-box">${escapeHtml(section.template.join("\n"))}</pre>` : ""}
      ${section.table ? renderTable(section.table) : ""}
    </section>
  `;
}

function renderReader(article) {
  if (!article) {
    els.readerPane.innerHTML = `<div class="reader-empty"><div><h2>请选择一篇文章</h2><p>文章详情会显示在这里。</p></div></div>`;
    return;
  }

  const isRead = state.readIds.has(article.id);
  const danger = article.priority === "红线" || article.priority === "敏感";
  location.hash = article.id;

  els.readerPane.innerHTML = `
    <header class="reader-header">
      <div class="reader-meta">
        <span class="priority ${danger ? "red" : ""}">${escapeHtml(article.priority)}</span>
        <span class="tag">${escapeHtml(categoryLabel(article.category))}</span>
        <span class="tag">${escapeHtml(article.readTime)}</span>
      </div>
      <h2>${escapeHtml(article.title)}</h2>
      <p class="reader-summary">${escapeHtml(article.summary)}</p>
      <div class="reader-actions">
        <button class="reader-action primary" id="readToggle" type="button">${isRead ? "标为未读" : "标为已读"}</button>
        <button class="reader-action" id="copyLink" type="button">复制文章链接</button>
      </div>
    </header>

    <div class="callout ${danger ? "danger" : ""}">
      <ul>${article.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>

    ${renderGuideGroup(article.id)}

    ${article.sections.map(renderSection).join("")}

    <div class="source-note">
      资料来源：${escapeHtml(article.source)}。本网站为内部资料整理稿，制度和财务信息以公司正式文件及对应负责人确认为准。
    </div>
  `;

  document.querySelector("#readToggle")?.addEventListener("click", () => {
    if (state.readIds.has(article.id)) state.readIds.delete(article.id);
    else state.readIds.add(article.id);
    saveReadState();
    renderArticles();
  });

  document.querySelector("#copyLink")?.addEventListener("click", async () => {
    const link = `${location.href.split("#")[0]}#${article.id}`;
    try {
      await navigator.clipboard.writeText(link);
      document.querySelector("#copyLink").textContent = "已复制";
      setTimeout(() => renderReader(article), 900);
    } catch {
      prompt("复制这个链接", link);
    }
  });
}

function renderSources() {
  els.sourceList.innerHTML = data.sources
    .map(
      (source) => `
        <div class="source-card">
          <strong>${escapeHtml(source.name)}</strong>
          <span class="tag">${escapeHtml(source.type)}</span>
          ${source.sensitive ? `<span class="tag">含敏感信息</span>` : ""}
          <p>${escapeHtml(source.coverage)}</p>
          <code>${escapeHtml(source.path)}</code>
        </div>
      `
    )
    .join("");
}

function resetFilters() {
  state.query = "";
  state.category = "all";
  state.unreadOnly = false;
  els.searchInput.value = "";
  els.unreadOnly.checked = false;
  render();
}

function render() {
  renderCategories();
  renderArticles();
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderArticles();
});

els.categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  render();
});

els.articleList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-article]");
  if (!button) return;
  state.selectedId = button.dataset.article;
  renderArticles();
  if (window.matchMedia("(max-width: 1120px)").matches) {
    els.readerPane.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

els.unreadOnly.addEventListener("change", (event) => {
  state.unreadOnly = event.target.checked;
  renderArticles();
});

els.resetBtn.addEventListener("click", resetFilters);
els.printBtn.addEventListener("click", () => window.print());
els.sourceBtn.addEventListener("click", () => els.sourceDialog.showModal());
els.closeSourceBtn.addEventListener("click", () => els.sourceDialog.close());

function initFromHash() {
  const id = decodeURIComponent(location.hash.replace("#", ""));
  if (id && data.articles.some((article) => article.id === id)) {
    state.selectedId = id;
  } else {
    state.selectedId = data.articles[0]?.id || "";
  }
}

window.addEventListener("hashchange", initFromHash);

renderStats();
renderTimeline();
renderSources();
initFromHash();
render();
