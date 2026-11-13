const {chromium} = require("playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    headless: true,
    args:["--no-sandbox","--disable-dev-shm-usage"]
  });
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  try {
    await page.goto("http://127.0.0.1:8765/#skill-damage",
      {waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction(() => {
      const el=document.querySelector("#damageStatus");
      return document.querySelector("#damageDownloadBtn:not([disabled])") ||
        (el && /生成失敗|初始化失敗/.test(el.textContent));
    }, null,{timeout:90000});
    let message=await page.locator("#damageStatus").innerText();
    assert(await page.locator("#damageDownloadBtn").isEnabled(),message);
    assert.equal(await page.locator("#damageList li").count(),6);
    assert(await page.locator("#damageView").isVisible());
    assert(!await page.locator("#posterView").isVisible());
    const before=await page.locator("#damageCanvas").evaluate(c=>{
      const d=c.getContext("2d").getImageData(960,540,1,1).data;
      return {width:c.width,height:c.height,alpha:d[3]};
    });
    assert.deepEqual(before,{width:1920,height:1080,alpha:255});
    await page.locator("#damageCanvas").screenshot({path:"artifacts/skill-damage-water-default.png"});
    await page.locator("#damageElementSelect").selectOption("lightdark-without-nft");
    await page.locator("#damageStarSelect").selectOption("star9");
    await page.waitForFunction(() => !document.querySelector("#damageDownloadBtn").disabled
      || /生成失敗/.test(document.querySelector("#damageStatus").textContent),null,{timeout:90000});
    message=await page.locator("#damageStatus").innerText();
    assert(await page.locator("#damageDownloadBtn").isEnabled(),message);
    assert.equal(await page.locator("#damageList li").count(),6);
    const names=await page.locator("#damageList li").allTextContents();
    assert(names.every(name=>!name.includes("[T]")),"NFT Ranger leaked into excluded filter");
    await page.locator("#damageCanvas").screenshot({path:"artifacts/skill-damage-lightdark-excluding-nft.png"});
    assert.deepEqual(errors,[],"Page errors: "+errors.join("; "));
    console.log("Skill damage browser test passed.",names);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});