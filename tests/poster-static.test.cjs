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
assert(css.includes('#posterView') && css.includes('LRPosterWangZonYi'), "Scoped poster font missing");
assert(!mainCss.includes("LRPosterWangZonYi"), "Do not change website-wide font");
assert(poster.includes('document.fonts.load'), "Canvas should wait for webfont");
assert(poster.includes('Math.floor(i / 5)'), "Four columns with ranking top-to-bottom expected");
assert(poster.includes('line = i % 5'), "Five rows per column expected");
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
