/* Rangerbook PvP poster: Canvas-only, client-side image composition. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const ui = {
    oldTab: $("#usageTab"), newTab: $("#posterTab"),
    oldView: $("#usageView"), newView: $("#posterView"),
    date: $("#posterDateSelect"), run: $("#posterGenerateBtn"),
    download: $("#posterDownloadBtn"), status: $("#posterStatus"),
    source: $("#posterSource"), canvas: $("#posterCanvas")
  };
  if (!ui.canvas || !ui.newTab) return;
  const W = 1920, H = 1080;
  const ctx = ui.canvas.getContext("2d");
  const sourceBase = "https://raw.githubusercontent.com/mti0224/rangerbook_res/main/";
  const font = '"LRPosterWangZonYi","王漢宗綜藝體繁","HanWangZonYi",sans-serif';
  const images = new Map();
  let unitMetadata = null;
  let dateEntries = [];
  let initialized = false;
  let loading = false;
  let generatedDate = "";

  function showStatus(message, error) {
    ui.status.textContent = message;
    ui.status.classList.toggle("is-error", !!error);
  }
  function setTab(poster) {
    ui.oldView.hidden = !!poster;
    ui.newView.hidden = !poster;
    for (const [button, selected] of [[ui.oldTab, !poster], [ui.newTab, poster]]) {
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    if (poster && !initialized) initialize();
  }
  ui.oldTab.addEventListener("click", () => {
    setTab(false);
    history.replaceState(null, "", location.pathname + location.search);
  });
  ui.newTab.addEventListener("click", () => {
    setTab(true);
    history.replaceState(null, "", "#ranking-image");
  });

  async function json(url) {
    const response = await fetch(url, {cache: "no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status + "：" + url);
    return response.json();
  }
  async function image(url) {
    if (images.has(url)) return images.get(url);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    images.set(url, promise);
    return promise;
  }
  function safeDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : ""; }
  function localDateString(value) {
    const s = String(value || "");
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0,10) : "";
  }
  function displayDate(v) { return String(v).replace(/-/g, "/"); }

  async function loadMetadata() {
    const response = await json("./data/ranger-metadata.json");
    const units = response && response.units;
    if (!units || typeof units !== "object") throw new Error("角色對照資料格式錯誤");
    const byName = new Map();
    for (const [id, m] of Object.entries(units)) {
      if (!m || !m.name) continue;
      const entries = byName.get(m.name) || [];
      entries.push({id, ...m});
      byName.set(m.name, entries);
    }
    return byName;
  }
  function starCategory(meta) {
    if (!meta) return "9star";
    const star = String(meta.star || "");
    if (star.includes("超進化")) return "hyper";
    if (star.includes("終極進化")) return "ultra";
    return "9star";
  }
  function chooseUnit(name) {
    const choices = unitMetadata.get(name) || [];
    if (!choices.length) return null;
    // Multiple variants with identical local names are rare; prefer the 9-star edition.
    const score = (x) => {
      const s = String(x.star || "");
      const n = Number((s.match(/\d+/) || [0])[0]);
      return n * 10 + (s.includes("超進化") ? 2 : s.includes("終極進化") ? 1 : 0);
    };
    return [...choices].sort((a, b) => score(b) - score(a))[0];
  }
  async function initialize() {
    initialized = true;
    ui.run.disabled = true;
    showStatus("載入結算日期與角色圖片對照資料…");
    try {
      const [metadata, listing, latest] = await Promise.all([
        loadMetadata(),
        json("./data/history/index.json"),
        json("./data/latest.json")
      ]);
      unitMetadata = metadata;
      dateEntries = (Array.isArray(listing.dates) ? listing.dates : [])
        .filter((e) => safeDate(e.date) && e.file === e.date + ".json" && (!e.league || e.league === "LEGEND"))
        .sort((a, b) => b.date.localeCompare(a.date));
      const latestDate = localDateString(latest.generatedAtTaipei);
      if (latestDate && !dateEntries.some(e => e.date === latestDate)) {
        dateEntries.unshift({date: latestDate, file: "latest", generatedAtTaipei: latest.generatedAtTaipei, league: "LEGEND"});
        dateEntries.sort((a, b) => b.date.localeCompare(a.date));
      }
      ui.date.replaceChildren();
      for (const entry of dateEntries) {
        const opt = document.createElement("option");
        opt.value = entry.date;
        opt.textContent = displayDate(entry.date);
        ui.date.appendChild(opt);
      }
      if (!dateEntries.length) throw new Error("尚未保存任何可選的 PvP 日期");
      ui.run.disabled = false;
      showStatus("已載入 " + dateEntries.length + " 個可選日期。選擇日期後點擊生成。");
      await generate();
    } catch (error) {
      console.error(error);
      showStatus("初始化失敗：" + error.message, true);
      ui.run.disabled = true;
    }
  }
  function roundBox(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }
  function drawCover(img, x, y, w, h) {
    if (!img) return;
    const factor = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / factor, sh = h / factor;
    ctx.drawImage(img, (img.naturalWidth-sw)/2, (img.naturalHeight-sh)/2, sw, sh, x, y, w, h);
  }
  function frameLayer(img, x, y, w, h) {
    if (img) ctx.drawImage(img, x, y, w, h);
  }
  function caption(text, x, y, width, maxLines) {
    const words = [...String(text)];
    const lines = [];
    let current = "";
    for (const ch of words) {
      const attempt = current + ch;
      if (ctx.measureText(attempt).width <= width || !current) current = attempt;
      else {
        lines.push(current);
        current = ch;
      }
    }
    if (current) lines.push(current);
    const capped = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      let s = capped[maxLines - 1];
      while (s.length && ctx.measureText(s + "…").width > width) s = s.slice(0,-1);
      capped[maxLines - 1] = s + "…";
    }
    capped.forEach((line, i) => ctx.fillText(line, x, y + i * 31));
  }
  function drawPortrait(img, meta, x, y, w, h) {
    ctx.save();
    roundBox(x, y, w, h, 14);
    ctx.clip();
    if (img) {
      // Retain original transparent pixels. Enlarge then crop inside the rounded viewport;
      // keep feet/bottom aligned while using the image face anchor to center horizontally.
      const ratio = Number(meta && meta.sizeRatio);
      const scale = Number.isFinite(ratio) ? Math.max(.8, Math.min(1.35, ratio)) : 1;
      const zoom = 1.26 * scale;
      const drawW = Math.max(w * zoom, h * img.naturalWidth / img.naturalHeight * 1.23);
      const drawH = drawW * img.naturalHeight / img.naturalWidth;
      const faceX = Number(meta && meta.faceCenter && meta.faceCenter.x);
      const fx = Number.isFinite(faceX) ? faceX : .5;
      const px = x + w / 2 - drawW * fx;
      ctx.drawImage(img, px, y + h - drawH, drawW, drawH);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "18px " + font;
      ctx.fillText("無圖片", x+w/2, y+h/2);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }
  async function portraitFor(id) {
    if (!id) return null;
    const url = sourceBase + encodeURIComponent(id) + "/" + encodeURIComponent(id);
    return (await image(url + "-thum-140.png")) || (await image(url + "-thum.png"));
  }
  async function assetsForRows(rows) {
    const fixed = {
      background: await image("./image/bg.jpg"),
      top: await image("./image/frame_top.png")
    };
    const types = ["9star","ultra","hyper"];
    await Promise.all(types.map(async (type) => {
      fixed["bottom_" + type] = await image("./image/frame_bottom_" + type + ".png");
      fixed["star_" + type] = await image("./image/star_" + type + ".png");
    }));
    const portraits = await Promise.all(rows.map(r => portraitFor(r.unit && r.unit.id)));
    return {fixed, portraits};
  }
  function drawPoster(rows, assets, date, source) {
    const fixed = assets.fixed;
    ctx.clearRect(0, 0, W, H);
    if (fixed.background) drawCover(fixed.background, 0, 0, W, H);
    else { ctx.fillStyle = "#101d3a"; ctx.fillRect(0, 0, W, H); }
    const shade = ctx.createLinearGradient(0, 0, 0, 270);
    shade.addColorStop(0, "rgba(5,10,30,.85)");
    shade.addColorStop(1, "rgba(5,10,30,0)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, 280);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,.85)"; ctx.shadowBlur = 16;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 74px " + font;
    ctx.fillText("傳奇 PvP 熱門角色 TOP 20", W / 2, 112);
    ctx.font = "bold 36px " + font;
    ctx.fillText(displayDate(date) + "  全段位傳奇 PvP 結算統計", W / 2, 174);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.83)";
    ctx.font = "24px " + font;
    ctx.fillText("前 200 名玩家 A / B 隊伍 · Ranger 使用次數排名", W / 2, 216);

    let missing = 0;
    // Ranking order is column-major: 1-5 down, 6-10 down, ... 16-20 down.
    rows.forEach((row, i) => {
      const col = Math.floor(i / 5), line = i % 5;
      const x = 48 + col * 467, y = 277 + line * 149;
      const w = 427, h = 139;
      ctx.fillStyle = "rgba(5,13,28,.76)";
      roundBox(x,y,w,h,20); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,.28)";ctx.stroke();
      const img = assets.portraits[i];
      if (!img) missing++;
      const kind = starCategory(row.unit);
      const bx = x + 12, by = y + 8, bw = 123, bh = 123;
      frameLayer(fixed["bottom_" + kind],bx,by,bw,bh);
      drawPortrait(img,row.unit,bx+6,by+5,bw-12,bh-10);
      frameLayer(fixed.top,bx,by,bw,bh);
      const star = fixed["star_" + kind];
      if (star) {
        // Preserve star aspect ratio; place over the lower portion of the avatar.
        const sh = 29, sw = Math.min(118, sh * star.naturalWidth / star.naturalHeight);
        ctx.drawImage(star, bx + (bw-sw)/2, by + bh-sh-3, sw, sh);
      }
      ctx.shadowColor = "rgba(0,0,0,.8)";ctx.shadowBlur = 5;
      ctx.fillStyle = i < 3 ? "#ffe69f" : "#d9e8ff";
      ctx.font = "bold 31px " + font; ctx.textAlign = "left";
      ctx.fillText(String(i+1).padStart(2,"0"), x + 147, y + 34);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 23px " + font;
      caption(row.name, x + 196, y + 38, 216, 2);
      ctx.fillStyle = "#ffe19d";
      ctx.font = "bold 30px " + font;
      ctx.fillText(row.count.toLocaleString("zh-TW") + " 次", x + 196, y + 117);
    });
    ctx.textAlign = "right";
    ctx.font = "18px " + font;
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("來源：LRpvprank｜" + (source.loadedPlayers || 0) + " 名玩家｜資料時間 " + (source.generatedAtTaipei || "未知"), W - 54, H - 24);
    ctx.textAlign = "left";
    return missing;
  }
  async function generate() {
    if (loading || !unitMetadata) return;
    const date = safeDate(ui.date.value);
    const entry = dateEntries.find(e => e.date === date);
    if (!entry) return showStatus("請選擇已儲存的日期", true);
    loading = true;
    ui.run.disabled = true;
    ui.download.disabled = true;
    showStatus("讀取 " + date + " 的資料、王漢宗綜藝體繁字型與角色縮圖…");
    try {
      const faces = await document.fonts.load('32px "LRPosterWangZonYi"', "傳奇熱門角色排名");
      if (!faces.length || !document.fonts.check('32px "LRPosterWangZonYi"', "傳奇熱門角色排名")) {
        throw new Error("王漢宗綜藝體繁未載入，避免輸出錯誤字體；請確認網路連線");
      }
      const data = await json(entry.file === "latest" ? "./data/latest.json" : "./data/history/" + encodeURIComponent(entry.file));
      if (localDateString(data.generatedAtTaipei) !== date) throw new Error("快照日期與所選日期不一致");
      if (String(data.league).toUpperCase() !== "LEGEND") throw new Error("不是傳奇段位快照");
      const sorted = Array.isArray(data.sorted && data.sorted.all)
        ? data.sorted.all
        : Object.entries((data.snapshots && data.snapshots.all) || {}).map(([name, count]) => ({name,count})).sort((a,b) => b.count-a.count);
      const rows = sorted.slice(0, 20).map(r => ({
        name: String(r.name),
        count: Number(r.count)||0,
        unit: chooseUnit(String(r.name))
      }));
      if (rows.length !== 20) throw new Error("此快照不足 20 種 Ranger，不能產生完整前 20 名");
      const assets = await assetsForRows(rows);
      const missing = drawPoster(rows, assets, date, data);
      generatedDate = date;
      ui.download.disabled = false;
      ui.source.textContent = "資料時間：" + (data.generatedAtTaipei || "未知") + "（GMT+8）；成功讀取玩家：" + (data.loadedPlayers ?? "未知") + "；統計範圍：前 200 名玩家 A/B 隊伍。";
      if (missing) showStatus("已生成圖像，但有 " + missing + " 張角色縮圖無法從 GitHub 載入，已保留佔位符。", true);
      else showStatus("前 20 名排名圖生成完成，可直接下載 PNG。");
    } catch (error) {
      console.error(error);
      ui.source.textContent = "";
      showStatus("生成失敗：" + error.message, true);
    } finally {
      ui.run.disabled = false;
      loading = false;
    }
  }
  ui.run.addEventListener("click", generate);
  ui.download.addEventListener("click", () => {
    if (!generatedDate || ui.download.disabled) return;
    ui.canvas.toBlob((blob) => {
      if (!blob) {showStatus("瀏覽器無法匯出 PNG", true);return;}
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "legend-pvp-top20-" + generatedDate + ".png";
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, "image/png");
  });
  setTab(location.hash === "#ranking-image");
})();