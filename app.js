const storageKey = "zfl18-boardgame-rule-cards";
const now = new Date();

const complexityRank = { 轻: 1, 中: 2, 重: 3 };
const ruleTypeLabels = {
  forgets: "容易忘的规则",
  disputes: "常见争议",
  setup: "开局准备",
  scoring: "计分提醒"
};

function makeRule(text, mastered = false, type = "forgets") {
  return { id: crypto.randomUUID(), type, text, mastered, confirmed: false };
}

const seedGames = [
  {
    id: "seed-orleans",
    name: "奥尔良",
    minPlayers: 2,
    maxPlayers: 4,
    duration: 90,
    complexity: "中",
    lastPlayed: "2025-11-20",
    cover: "",
    forgets: ["商站建造前先确认道路或水路连接", "袋中随从抽完后不是重洗弃堆，而是从已回袋内容继续抽"],
    disputes: ["事件顺序和玩家动作结算先后", "科技板是否能替代所有同类随从"],
    setup: ["按人数放置货物板块", "每位玩家拿起始随从、商人和个人板"],
    scoring: ["货物分数", "商站和市民乘区块", "金币和建筑剩余加分"]
  },
  {
    id: "seed-gaia",
    name: "盖亚计划",
    minPlayers: 1,
    maxPlayers: 4,
    duration: 150,
    complexity: "重",
    lastPlayed: "2025-08-02",
    cover: "",
    forgets: ["联邦连接时卫星数量和能量消耗要一起核对", "研究升到顶必须拿对应科技板限制"],
    disputes: ["被动充能是否能拒绝", "星球改造费用受哪些能力影响"],
    setup: ["随机终局计分板和回合得分板", "按种族设置起始资源和母星"],
    scoring: ["终局计分板", "科技轨排名", "联邦和建筑分"]
  },
  {
    id: "seed-azul",
    name: "花砖物语",
    minPlayers: 2,
    maxPlayers: 4,
    duration: 45,
    complexity: "轻",
    lastPlayed: "2026-03-15",
    cover: "",
    forgets: ["每轮结束先铺墙再补工厂展示区", "地板线扣分后清空对应砖"],
    disputes: ["同色砖放置限制是否看整面墙", "中央区起始玩家标记是否必须拿"],
    setup: ["按人数放工厂圆盘", "每个圆盘补4块砖"],
    scoring: ["横竖相邻即时分", "完整行列和颜色终局加分"]
  }
];

function buildDefaultState() {
  const games = seedGames.map((game) => ({
    ...game,
    rules: ["forgets", "disputes", "setup", "scoring"].flatMap((type) => game[type].map((text) => makeRule(text, false, type)))
  }));
  return {
    selectedId: games[0]?.id || "",
    filterValues: { search: "", player: "all", complexity: "all", sort: "stale" },
    session: null,
    games,
    records: [
      { id: crypto.randomUUID(), gameId: "seed-azul", gameName: "花砖物语", players: 3, date: "2026-03-15" },
      { id: crypto.randomUUID(), gameId: "seed-orleans", gameName: "奥尔良", players: 4, date: "2025-11-20" },
      { id: crypto.randomUUID(), gameId: "seed-gaia", gameName: "盖亚计划", players: 2, date: "2025-08-02" }
    ]
  };
}

const defaultState = buildDefaultState();

function normalizeGame(raw) {
  const game = { ...raw };
  if (Array.isArray(game.rules)) {
    game.rules = game.rules.map((rule) => {
      if (typeof rule === "string") return makeRule(rule, false, "forgets");
      return {
        id: rule.id || crypto.randomUUID(),
        type: ruleTypeLabels[rule.type] ? rule.type : "forgets",
        text: String(rule.text ?? ""),
        mastered: Boolean(rule.mastered),
        confirmed: Boolean(rule.confirmed)
      };
    });
  } else {
    // 兼容旧版本按类别存储的字符串规则
    game.rules = ["forgets", "disputes", "setup", "scoring"].flatMap((type) =>
      (game[type] || []).map((text) => makeRule(text, false, type))
    );
  }
  return game;
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    const state = {
      ...structuredClone(defaultState),
      ...parsed,
      filterValues: { ...defaultState.filterValues, ...(parsed.filterValues || {}) },
      session: parsed.session
        ? {
            gameId: String(parsed.session.gameId || ""),
            players: Number(parsed.session.players) || 0
          }
        : null
    };
    state.games = Array.isArray(parsed.games) ? parsed.games.map(normalizeGame) : state.games;
    state.records = Array.isArray(parsed.records)
      ? parsed.records.map((record) => ({
          id: record.id || crypto.randomUUID(),
          gameId: String(record.gameId || ""),
          gameName: String(record.gameName || "已删除的游戏"),
          players: Number(record.players) || 0,
          date: String(record.date || "")
        }))
      : state.records;
    // 若进行中的游戏已被删除，则丢弃残留开局
    if (state.session && !state.games.some((game) => game.id === state.session.gameId)) {
      state.session = null;
    }
    return state;
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();
if (!state.selectedId || !state.games.some((game) => game.id === state.selectedId)) {
  state.selectedId = state.session?.gameId || state.games[0]?.id || "";
}

const els = {
  searchInput: document.querySelector("#searchInput"),
  playerFilter: document.querySelector("#playerFilter"),
  complexityFilter: document.querySelector("#complexityFilter"),
  sortMode: document.querySelector("#sortMode"),
  gameForm: document.querySelector("#gameForm"),
  nameInput: document.querySelector("#nameInput"),
  minPlayersInput: document.querySelector("#minPlayersInput"),
  maxPlayersInput: document.querySelector("#maxPlayersInput"),
  durationInput: document.querySelector("#durationInput"),
  complexityInput: document.querySelector("#complexityInput"),
  lastPlayedInput: document.querySelector("#lastPlayedInput"),
  coverInput: document.querySelector("#coverInput"),
  gameList: document.querySelector("#gameList"),
  detailView: document.querySelector("#detailView"),
  gameCount: document.querySelector("#gameCount"),
  ruleCount: document.querySelector("#ruleCount"),
  recordCount: document.querySelector("#recordCount"),
  staleGame: document.querySelector("#staleGame"),
  visibleCount: document.querySelector("#visibleCount"),
  startForm: document.querySelector("#startForm"),
  startGameSelect: document.querySelector("#startGameSelect"),
  startPlayersInput: document.querySelector("#startPlayersInput"),
  startHint: document.querySelector("#startHint"),
  startBtn: document.querySelector("#startBtn"),
  sessionBox: document.querySelector("#sessionBox"),
  recordList: document.querySelector("#recordList"),
  recordCountText: document.querySelector("#recordCountText")
};

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Math.max(0, Math.floor((now - date) / 86400000));
}

function getUnmastered(game) {
  return game.rules.filter((rule) => !rule.mastered);
}

function getSession() {
  return state.session;
}

function getSessionGame() {
  const session = getSession();
  return session ? state.games.find((game) => game.id === session.gameId) : undefined;
}

function getFilteredGames() {
  const keyword = els.searchInput.value.trim();
  const player = els.playerFilter.value;
  const complexity = els.complexityFilter.value;
  const games = state.games.filter((game) => {
    const text = `${game.name}${game.rules.map((rule) => rule.text).join("")}`;
    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesPlayer = player === "all" || (Number(player) >= game.minPlayers && Number(player) <= game.maxPlayers);
    const matchesComplexity = complexity === "all" || game.complexity === complexity;
    return matchesKeyword && matchesPlayer && matchesComplexity;
  });

  if (els.sortMode.value === "name") return games.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (els.sortMode.value === "complexity") {
    return games.sort((a, b) => complexityRank[b.complexity] - complexityRank[a.complexity]);
  }
  return games.sort((a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed));
}

function renderSummary() {
  const allRuleCount = state.games.reduce((sum, game) => sum + game.rules.length, 0);
  const stale = [...state.games].sort((a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed))[0];
  els.gameCount.textContent = state.games.length;
  els.ruleCount.textContent = allRuleCount;
  els.recordCount.textContent = state.records.length;
  els.staleGame.textContent = stale ? `${daysSince(stale.lastPlayed)}天` : "-";
}

function renderList() {
  const games = getFilteredGames();
  els.visibleCount.textContent = `${games.length}个匹配`;
  els.gameList.innerHTML =
    games
      .map((game) => {
        const activeId = state.session?.gameId || state.selectedId;
        const selected = game.id === activeId ? "selected" : "";
        const inSession = state.session?.gameId === game.id ? "in-session" : "";
        return `
          <article class="game-card ${selected} ${inSession}" data-game-id="${game.id}">
            <div class="cover">
              ${
                game.cover
                  ? `<img src="${game.cover}" alt="${escapeHtml(game.name)}封面" />`
                  : `<span>${escapeHtml(game.name.slice(0, 2))}</span>`
              }
              <span class="stale-ribbon">${daysSince(game.lastPlayed)}天未玩</span>
              ${inSession ? `<span class="session-ribbon">开局中</span>` : ""}
            </div>
            <div class="game-body">
              <h3>${escapeHtml(game.name)}</h3>
              <div class="game-meta">
                <span class="pill">${game.minPlayers}-${game.maxPlayers}人</span>
                <span class="pill">${game.duration}分钟</span>
                <span class="pill heavy">${escapeHtml(game.complexity)}</span>
              </div>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的桌游。</p>`;
}

function renderDetail() {
  const session = getSession();
  const fallback = state.games.find((item) => item.id === state.selectedId) || state.games[0];
  const game = session ? getSessionGame() : fallback;
  if (!game) {
    els.detailView.innerHTML = `<p class="empty">先添加一个桌游。</p>`;
    return;
  }
  state.selectedId = game.id;

  const unmastered = getUnmastered(game);
  const confirmedCount = unmastered.filter((rule) => rule.confirmed).length;
  const banner = session
    ? `
      <div class="review-banner">
        <strong>开局复习中 · ${escapeHtml(game.name)} · ${session.players}人</strong>
        <span>已确认 ${confirmedCount}/${unmastered.length} 条未掌握规则，全部确认后才能记为已玩</span>
        <div class="progress"><i style="width:${unmastered.length ? Math.round((confirmedCount / unmastered.length) * 100) : 100}%"></i></div>
      </div>`
    : "";

  els.detailView.innerHTML = `
    <div class="quick-card">
      ${banner}
      <div class="detail-cover">
        ${game.cover ? `<img src="${game.cover}" alt="${escapeHtml(game.name)}封面" />` : `<span>${escapeHtml(game.name.slice(0, 2))}</span>`}
      </div>
      <div>
        <h2>${escapeHtml(game.name)}</h2>
        <div class="game-meta">
          <span class="pill">${game.minPlayers}-${game.maxPlayers}人</span>
          <span class="pill">${game.duration}分钟</span>
          <span class="pill heavy">${escapeHtml(game.complexity)}</span>
          <span class="pill">${daysSince(game.lastPlayed)}天未玩</span>
        </div>
      </div>
      ${renderRuleSection(game, "forgets", session)}
      ${renderRuleSection(game, "disputes", session)}
      ${renderRuleSection(game, "setup", session)}
      ${renderRuleSection(game, "scoring", session)}
      <form class="add-rule" id="ruleForm">
        <select id="ruleTypeInput">
          <option value="forgets">容易忘的规则</option>
          <option value="disputes">常见争议</option>
          <option value="setup">开局准备</option>
          <option value="scoring">计分提醒</option>
        </select>
        <textarea id="ruleTextInput" rows="3" placeholder="补充一条聚会前要看的提醒" required></textarea>
        <button class="primary" type="submit">加入规则卡片</button>
      </form>
      <div class="detail-actions">
        ${
          session
            ? `<button class="primary" id="finishBtn" type="button" ${
                confirmedCount === unmastered.length ? "" : "disabled"
              }>全部已确认 · 记为已玩</button>
               <button id="cancelSessionBtn" type="button">取消本次开局</button>`
            : `<button class="primary" id="startHereBtn" type="button">准备开局</button>
               <button id="deleteGameBtn" type="button">删除桌游</button>`
        }
      </div>
      ${session && confirmedCount < unmastered.length ? `<p class="form-hint">还有 ${unmastered.length - confirmedCount} 条未掌握规则未确认，不能记为已玩。</p>` : ""}
    </div>
  `;
}

function rulesOfType(game, type) {
  return game.rules.filter((rule) => rule.type === type);
}

function renderRuleSection(game, type, session) {
  const items = rulesOfType(game, type);
  return `
    <section class="rule-section">
      <h3>${ruleTypeLabels[type]}</h3>
      <ul class="rule-list">
        ${
          items
            .map((rule) => {
              const masteredClass = rule.mastered ? "mastered" : "";
              const checkbox = session
                ? `<label class="confirm-check" title="本次已确认">
                     <input type="checkbox" data-rule-id="${rule.id}" ${rule.confirmed ? "checked" : ""} ${
                    rule.mastered ? "disabled" : ""
                  } />
                     <span>本次确认</span>
                   </label>`
                : `<button type="button" class="link-btn" data-master-id="${rule.id}" title="切换已掌握状态">
                     ${rule.mastered ? "★ 已掌握" : "☆ 未掌握"}
                   </button>`;
              return `
                <li class="${masteredClass}" data-rule-row="${rule.id}">
                  <span class="rule-text">${escapeHtml(rule.text)}</span>
                  <span class="rule-controls">
                    ${checkbox}
                    <button type="button" title="删除" data-rule-delete="${rule.id}">×</button>
                  </span>
                </li>
              `;
            })
            .join("") || `<li><span class="empty">暂无内容。</span></li>`
        }
      </ul>
    </section>
  `;
}

function renderStartPanel() {
  const session = getSession();
  els.startForm.hidden = Boolean(session);
  els.sessionBox.hidden = !session;

  if (!session) {
    els.startGameSelect.innerHTML =
      state.games
        .map((game) => `<option value="${game.id}">${escapeHtml(game.name)}（${game.minPlayers}-${game.maxPlayers}人 · ${escapeHtml(game.complexity)}）</option>`)
        .join("") || `<option value="">暂无游戏，请先添加</option>`;
    if (state.selectedId && state.games.some((game) => game.id === state.selectedId)) {
      els.startGameSelect.value = state.selectedId;
    }
    syncStartHint();
  } else {
    const game = getSessionGame();
    if (!game) return;
    const unmastered = getUnmastered(game);
    const confirmed = unmastered.filter((rule) => rule.confirmed).length;
    const done = confirmed === unmastered.length;
    els.sessionBox.innerHTML = `
      <div class="session-head">
        <strong>${escapeHtml(game.name)}</strong>
        <span class="pill">${session.players}人</span>
      </div>
      <p class="form-hint">复习进度：${confirmed}/${unmastered.length} 条未掌握规则已确认${
      unmastered.length === 0 ? "（没有未掌握规则）" : ""
    }</p>
      <div class="progress"><i style="width:${unmastered.length ? Math.round((confirmed / unmastered.length) * 100) : 100}%"></i></div>
      <button class="primary" id="finishSessionBtn" type="button" ${done ? "" : "disabled"}>
        ${done ? "确认完成 · 记为已玩" : "尚有规则未确认"}
      </button>
      <button id="abortSessionBtn" type="button">取消开局（保留勾选）</button>
    `;
  }
}

function syncStartHint() {
  const game = state.games.find((item) => item.id === els.startGameSelect.value);
  const players = Number(els.startPlayersInput.value);
  const submit = els.startBtn;
  if (!game) {
    els.startHint.textContent = "请先在收藏中添加桌游。";
    els.startHint.className = "form-hint warn";
    submit.disabled = true;
    return;
  }
  if (!players) {
    els.startHint.textContent = "请填写本次人数。";
    els.startHint.className = "form-hint warn";
    submit.disabled = true;
    return;
  }
  if (players < game.minPlayers || players > game.maxPlayers) {
    els.startHint.textContent = `人数不适配：${game.name} 支持 ${game.minPlayers}-${game.maxPlayers} 人，当前 ${players} 人，不能开局。`;
    els.startHint.className = "form-hint warn";
    submit.disabled = true;
    return;
  }
  els.startHint.textContent = `人数适配，可以开局。共 ${getUnmastered(game).length} 条未掌握规则需要本次确认。`;
  els.startHint.className = "form-hint ok";
  submit.disabled = false;
}

function renderRecords() {
  els.recordCountText.textContent = `${state.records.length}条记录`;
  els.recordList.innerHTML =
    state.records
      .map(
        (record) => `
          <li>
            <div class="record-date">
              <strong>${escapeHtml(record.date)}</strong>
            </div>
            <div class="record-main">
              <strong>${escapeHtml(record.gameName)}</strong>
              <span class="game-meta">
                <span class="pill">${record.players}人</span>
              </span>
            </div>
          </li>`
      )
      .join("") || `<li class="empty">还没有开局记录。</li>`;
}

function renderAll() {
  applyFilterInputs();
  saveState();
  renderSummary();
  renderList();
  renderDetail();
  renderStartPanel();
  renderRecords();
}

function applyFilterInputs() {
  els.searchInput.value = state.filterValues.search;
  els.playerFilter.value = state.filterValues.player;
  els.complexityFilter.value = state.filterValues.complexity;
  els.sortMode.value = state.filterValues.sort;
}

function readFilterValues() {
  state.filterValues = {
    search: els.searchInput.value,
    player: els.playerFilter.value,
    complexity: els.complexityFilter.value,
    sort: els.sortMode.value
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addGame(event) {
  event.preventDefault();
  const minPlayers = Number(els.minPlayersInput.value);
  const maxPlayers = Math.max(minPlayers, Number(els.maxPlayersInput.value));
  const cover = await readFileAsDataUrl(els.coverInput.files[0]);
  const game = {
    id: crypto.randomUUID(),
    name: els.nameInput.value.trim(),
    minPlayers,
    maxPlayers,
    duration: Number(els.durationInput.value),
    complexity: els.complexityInput.value,
    lastPlayed: els.lastPlayedInput.value,
    cover,
    rules: [
      { ...makeRule("本局开始前先补充容易忘的规则。"), type: "forgets" },
      { ...makeRule("整理组件并按人数调整初始设置。"), type: "setup" },
      { ...makeRule("确认终局计分项和即时得分项。"), type: "scoring" }
    ]
  };
  state.games.unshift(game);
  state.selectedId = game.id;
  els.gameForm.reset();
  setDefaultDate();
  renderAll();
}

function addRule(event) {
  event.preventDefault();
  const session = getSession();
  const game = session ? getSessionGame() : state.games.find((item) => item.id === state.selectedId);
  if (!game) return;
  const type = document.querySelector("#ruleTypeInput").value;
  const text = document.querySelector("#ruleTextInput").value.trim();
  if (!text) return;
  const rule = { ...makeRule(text), type };
  game.rules.push(rule);
  renderAll();
}

function startSession(event) {
  event.preventDefault();
  const game = state.games.find((item) => item.id === els.startGameSelect.value);
  const players = Number(els.startPlayersInput.value);
  if (!game || !players || players < game.minPlayers || players > game.maxPlayers) return;
  // 新开局：清空所有规则的本次勾选
  game.rules.forEach((rule) => {
    rule.confirmed = false;
  });
  state.session = { gameId: game.id, players };
  state.selectedId = game.id;
  renderAll();
}

function finishSession() {
  const session = getSession();
  const game = getSessionGame();
  if (!session || !game) return;
  const unmastered = getUnmastered(game);
  if (unmastered.some((rule) => !rule.confirmed)) return;

  const todayString = localDateString(new Date());
  game.lastPlayed = todayString;
  game.rules.forEach((rule) => {
    rule.confirmed = false; // 成功后清空本次勾选
  });
  state.records.unshift({
    id: crypto.randomUUID(),
    gameId: game.id,
    gameName: game.name,
    players: session.players,
    date: todayString
  });
  state.session = null;
  renderAll();
}

function abortSession(keepChecks) {
  if (!keepChecks) {
    const game = getSessionGame();
    game?.rules.forEach((rule) => {
      rule.confirmed = false;
    });
  }
  state.session = null;
  renderAll();
}

function setDefaultDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  els.lastPlayedInput.value = localDateString(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---- 事件绑定 ----

els.searchInput.addEventListener("input", () => {
  readFilterValues();
  saveState();
  renderList();
});
els.playerFilter.addEventListener("change", () => {
  readFilterValues();
  renderAll();
});
els.complexityFilter.addEventListener("change", () => {
  readFilterValues();
  renderAll();
});
els.sortMode.addEventListener("change", () => {
  readFilterValues();
  renderList();
});
els.gameForm.addEventListener("submit", addGame);

els.gameList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-game-id]");
  if (!card) return;
  // 开局复习中详情锁定在本局游戏，需先取消开局才能切换
  if (state.session) return;
  state.selectedId = card.dataset.gameId;
  renderAll();
});

els.startGameSelect.addEventListener("change", () => {
  const game = state.games.find((item) => item.id === els.startGameSelect.value);
  if (game) els.startPlayersInput.value = game.minPlayers;
  state.selectedId = game?.id || state.selectedId;
  syncStartHint();
  saveState();
  renderList();
  renderDetail();
});
els.startPlayersInput.addEventListener("input", syncStartHint);
els.startForm.addEventListener("submit", startSession);

els.sessionBox.addEventListener("click", (event) => {
  if (event.target.closest("#finishSessionBtn")) finishSession();
  if (event.target.closest("#abortSessionBtn")) abortSession(true);
});

els.detailView.addEventListener("submit", addRule);

els.detailView.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-rule-id]");
  if (!checkbox) return;
  const game = getSessionGame();
  if (!game) return;
  const rule = game.rules.find((item) => item.id === checkbox.dataset.ruleId);
  if (!rule || rule.mastered) return;
  rule.confirmed = checkbox.checked;
  saveState();
  renderDetail();
  renderStartPanel();
});

els.detailView.addEventListener("click", (event) => {
  const session = getSession();
  const game = session ? getSessionGame() : state.games.find((item) => item.id === state.selectedId);
  if (!game) return;

  const masterButton = event.target.closest("[data-master-id]");
  if (masterButton && !session) {
    const rule = game.rules.find((item) => item.id === masterButton.dataset.masterId);
    if (rule) {
      rule.mastered = !rule.mastered;
      rule.confirmed = false;
      renderAll();
    }
    return;
  }

  const deleteButton = event.target.closest("[data-rule-delete]");
  if (deleteButton) {
    game.rules = game.rules.filter((rule) => rule.id !== deleteButton.dataset.ruleDelete);
    renderAll();
    return;
  }

  if (event.target.closest("#finishBtn")) {
    finishSession();
    return;
  }
  if (event.target.closest("#cancelSessionBtn")) {
    abortSession(true);
    return;
  }
  if (event.target.closest("#startHereBtn")) {
    if (state.games.length === 0) return;
    els.startGameSelect.value = game.id;
    els.startPlayersInput.value = game.minPlayers;
    els.startGameSelect.scrollIntoView({ behavior: "smooth", block: "center" });
    syncStartHint();
    return;
  }
  if (event.target.closest("#deleteGameBtn")) {
    if (session) return; // 开局中的游戏不能删除
    state.games = state.games.filter((item) => item.id !== game.id);
    state.selectedId = state.games[0]?.id || "";
    renderAll();
  }
});

setDefaultDate();
renderAll();
