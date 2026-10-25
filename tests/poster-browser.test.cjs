const {chromium} = require("playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const logs=[];
  page.on("pageerror", error=>logs.push("PAGE: "+error.message));
  try {
    await page.goto("http://127.0.0.1:8765/#ranking-image",{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction(() => document.querySelectorAll("#posterDateSelect option").length > 1,{timeout:60000});
    const options=await page.locator("#posterDateSelect option").allTextContents();
    console.log("AVAILABLE_DATES",options.length,options.slice(0,4),options.slice(-4));
    assert(options.length > 30,"History should load >30 available dates, got "+options.length);
    assert(options.includes("2026/07/25"),"July dates must be available");
    assert(options.includes("2026/10/24"),"October history must be available");

    for(const date of ["2026-10-24","2026-07-25"]){
      await page.locator("#posterDateSelect").selectOption(date);
      await page.locator("#posterGenerateBtn").click();
      await page.waitForFunction(() => {
        const b=document.querySelector("#posterDownloadBtn");
        return !b.disabled || /生成失敗|無法載入|初始化失敗/.test(document.querySelector("#posterStatus").textContent);
      },null,{timeout:90000});
      const state=await page.locator("#posterStatus").innerText();
      assert(!/生成失敗|無法載入|初始化失敗/.test(state),date+": "+state);
      assert(await page.locator("#posterDownloadBtn").isEnabled(),date+": download button not enabled");
      console.log("RENDERED",date,state);
      const canvas = await page.locator("#posterCanvas").evaluate(c=>({w:c.width,h:c.height,alpha:c.getContext("2d").getImageData(960,540,1,1).data[3]}));
      await page.locator("#posterCanvas").screenshot({path:"artifacts/poster-"+date+".png"});
      assert.deepEqual(canvas,{w:1920,h:1080,alpha:255});
    }
    assert(!logs.length, "JavaScript errors: "+logs.join("; "));
    await page.screenshot({path:"artifacts/poster-browser.png",fullPage:true});
    console.log("Browser smoke test passed.");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
