const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const html = read("index.html");
const js = read("assets/damage-poster.js");
const css = read("assets/damage-poster.css");
const data = JSON.parse(read("data/skill-damage.json"));
const meta = JSON.parse(read("data/ranger-metadata.json"));
new Function(js); // compile without browser globals

assert(html.includes('id="damageTab"') && html.includes('id="damageView"'));
for (const name of [
  "damageElementSelect", "damageStarSelect", "damageGenerateBtn",
  "damageDownloadBtn", "damageCanvas", "damageList"
]) assert(html.includes('id="' + name + '"'), "Missing " + name);
for (const value of ["lightdark-with-nft","lightdark-without-nft","fire","wood","water","super8","star9"])
  assert(html.includes('value="' + value + '"'), "Missing selection " + value);
assert(html.includes("./assets/damage-poster.js") && html.includes("./assets/damage-poster.css"));
assert(css.includes("#damageCanvas"));
assert(js.includes('portraitGeometry') && js.includes('meta?.faceCenter?.x') &&
       js.includes('meta?.faceCenter?.y') && js.includes('meta?.sizeRatio'),
       "Must preserve the same native thumbnail center as PvP usage export");
assert(js.includes('ctx.arc(circleX,circleY,d/2'), "Avatars must be circular");
assert(js.includes('destination-in'), "Missing native thumbnail mask");
assert(js.includes('image/portrait_mask_native.png'));
assert(js.includes('ui.canvas.toBlob') && js.includes('"image/png"'));
assert.equal(data.schemaVersion,1);
let shown = 0;
let excludedNft = 0;
const elementMap = {
  "lightdark-with-nft":["光","暗"], "lightdark-without-nft":["光","暗"],
  fire:["火"], wood:["木"],water:["水"]
};
for (const [element, starred] of Object.entries(data.rankings)) {
  assert(element in elementMap);
  for (const [star, items] of Object.entries(starred)) {
    assert(["super8","star9"].includes(star));
    assert.equal(items.length,6, "Need six names for "+element+"/"+star);
    assert(data.candidateCounts[element][star]>=6);
    let prev = Number.POSITIVE_INFINITY;
    for (const row of items) {
      assert(elementMap[element].includes(row.element), "Wrong element: "+row.name);
      assert.equal(row.star, star==="star9"?"9星":"超進化8星");
      if (element==="lightdark-without-nft") {
        assert(!row.name.includes("[T]"), "Excluded NFT present");
        excludedNft++;
      }
      assert(row.damage>0 && row.attack>0);
      const pct = row.directPercent + row.dots.reduce((a,x)=>a+x.percent*x.seconds,0);
      const expected = row.attack*pct/100;
      assert(Math.abs(row.damage-expected)<=1, "Damage formula mismatch: "+row.name);
      assert(row.damage<=prev, "Not sorted by descending damage");
      prev = row.damage;
      assert(meta.units[row.id], "Missing portrait center: "+row.id);
      shown++;
    }
  }
}
assert.equal(shown,60);
assert.equal(excludedNft,12);
assert(html.includes('id="posterView"') && html.includes('id="usageView"'));
console.log("Skill damage ranking check passed: 10 categories, 60 rows, exact native portrait metadata.");
