const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const has = file => fs.existsSync(path.join(__dirname, "..", file));
const html = read("index.html"), poster = read("assets/poster.js"), css = read("assets/poster.css");
const mainCss = read("assets/style.css");
new Function(poster); // JavaScript syntax validation: compile, do not execute DOM code.
for (const key of ["posterView", "posterDateSelect", "posterCanvas", "posterGenerateBtn", "posterDownloadBtn"]) {
  assert(html.includes('id="' + key + '"'), "Missing UI control " + key);
}
assert(html.includes("./assets/poster.css") && html.includes("./assets/poster.js"));
assert(html.includes('id="usageView"'), "Existing stats must remain present");
assert(css.includes("@font-face") && css.includes("LRPosterWangZonYi"), "Canvas font declaration missing");
assert(!/#posterView[^}]*font-family/m.test(css), "Poster website elements must use site font");
assert(!mainCss.includes("LRPosterWangZonYi"), "Do not change website-wide font");
assert(poster.includes('document.fonts.load'), "Canvas should wait for webfont");
assert(poster.includes('Math.floor(i / 5)'), "Four columns with ranking top-to-bottom expected");
assert(poster.includes('line = i % 5'), "Five rows per column expected");

assert(poster.includes('const heading = "本月傳奇熱門寵";'), "Monthly title missing");
assert(poster.includes('const dateText = "("'), "Separate smaller date label missing");
assert(poster.includes("daySize = 77"), "Date font must be smaller than title");
assert(poster.includes('HISTORY_BASE = "https://pvp-data.warmycat.com/history/"'), "Rangerbook history endpoint missing");
assert(poster.includes('snapshot?.scopes?.all?.rangers'), "Historical full-rank usage must come from Rangerbook");
assert(poster.includes('historySnapshots'), "Historical dates must be selectable");
assert(poster.includes('data/ranger-metadata.json'), "Must use rangerbook metadata");
assert(poster.includes('meta?.faceCenter?.x') && poster.includes('meta?.faceCenter?.y') && poster.includes('meta?.sizeRatio'), "Image crop must use original metadata");
assert(poster.includes('targetFaceY - (1 - fy) * scaledH'), "Face center Y must act as a real positioning anchor");
assert(poster.includes('scaledH = h * 1.72 * ratio'), "Native sizeRatio must affect scaled avatar size");
assert(poster.includes('ctx.clip()'), "Portrait and frame must be clipped");
assert(!poster.includes('caption(row.name'), "Do not render Ranger names");
assert(!poster.includes('ctx.fillText(String(i+1)'), "Do not draw ranking indices");
assert(!poster.includes('ctx.fillText("來源：'), "Do not draw source attribution");
assert(poster.includes('const badgeW = kind === "9star" ? 99 : 88;'), "Badge must be smaller");
assert(poster.includes('POSTER_LAYOUT'), "Poster geometry missing");
const grid = { firstX:182, firstY:291, columnStep:396, rowStep:126, avatarSize:121, countGap:14, maxCountWidth:237 };
for (let i = 0; i < 20; i++) {
  const x = grid.firstX + Math.floor(i / 5) * grid.columnStep;
  const y = grid.firstY + (i % 5) * grid.rowStep;
  assert(x >= 135 && y >= 275, "Card outside content border");
  assert(x + grid.avatarSize + grid.countGap + grid.maxCountWidth <= 1790, "Card extends beyond right border");
  assert(y + grid.avatarSize <= 941, "Card extends beyond bottom border");
}

const latest = JSON.parse(read("data/latest.json"));
const history = JSON.parse(read("data/history/index.json"));
const meta = JSON.parse(read("data/ranger-metadata.json"));
assert(Array.isArray(history.dates) && history.dates.length > 0, "No archived dates");
assert(latest.league === "LEGEND");
assert(Object.keys(meta.units).length > 2000, "Ranger image lookup unexpectedly empty");
const all = latest.sorted?.all || Object.entries(latest.snapshots?.all || {}).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
assert(all.length >= 20, "Top20 unavailable");
for (const row of all.slice(0,20)) {
  assert(Object.values(meta.units).some(u=>u.name===row.name), "Missing thumbnail map: " + row.name);
}
for (const item of history.dates) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(item.date));
  assert(item.file===item.date+".json");
  const saved = JSON.parse(read("data/history/"+item.file));
  assert.equal(saved.league, "LEGEND");
  assert(saved.generatedAtTaipei.startsWith(item.date));
}
for (const file of [
  "image/bg.jpg", "image/frame_top.png",
  "image/frame_bottom_9star.png","image/frame_bottom_ultra.png","image/frame_bottom_hyper.png",
  "image/star_9star.png","image/star_ultra.png","image/star_hyper.png"
]) assert(has(file), "Missing poster asset "+file);
console.log("Poster smoke checks OK: " + history.dates.length + " dates, " + all.length + " ranked units, " + Object.keys(meta.units).length + " image records.");
