/* Rangerbook PvP poster: Canvas-only, client-side image composition. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const ui = {
    oldTab: $("#usageTab"), newTab: $("#posterTab"),
    oldView: $("#usageView"), newView: $("#posterView"),
    date: $("#posterDateSelect"), run: $("#posterGenerateBtn"),
    download: $("#posterDownloadBtn"), status: $("#posterStatus"),
    canvas: $("#posterCanvas")
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
    capped.forEach((line, i) => ctx.fillText(line, x, y + i * 25));
  }
  function drawPortrait(img, meta, x, y, w, h) {
    ctx.save();
    // The thumbnail must stay within the rounded frame; no pixel may spill into
    // the neighbouring count or outside the dark content area of bg.jpg.
    roundBox(x, y, w, h, 13);
    ctx.clip();
    if (img) {
      // The face positioning and sprite scaling come from rangerbook's
      // res/v2/projectiles.json -> visual.faceCenter.{x,y}, visual.scale
      // (mirrored in data/ranger-metadata.json).
      const scaleValue = Number(meta?.sizeRatio);
      const ratio = Number.isFinite(scaleValue) && scaleValue > 0
        ? Math.min(1.35, Math.max(.75, scaleValue)) : 1;
      const centerX = Number(meta?.faceCenter?.x);
      const centerY = Number(meta?.faceCenter?.y);
      const fx = Number.isFinite(centerX) ? Math.max(0, Math.min(1, centerX)) : .5;
      const fy = Number.isFinite(centerY) ? Math.max(0, Math.min(1, centerY)) : .6;
      // Preserve image aspect ratio, zoom to a head-and-shoulders crop. The image
      // extends beyond the *inner* portrait viewport but is always clipped.
      const drawH = h * 1.40 * ratio;
      const drawW = drawH * img.naturalWidth / img.naturalHeight;
      const px = x + w / 2 - drawW * fx;
      const py = y + Math.max(3, Math.min(13, 7 + (.62 - fy) * 48));
      ctx.drawImage(img, px, py, drawW, drawH);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.13)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = "17px " + font;
      ctx.textAlign = "center";
      ctx.fillText("無圖片", x + w / 2, y + h / 2);
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
  // Native poster size is 1920×1080; matching the supplied 960×540 sample.
  // Four columns, five rows each, filled vertically before moving right.
  const POSTER_LAYOUT = Object.freeze({
    firstX: 182, firstY: 291, columnStep: 396, rowStep: 126,
    avatarSize: 121, countGap: 14, maxCountWidth: 237
  });
  function usageColor(rank) {
    if (rank === 1) return "#b94cea";
    if (rank <= 5) return "#ff1838";
    if (rank <= 9) return "#ffbc00";
    if (rank <= 14) return "#7dd13f";
    if (rank === 15) return "#00b6eb";
    return "#ffffff";
  }
  function drawPoster(rows, assets, date) {
    const fixed = assets.fixed;
    ctx.clearRect(0, 0, W, H);
    if (fixed.background) drawCover(fixed.background, 0, 0, W, H);
    else { ctx.fillStyle = "#101d3a"; ctx.fillRect(0, 0, W, H); }

    // Single title only. It fits inside the top rounded header of bg.jpg.
    const [year, month, day] = date.split("-").map(Number);
    const title = "本月傳奇熱門寵(" + month + "月" + day + "日)";
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,.87)";
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#ffffff";
    let titleSize = 117;
    do {
      ctx.font = "bold " + titleSize + "px " + font;
      if (ctx.measureText(title).width <= 1590) break;
      titleSize -= 2;
    } while (titleSize > 70);
    ctx.fillText(title, W / 2, 210);
    ctx.restore();

    let missing = 0;
    rows.forEach((row, i) => {
      const col = Math.floor(i / 5), line = i % 5;
      const x = POSTER_LAYOUT.firstX + col * POSTER_LAYOUT.columnStep;
      const y = POSTER_LAYOUT.firstY + line * POSTER_LAYOUT.rowStep;
      const w = POSTER_LAYOUT.avatarSize;
      const img = assets.portraits[i];
      if (!img) missing++;

      const kind = starCategory(row.unit);
      const bottom = fixed["bottom_" + kind];
      // Clip the COMPLETE thumbnail + frame + star group, so oversized layers
      // never bleed into other ranks or beyond the provided content border.
      ctx.save();
      roundBox(x, y, w, w, 15);
      ctx.clip();
      // Bottom frame is slightly taller than square; match source proportion
      // while keeping it aligned inside the clipping square.
      if (bottom) frameLayer(bottom, x + 2, y + 1, w - 4, w - 2);
      drawPortrait(img, row.unit, x + 8, y + 5, w - 16, w - 15);
      // Put the game frame over the sprite, not on the entire rank row.
      if (fixed.top) frameLayer(fixed.top, x, y, w, w);
      const star = fixed["star_" + kind];
      if (star) {
        // Original badge is intentionally smaller than in the previous version.
        const badgeW = kind === "9star" ? 99 : 88;
        const badgeH = badgeW * star.naturalHeight / star.naturalWidth;
        ctx.drawImage(star, x + (w - badgeW) / 2, y + w - badgeH - 4, badgeW, badgeH);
      }
      ctx.restore();

      // Only number of appearances, no rank/name/source/caption.
      const countX = x + w + POSTER_LAYOUT.countGap;
      const count = Number(row.count).toLocaleString("zh-TW") + "隻";
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = usageColor(i + 1);
      ctx.font = "bold 53px " + font;
      ctx.fillText(count, countX, y + w / 2 + 4, POSTER_LAYOUT.maxCountWidth);
      ctx.restore();
    });
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
      const faces = await document.fonts.load('bold 64px "LRPosterWangZonYi"', "本月傳奇熱門寵");
      if (!faces.length || !document.fonts.check('bold 64px "LRPosterWangZonYi"', "本月傳奇熱門寵")) {
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
      const missing = drawPoster(rows, assets, date);
      generatedDate = date;
      ui.download.disabled = false;
      if (missing) showStatus("已生成圖像，但有 " + missing + " 張角色縮圖無法從 GitHub 載入，已保留佔位符。", true);
      else showStatus("前 20 名排名圖生成完成，可直接下載 PNG。");
    } catch (error) {
      console.error(error);
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