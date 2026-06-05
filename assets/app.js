const DATA_URL = "./data/latest.json";

const roleMention = "<@&1245930262991339591>";

const els = {
  leagueSelect: document.querySelector("#leagueSelect"),
  dateInput: document.querySelector("#dateInput"),
  limitSelect: document.querySelector("#limitSelect"),
  runBtn: document.querySelector("#runBtn"),
  copyBtn: document.querySelector("#copyBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  progressFill: document.querySelector("#progressFill"),
  statusText: document.querySelector("#statusText"),
  top10Output: document.querySelector("#top10Output"),
  top50Output: document.querySelector("#top50Output"),
  top100Output: document.querySelector("#top100Output"),
  allOutput: document.querySelector("#allOutput"),
  discordOutput: document.querySelector("#discordOutput"),
};

let latestResult = null;

function todayTitle() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}`;
}

els.dateInput.value = todayTitle();

function setStatus(text, percent = null) {
  els.statusText.textContent = text;
  if (percent !== null) {
    els.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function toSortedRows(counter) {
  return Object.entries(counter || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hant"));
}

function layout(counter, n = 999) {
  const rows = toSortedRows(counter).slice(0, n);
  if (rows.length === 0) return "尚無資料";
  return rows.map((row, index) => `${index + 1}. ${row.name}: ${row.count}`).join("\n");
}

function buildDiscordText({ date, data }) {
  const leagueName = data.leagueName || data.league || "傳奇";
  const snapshots = data.snapshots || {};

  return `${roleMention} 
# ${date}本週${leagueName}段位角色使用率
**前10名玩家：(角色使用率取前20名)**
\`\`\`
${layout(snapshots.top10, 20)}
\`\`\`
**前50名玩家：(角色使用率取前30名)**
\`\`\`
${layout(snapshots.top50, 30)}
\`\`\`
**前100名玩家：(角色使用率取前30名)：**
\`\`\`
${layout(snapshots.top100, 30)}
\`\`\`
**目前統計範圍玩家：(角色使用率取前30名)**
\`\`\`
${layout(snapshots.all, 30)}
\`\`\`
`;
}

async function loadLatestData() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("找不到 data/latest.json。請先到 GitHub Actions 手動執行 Update PvP rank data workflow 產生資料。");
    }
    throw new Error(`讀取 data/latest.json 失敗：HTTP ${response.status}`);
  }

  return response.json();
}

async function runRankUsage() {
  const date = els.dateInput.value.trim() || todayTitle();

  els.runBtn.disabled = true;
  els.copyBtn.disabled = true;
  els.downloadBtn.disabled = true;
  latestResult = null;

  els.top10Output.textContent = "載入中...";
  els.top50Output.textContent = "載入中...";
  els.top100Output.textContent = "載入中...";
  els.allOutput.textContent = "載入中...";
  els.discordOutput.value = "";

  try {
    setStatus("讀取已產生的統計資料...", 30);
    const data = await loadLatestData();
    const snapshots = data.snapshots || {};

    els.top10Output.textContent = layout(snapshots.top10, 20);
    els.top50Output.textContent = layout(snapshots.top50, 30);
    els.top100Output.textContent = layout(snapshots.top100, 30);
    els.allOutput.textContent = layout(snapshots.all, 30);

    latestResult = data;
    els.discordOutput.value = buildDiscordText({ date, data });

    els.copyBtn.disabled = false;
    els.downloadBtn.disabled = false;

    const generatedText = data.generatedAtTaipei
      ? `統計完成。資料產生時間：${data.generatedAtTaipei}，成功讀取玩家數：${data.loadedPlayers ?? "未知"}`
      : "統計完成。";

    setStatus(generatedText, 100);
  } catch (error) {
    console.error(error);
    setStatus(`發生錯誤：${error.message}`, 100);
    els.top10Output.textContent = "載入失敗";
    els.top50Output.textContent = "載入失敗";
    els.top100Output.textContent = "載入失敗";
    els.allOutput.textContent = "載入失敗";
  } finally {
    els.runBtn.disabled = false;
  }
}

async function copyDiscordText() {
  const text = els.discordOutput.value;
  if (!text) return;

  await navigator.clipboard.writeText(text);
  const oldText = els.copyBtn.textContent;
  els.copyBtn.textContent = "已複製";
  setTimeout(() => {
    els.copyBtn.textContent = oldText;
  }, 1200);
}

function downloadJson() {
  if (!latestResult) return;

  const league = (latestResult.league || "legend").toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${league}_rank_units_${stamp}.json`;

  const blob = new Blob([JSON.stringify(latestResult, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

els.runBtn.addEventListener("click", runRankUsage);
els.copyBtn.addEventListener("click", copyDiscordText);
els.downloadBtn.addEventListener("click", downloadJson);

runRankUsage();
