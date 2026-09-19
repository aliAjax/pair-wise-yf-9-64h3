const storageKey = "zfl18-boardgame-rule-cards";
const RULE_KEYS = ["forgets", "disputes", "setup", "scoring"];
const today = new Date();

function makeRule(text) {
  return { id: crypto.randomUUID(), text };
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultState() {
  const orleans = {
    id: crypto.randomUUID(),
    name: "奥尔良",
    minPlayers: 2,
    maxPlayers: 4,
    duration: 90,
    complexity: "中",
    lastPlayed: "2025-11-20",
    cover: "",
    forgets: ["商站建造前先确认道路或水路连接", "袋中随从抽完后不是重洗弃堆，而是从已回袋内容继续抽"].map(makeRule),
    disputes: ["事件顺序和玩家动作结算先后", "科技板是否能替代所有同类随从"].map(makeRule),
    setup: ["按人数放置货物板块", "每位玩家拿起始随从、商人和个人板"].map(makeRule),
    scoring: ["货物分数", "商站和市民乘区块", "金币和建筑剩余加分"].map(makeRule)
  };
  const gaia = {
    id: crypto.randomUUID(),
    name: "盖亚计划",
    minPlayers: 1,
    maxPlayers: 4,
    duration: 150,
    complexity: "重",
    lastPlayed: "2025-08-02",
    cover: "",
    forgets: ["联邦连接时卫星数量和能量消耗要一起核对", "研究升到顶必须拿对应科技板限制"].map(makeRule),
    disputes: ["被动充能是否能拒绝", "星球改造费用受哪些能力影响"].map(makeRule),
    setup: ["随机终局计分板和回合得分板", "按种族设置起始资源和母星"].map(makeRule),
    scoring: ["终局计分板", "科技轨排名", "联邦和建筑分"].map(makeRule)
  };
  const azuleja = {
    id: crypto.randomUUID(),
    name: "花砖物语",
    minPlayers: 2,
    maxPlayers: 4,
    duration: 45,
    complexity: "轻",
    lastPlayed: "2026-03-15",
    cover: "",
    forgets: ["每轮结束先铺墙再补工厂展示区", "地板线扣分后清空对应砖"].map(makeRule),
    disputes: ["同色砖放置限制是否看整面墙", "中央区起始玩家标记是否必须拿"].map(makeRule),
    setup: ["按人数放工厂圆盘", "每个圆盘补4块砖"].map(makeRule),
    scoring: ["横竖相邻即时分", "完整行列和颜色终局加分"].map(makeRule)
  };
  const games = [orleans, gaia, azuleja];
  return {
    selectedId: orleans.id,
    games,
    // 进行中的开局：{ gameId, players, startedAt, confirmed: [ruleId] }
    session: null,
    // 成功开局后保留的记录
    playLogs: [
      {
        id: crypto.randomUUID(),
        gameId: azuleja.id,
        gameName: azuleja.name,
        players: 4,
        date: azuleja.lastPlayed,
        finishedAt: `${azuleja.lastPlayed}T20:30:00.000Z`,
        ruleCount: RULE_KEYS.reduce((sum, key) => sum + azuleja[key].length, 0)
      },
      {
        id: crypto.randomUUID(),
        gameId: orleans.id,
        gameName: orleans.name,
        players: 3,
        date: orleans.lastPlayed,
        finishedAt: `${orleans.lastPlayed}T15:10:00.000Z`,
        ruleCount: RULE_KEYS.reduce((sum, key) => sum + orleans[key].length, 0)
      }
    ]
  };
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => {
      if (typeof rule === "string") return makeRule(rule);
      if (rule && typeof rule.text === "string") {
        return { id: typeof rule.id === "string" ? rule.id : crypto.randomUUID(), text: rule.text };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeGame(game) {
  return {
    id: typeof game.id === "string" ? game.id : crypto.randomUUID(),
    name: String(game.name || ""),
    minPlayers: Number(game.minPlayers) || 1,
    maxPlayers: Number(game.maxPlayers) || 1,
    duration: Number(game.duration) || 60,
    complexity: ["轻", "中", "重"].includes(game.complexity) ? game.complexity : "中",
    lastPlayed: typeof game.lastPlayed === "string" ? game.lastPlayed : todayString(),
    cover: typeof game.cover === "string" ? game.cover : "",
    forgets: normalizeRules(game.forgets),
    disputes: normalizeRules(game.disputes),
    setup: normalizeRules(game.setup),
    scoring: normalizeRules(game.scoring)
  };
}

function loadState() {
  let parsed = null;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      parsed = JSON.parse(saved);
    } catch {
      parsed = null;
    }
  }
  const state = { ...createDefaultState(), ...(parsed || {}) };
  state.games = Array.isArray(state.games) ? state.games.map(normalizeGame) : [];
  state.playLogs = Array.isArray(state.playLogs) ? state.playLogs : [];

  // 进行中的开局必须对应仍存在的游戏，勾选 id 也需随规则增删修剪
  if (state.session) {
    const sessionGame = state.games.find((game) => game.id === state.session.gameId);
    if (!sessionGame) {
      state.session = null;
    } else {
      const validIds = new Set(getAllRules(sessionGame).map((rule) => rule.id));
      state.session.players = Number(state.session.players) || sessionGame.minPlayers;
      state.session.confirmed = Array.isArray(state.session.confirmed)
        ? state.session.confirmed.filter((id) => validIds.has(id))
        : [];
    }
  }
  return state;
}

let state = loadState();
if (!state.selectedId || !state.games.some((game) => game.id === state.selectedId)) {
  state.selectedId = state.games[0]?.id || "";
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
  playLogList: document.querySelector("#playLogList"),
  logTotalCount: document.querySelector("#logTotalCount"),
  detailView: document.querySelector("#detailView"),
  gameCount: document.querySelector("#gameCount"),
  ruleCount: document.querySelector("#ruleCount"),
  playLogCount: document.querySelector("#playLogCount"),
  staleGame: document.querySelector("#staleGame"),
  visibleCount: document.querySelector("#visibleCount")
};

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Math.max(0, Math.floor((today - date) / 86400000));
}

function getAllRules(game) {
  return RULE_KEYS.flatMap((key) => game[key].map((rule) => ({ ...rule, key })));
}

function getFilteredGames() {
  const keyword = els.searchInput.value.trim();
  const player = els.playerFilter.value;
  const complexity = els.complexityFilter.value;
  const games = state.games.filter((game) => {
    const text = `${game.name}${getAllRules(game).map((rule) => rule.text).join("")}`;
    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesPlayer = player === "all" || (Number(player) >= game.minPlayers && Number(player) <= game.maxPlayers);
    const matchesComplexity = complexity === "all" || game.complexity === complexity;
    return matchesKeyword && matchesPlayer && matchesComplexity;
  });

  if (els.sortMode.value === "name") return games.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (els.sortMode.value === "complexity") {
    const rank = { 轻: 1, 中: 2, 重: 3 };
    return games.sort((a, b) => rank[b.complexity] - rank[a.complexity]);
  }
  return games.sort((a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed));
}

function renderSummary() {
  const allRuleCount = state.games.reduce((sum, game) => sum + getAllRules(game).length, 0);
  const stale = [...state.games].sort(
    (a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed)
  )[0];
  els.gameCount.textContent = state.games.length;
  els.ruleCount.textContent = allRuleCount;
  els.playLogCount.textContent = state.playLogs.length;
  els.staleGame.textContent = stale ? `${daysSince(stale.lastPlayed)}天` : "-";
}

function renderList() {
  const games = getFilteredGames();
  els.visibleCount.textContent = `${games.length}个匹配`;
  els.gameList.innerHTML =
    games
      .map((game) => {
        const selected = game.id === state.selectedId ? "selected" : "";
        const inSession = state.session?.gameId === game.id;
        return `
          <article class="game-card ${selected}" data-game-id="${game.id}">
            <div class="cover">
              ${
                game.cover
                  ? `<img src="${game.cover}" alt="${escapeHtml(game.name)}封面" />`
                  : `<span>${escapeHtml(game.name.slice(0, 2))}</span>`
              }
              ${inSession ? `<span class="session-ribbon">复习中</span>` : ""}
              <span class="stale-ribbon">${daysSince(game.lastPlayed)}天未玩</span>
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

function renderPlayLogs() {
  els.logTotalCount.textContent = `${state.playLogs.length}条`;
  els.playLogList.innerHTML = state.playLogs.length
    ? state.playLogs
        .map(
          (log) => `
            <li>
              <span class="log-name">${escapeHtml(log.gameName)}</span>
              <span class="log-players">${Number(log.players)}人局</span>
              <time>${escapeHtml(log.date)}</time>
            </li>
          `
        )
        .join("")
    : `<p class="empty">还没有开局记录，完成一次复习并记为已玩后会出现在这里。</p>`;
}

function renderDetail() {
  const game =
    state.games.find((item) => item.id === state.selectedId) || state.games[0];
  if (!game) {
    els.detailView.innerHTML = `<p class="empty">先添加一个桌游。</p>`;
    return;
  }
  state.selectedId = game.id;

  const activeSession = state.session;
  const isActive = activeSession?.gameId === game.id;
  const otherGame =
    activeSession && !isActive
      ? state.games.find((item) => item.id === activeSession.gameId)
      : null;
  const confirmedIds = new Set(isActive ? activeSession.confirmed : []);

  els.detailView.innerHTML = `
    <div class="quick-card">
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

      ${
        otherGame
          ? `
            <div class="notice-banner">
              <span>正在复习《${escapeHtml(otherGame.name)}》，同一时间只能进行一个开局。</span>
              <button id="jumpSessionBtn" type="button">前往查看</button>
            </div>
          `
          : ""
      }

      ${isActive ? renderSessionBox(game, confirmedIds) : !activeSession ? renderStartBox(game) : ""}

      ${renderRuleSection("容易忘的规则", "forgets", game.forgets, isActive, confirmedIds)}
      ${renderRuleSection("常见争议", "disputes", game.disputes, isActive, confirmedIds)}
      ${renderRuleSection("开局准备", "setup", game.setup, isActive, confirmedIds)}
      ${renderRuleSection("计分提醒", "scoring", game.scoring, isActive, confirmedIds)}

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
        <button id="deleteGameBtn" class="danger" type="button">删除桌游</button>
      </div>
    </div>
  `;
}

function renderStartBox(game) {
  return `
    <div class="start-box">
      <h3>准备开局</h3>
      <p class="box-desc">输入本次实际到场人数，人数适配（${game.minPlayers}-${game.maxPlayers} 人）才能开始复习。</p>
      <label>
        本次人数
        <input id="startPlayersInput" type="number" min="${game.minPlayers}" max="${game.maxPlayers}" step="1" value="${game.minPlayers}" />
      </label>
      <p id="startHint" class="start-hint" aria-live="polite"></p>
      <button class="primary" id="startSessionBtn" type="button">开始本次复习</button>
    </div>
  `;
}

function renderSessionBox(game, confirmedIds) {
  const session = state.session;
  const total = getAllRules(game).length;
  const confirmedCount = confirmedIds.size;
  const allConfirmed = total > 0 && confirmedCount === total;
  const percent = total ? Math.round((confirmedCount / total) * 100) : 0;
  return `
    <div class="session-box">
      <div class="session-head">
        <h3>本次开局复习</h3>
        <span class="pill">${Number(session.players)}人</span>
      </div>
      <div class="progress"><i style="width:${percent}%"></i></div>
      <p class="box-desc">
        已确认 ${confirmedCount}/${total} 张规则卡。
        ${total === 0 ? "请先添加规则卡。" : allConfirmed ? "规则已全部掌握，可以记为已玩。" : "全部确认后才能记为已玩。"}
      </p>
      <div class="detail-actions">
        <button class="primary" id="completeSessionBtn" type="button" ${allConfirmed ? "" : "disabled"}>
          记为已玩并结束
        </button>
        <button id="abandonSessionBtn" type="button">放弃本次</button>
      </div>
    </div>
  `;
}

function renderRuleSection(title, key, items, isActive, confirmedIds) {
  return `
    <section class="rule-section">
      <h3>${title}</h3>
      <ul class="rule-list">
        ${
          items
            .map((rule) => {
              const checked = confirmedIds.has(rule.id);
              return `
                <li class="${checked ? "confirmed" : ""}">
                  ${
                    isActive
                      ? `
                        <label class="confirm-check">
                          <input type="checkbox" data-rule-confirm="${rule.id}" ${checked ? "checked" : ""} />
                          已确认
                        </label>
                      `
                      : ""
                  }
                  <span class="rule-text">${escapeHtml(rule.text)}</span>
                  <button type="button" title="删除" data-rule-key="${key}" data-rule-id="${rule.id}">×</button>
                </li>
              `;
            })
            .join("") || `<li><span class="rule-text">暂无内容。</span></li>`
        }
      </ul>
    </section>
  `;
}

function renderAll() {
  saveState();
  renderSummary();
  renderList();
  renderPlayLogs();
  renderDetail();
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
    forgets: [makeRule("本局开始前先补充容易忘的规则。")],
    disputes: [],
    setup: [makeRule("整理组件并按人数调整初始设置。")],
    scoring: [makeRule("确认终局计分项和即时得分项。")]
  };
  state.games.unshift(game);
  state.selectedId = game.id;
  els.gameForm.reset();
  setDefaultDate();
  renderAll();
}

function setDefaultDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  els.lastPlayedInput.value = date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => toast.remove(), 2600);
}

function validateStartInput() {
  const game = state.games.find((item) => item.id === state.selectedId);
  const input = els.detailView.querySelector("#startPlayersInput");
  const button = els.detailView.querySelector("#startSessionBtn");
  const hint = els.detailView.querySelector("#startHint");
  if (!game || !input || !button || !hint) return;
  const players = Number(input.value);
  const valid = Number.isInteger(players) && players >= game.minPlayers && players <= game.maxPlayers;
  button.disabled = !valid;
  hint.className = `start-hint ${valid ? "ok" : "err"}`;
  hint.textContent = valid
    ? `${players} 人适配，可以开始复习。`
    : `人数不适配：${escapeHtml(game.name)} 需要 ${game.minPlayers}-${game.maxPlayers} 人。`;
}

function startSession() {
  const game = state.games.find((item) => item.id === state.selectedId);
  const input = els.detailView.querySelector("#startPlayersInput");
  if (!game || !input) return;
  const players = Number(input.value);
  if (!(Number.isInteger(players) && players >= game.minPlayers && players <= game.maxPlayers)) return;
  state.session = {
    gameId: game.id,
    players,
    startedAt: new Date().toISOString(),
    confirmed: []
  };
  renderAll();
}

function completeSession() {
  const session = state.session;
  if (!session) return;
  const game = state.games.find((item) => item.id === session.gameId);
  if (!game) {
    state.session = null;
    renderAll();
    return;
  }
  const total = getAllRules(game).length;
  if (total === 0 || session.confirmed.length !== total) return;

  const date = todayString();
  game.lastPlayed = date;
  state.playLogs.unshift({
    id: crypto.randomUUID(),
    gameId: game.id,
    gameName: game.name,
    players: session.players,
    date,
    finishedAt: new Date().toISOString(),
    ruleCount: total
  });
  state.session = null; // 成功后清空本次勾选（整个开局会话）
  renderAll();
  showToast(`《${game.name}》已记为 ${date} 游玩，开局记录已保留。`);
}

function abandonSession() {
  const game = state.games.find((item) => item.id === state.session?.gameId);
  const message = game
    ? `放弃《${game.name}》本次复习？已勾选的确认会被清空，且不会更新游玩日期。`
    : "放弃本次复习？";
  if (!window.confirm(message)) return;
  state.session = null;
  renderAll();
}

els.searchInput.addEventListener("input", renderAll);
els.playerFilter.addEventListener("change", renderAll);
els.complexityFilter.addEventListener("change", renderAll);
els.sortMode.addEventListener("change", renderAll);
els.gameForm.addEventListener("submit", addGame);

els.gameList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-game-id]");
  if (!card) return;
  state.selectedId = card.dataset.gameId;
  renderAll();
});

els.detailView.addEventListener("submit", (event) => {
  if (event.target.id !== "ruleForm") return;
  event.preventDefault();
  const game = state.games.find((item) => item.id === state.selectedId);
  if (!game) return;
  const key = document.querySelector("#ruleTypeInput").value;
  const text = document.querySelector("#ruleTextInput").value.trim();
  if (!text) return;
  game[key].push(makeRule(text));
  renderAll();
});

els.detailView.addEventListener("input", (event) => {
  if (event.target.id === "startPlayersInput") validateStartInput();
});

els.detailView.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-rule-confirm]");
  if (!checkbox || !state.session) return;
  const ruleId = checkbox.dataset.ruleConfirm;
  const confirmed = new Set(state.session.confirmed);
  if (checkbox.checked) confirmed.add(ruleId);
  else confirmed.delete(ruleId);
  state.session.confirmed = [...confirmed];
  renderAll();
});

els.detailView.addEventListener("click", (event) => {
  const ruleButton = event.target.closest("[data-rule-key]");
  const startButton = event.target.closest("#startSessionBtn");
  const completeButton = event.target.closest("#completeSessionBtn");
  const abandonButton = event.target.closest("#abandonSessionBtn");
  const jumpButton = event.target.closest("#jumpSessionBtn");
  const deleteButton = event.target.closest("#deleteGameBtn");

  if (jumpButton && state.session) {
    state.selectedId = state.session.gameId;
    renderAll();
    return;
  }

  if (startButton) {
    startSession();
    return;
  }

  if (completeButton) {
    completeSession();
    return;
  }

  if (abandonButton) {
    abandonSession();
    return;
  }

  const game = state.games.find((item) => item.id === state.selectedId);
  if (!game) return;

  if (ruleButton) {
    const key = ruleButton.dataset.ruleKey;
    const ruleId = ruleButton.dataset.ruleId;
    game[key] = game[key].filter((rule) => rule.id !== ruleId);
    // 被删规则若已勾选，同步从本次确认中移除
    if (state.session?.gameId === game.id) {
      state.session.confirmed = state.session.confirmed.filter((id) => id !== ruleId);
    }
    renderAll();
  }

  if (deleteButton) {
    state.games = state.games.filter((item) => item.id !== game.id);
    if (state.session?.gameId === game.id) state.session = null;
    state.selectedId = state.games[0]?.id || "";
    renderAll();
  }
});

setDefaultDate();
renderAll();
validateStartInput();
