/* Skill damage ranking image, based on Rangerbook's current stats. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    tab: $("#damageTab"), view: $("#damageView"),
    oldTab: $("#usageTab"), posterTab: $("#posterTab"),
    oldView: $("#usageView"), posterView: $("#posterView"),
    element: $("#damageElementSelect"), star: $("#damageStarSelect"),
    run: $("#damageGenerateBtn"), download: $("#damageDownloadBtn"),
    status: $("#damageStatus"), canvas: $("#damageCanvas"),
    source: $("#damageSource"), list: $("#damageList")
  };
  if (!ui.tab || !ui.canvas) return;
  const W = 1920, H = 1080;
  const ctx = ui.canvas.getContext("2d");
  const font = '"LRPosterWangZonYi","王漢宗綜藝體繁","HanWangZonYi",sans-serif';
  const RANGER_RESOURCE = "https://raw.githubusercontent.com/mti0224/rangerbook_res/main/";
  const THEME = {
    "lightdark-with-nft": {name:"光暗屬", color:"#ffdb43", low:"#55306b", high:"#c786cc", text:"#ffeb5b"},
    "lightdark-without-nft": {name:"光暗屬", color:"#ffdb43", low:"#55306b", high:"#c786cc", text:"#ffeb5b"},
    water:{name:"水屬性", color:"#23d5ff", low:"#073d85", high:"#109dce", text:"#32dbff"},
    fire:{name:"火屬性", color:"#ff5365", low:"#801c30", high:"#e1554c", text:"#ff4355"},
    wood:{name:"木屬性", color:"#a4e96b", low:"#224e30", high:"#82b864", text:"#aeec64"}
  };
  const imageCache = new Map();
  const titleOf = (x) => THEME[x].name + "輸出排名";
  let metadata = {};
  let data = null;
  let initialized = false;
  let busy = false;
  let generated = null;

  function status(message, error = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle("is-error", error);
  }
  function setSelected(tab) {
    for (const button of [ui.oldTab, ui.posterTab, ui.tab]) {
      const selected = button === tab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    ui.oldView.hidden = tab !== ui.oldTab;
    ui.posterView.hidden = tab !== ui.posterTab;
    ui.view.hidden = tab !== ui.tab;
  }
  function openDamage() {
    setSelected(ui.tab);
    history.replaceState(null, "", "#skill-damage");
    if (!initialized) initialize();
  }
  ui.tab.addEventListener("click", openDamage);
  for (const tab of [ui.oldTab, ui.posterTab]) {
    tab.addEventListener("click", () => { ui.view.hidden = true; ui.tab.classList.remove("is-active");
      ui.tab.setAttribute("aria-selected", "false"); ui.tab.tabIndex = -1; });
  }

  async function loadJSON(url) {
    const res = await fetch(url, {cache:"no-store"});
    if (!res.ok) throw new Error("HTTP " + res.status + "：" + url);
    return res.json();
  }
  function image(url) {
    if (imageCache.has(url)) return imageCache.get(url);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, promise);
    return promise;
  }
  async function portraitFor(id) {
    if (!id) return null;
    const safe = encodeURIComponent(id);
    const base = RANGER_RESOURCE + safe + "/" + safe;
    return await image(base + "-thum.png") || await image(base + "-thum-140.png");
  }
  function portraitGeometry(img, meta, maskWidth, maskHeight) {
    // Identical Cocos2d anchor/sizeRatio mapping to the existing PvP usage poster.
    const inputScale = Number(meta?.sizeRatio);
    const scale = Number.isFinite(inputScale) && inputScale > 0 ? inputScale : 1;
    const mx = Number(meta?.faceCenter?.x);
    const my = Number(meta?.faceCenter?.y);
    const ax = Number.isFinite(mx) ? mx : 0.5;
    const ay = Number.isFinite(my) ? my : 0.5;
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    return {x:maskWidth/2-ax*w, y:maskHeight/2-(1-ay)*h, w, h};
  }
  function nativePortrait(img, meta, mask) {
    if (!img || !mask) return null;
    const buffer = document.createElement("canvas");
    buffer.width = mask.naturalWidth; buffer.height = mask.naturalHeight;
    const off = buffer.getContext("2d");
    const g = portraitGeometry(img, meta, buffer.width, buffer.height);
    off.drawImage(img, g.x, g.y, g.w, g.h);
    off.globalCompositeOperation = "destination-in";
    off.drawImage(mask, 0, 0);
    off.globalCompositeOperation = "source-over";
    return buffer;
  }
  function rounded(x,y,w,h,r) {
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  }
  function textFit(text,x,y,maxWidth,size,minSize=22) {
    let s=size;
    do {ctx.font="bold "+s+"px "+font;if(ctx.measureText(text).width<=maxWidth)break;s-=2;} while(s>minSize);
    ctx.font="bold "+Math.max(s,minSize)+"px "+font;
    ctx.fillText(text,x,y,maxWidth);
  }
  function formatWan(number, decimal=1) {
    const n=Number(number);
    if (!Number.isFinite(n)) return "—";
    const unit=n>=10000?"萬":"";
    let value=n>=10000?n/10000:n;
    const places=n>=10000?decimal:0;
    return value.toLocaleString("zh-TW",{maximumFractionDigits:places,minimumFractionDigits:0})+unit;
  }
  function skillLabel(row) {
    const parts=[];
    if (row.directPercent>0) parts.push((row.directPercent/100).toLocaleString("zh-TW")+"倍");
    for (const dot of row.dots||[]) {
      parts.push((dot.percent/100).toLocaleString("zh-TW")+"倍 × "+dot.seconds+"秒");
    }
    return parts.join(" + ") || "—";
  }
  function darkCard(x,y,w,h) {
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,.35)";ctx.shadowBlur=18;ctx.shadowOffsetY=7;
    rounded(x,y,w,h,20);
    const fill=ctx.createLinearGradient(x,y,x+w,y);
    fill.addColorStop(0,"rgba(10,12,12,.91)");fill.addColorStop(1,"rgba(27,29,19,.80)");
    ctx.fillStyle=fill;ctx.fill();
    ctx.shadowColor="transparent";ctx.lineWidth=5;ctx.strokeStyle="rgba(255,255,255,.94)";ctx.stroke();ctx.restore();
  }
  function medal(rank,x,y) {
    const first=["#ffdb47","#f7f9fc","#ecac87"][rank-1] || "#8993a5";
    const dark=["#a75c05","#737f92","#944d34"][rank-1] || "#536072";
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,.6)";ctx.shadowBlur=13;
    ctx.fillStyle=dark;
    ctx.beginPath();ctx.moveTo(x-40,y+28);ctx.lineTo(x-31,y+102);ctx.lineTo(x,y+79);
    ctx.lineTo(x+30,y+102);ctx.lineTo(x+40,y+26);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.arc(x,y,58,0,Math.PI*2);ctx.fill();
    const g=ctx.createRadialGradient(x-15,y-19,5,x,y,52);
    g.addColorStop(0,"#fff7d5");g.addColorStop(.48,first);g.addColorStop(1,dark);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,49,0,Math.PI*2);ctx.fill();
    ctx.shadowColor="transparent";ctx.strokeStyle="rgba(255,255,255,.8)";ctx.lineWidth=5;ctx.stroke();
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#152030";
    ctx.font="bold 53px "+font;ctx.fillText(String(rank),x,y+4);ctx.restore();
  }
  function circularPortrait(img,meta,mask,x,y,d,theme) {
    const circleX=x+d/2, circleY=y+d/2;
    ctx.save();
    ctx.shadowColor="rgba(255,255,255,.82)";ctx.shadowBlur=24;
    ctx.beginPath();ctx.arc(circleX,circleY,d/2+5,0,Math.PI*2);
    ctx.fillStyle="#fafafa";ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(circleX,circleY,d/2,0,Math.PI*2);ctx.clip();
    const composed=nativePortrait(img,meta,mask);
    if (composed) ctx.drawImage(composed,x,y,d,d);
    else {ctx.fillStyle=theme.low;ctx.fillRect(x,y,d,d);ctx.fillStyle="#fff";
      ctx.textAlign="center";ctx.font="bold 26px "+font;ctx.fillText("無圖片",circleX,circleY);}
    ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(circleX,circleY,d/2,0,Math.PI*2);
    ctx.strokeStyle="white";ctx.lineWidth=7;ctx.stroke();ctx.restore();
  }
  function background(theme,element,bg) {
    ctx.clearRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,theme.low);g.addColorStop(.5,theme.high);g.addColorStop(1,theme.low);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    if (bg) {
      const scale=Math.max(W/bg.naturalWidth,H/bg.naturalHeight);
      const sw=W/scale,sh=H/scale;
      ctx.save();ctx.globalAlpha=.25;
      ctx.drawImage(bg,(bg.naturalWidth-sw)/2,(bg.naturalHeight-sh)/2,sw,sh,0,0,W,H);
      ctx.restore();
    }
    // PPT-inspired thematic background circles; remain behind all cards and portraits.
    ctx.save();
    for(let i=0;i<14;i++){
      const x=(i*271+90)%W,y=(i*193+400)%H,r=100+(i*39)%175;
      const glow=ctx.createRadialGradient(x,y,0,x,y,r);
      glow.addColorStop(0,"rgba(255,255,255,.12)");glow.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
    const bar=ctx.createLinearGradient(0,0,1150,0);
    bar.addColorStop(0,"rgba(0,0,0,.44)");bar.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=bar;ctx.fillRect(0,35,W,175);
    ctx.restore();
  }
  function drawRow(row,rank,assets,theme) {
    const left=rank<=3;
    const col=left?0:1, line=(rank-1)%3;
    const x=130+col*880,y=308+line*224;
    darkCard(x+136,y+9,690,171);
    const img=assets.portraits[rank-1];
    circularPortrait(img,metadata[row.id],assets.mask,x+73,y+8,164,theme);
    medal(rank,x+20,y+58);
    ctx.save();ctx.textBaseline="alphabetic";ctx.textAlign="left";ctx.fillStyle="#fff";
    const labelX=x+255;
    textFit(row.name,labelX,y+55,520,32,23);
    ctx.font="29px "+font;
    const lineText="攻擊 "+formatWan(row.attack,2)+"，技能 "+skillLabel(row);
    textFit(lineText,labelX,y+105,520,28,21);
    ctx.fillStyle=theme.text;
    textFit("➜ 技能輸出 "+formatWan(row.damage,1),labelX,y+158,520,43,34);
    ctx.restore();
  }
  function drawPoster(rows,assets,theme,element,star) {
    background(theme,element,assets.background);
    ctx.save();ctx.textAlign="left";ctx.textBaseline="alphabetic";
    ctx.fillStyle="#fff";ctx.shadowColor="rgba(0,0,0,.6)";ctx.shadowBlur=12;ctx.shadowOffsetY=4;
    textFit(titleOf(element),67,174,1330,113,76);
    ctx.shadowColor="transparent";ctx.restore();
    if (assets.star) {
      const img=assets.star,w=330,h=w*img.naturalHeight/img.naturalWidth;
      ctx.drawImage(img,1500,82,w,h);
    }
    ctx.save();ctx.fillStyle="rgba(20,21,25,.52)";
    rounded(76,238,1773,783,74);ctx.fill();
    ctx.strokeStyle="rgba(46,46,46,.74)";ctx.lineWidth=14;ctx.stroke();
    ctx.restore();
    rows.forEach((row,index)=>drawRow(row,index+1,assets,theme));
    ctx.save();ctx.fillStyle="rgba(255,255,255,.9)";ctx.textAlign="right";
    ctx.font="bold 24px "+font;
    if(element.startsWith("lightdark")) {
      ctx.fillText(element==="lightdark-with-nft"?"包含 NFT（[T]）":"不包含 NFT（[T]）",1823,1038);
    }
    ctx.restore();
  }
  async function draw() {
    if (busy) return;
    busy=true;ui.run.disabled=true;ui.download.disabled=true;generated=null;
    const element=ui.element.value,star=ui.star.value;
    status("正在產生 "+(star==="star9"?"九星":"超進化8星")+THEME[element].name+"技能傷害排名圖…");
    try {
      data=await loadJSON("./data/skill-damage.json?t="+Date.now());
      const rows=data?.rankings?.[element]?.[star]||[];
      if(rows.length!==6) throw new Error("此分類沒有完整的六名角色資料");
      const loaded=await document.fonts.load('bold 48px "LRPosterWangZonYi"',"技能輸出排名");
      if (!loaded.length) throw new Error("王漢宗綜藝體繁字型載入失敗");
      const portraits=await Promise.all(rows.map(r=>portraitFor(r.id)));
      const [background,mask,starImage]=await Promise.all([
        image("./image/bg.jpg"), image("./image/portrait_mask_native.png"),
        image("./image/star_"+(star==="star9"?"9star":"hyper")+".png")
      ]);
      if(!mask) throw new Error("缺少原始角色頭像遮罩 portrait_mask_native.png");
      drawPoster(rows,{portraits,background,mask,star:starImage},THEME[element],element,star);
      renderList(rows);
      const stamp=data.generatedAtUtc?data.generatedAtUtc.replace("T"," ").slice(0,16)+" UTC":"未知";
      ui.source.textContent="資料來源：Rangerbook Rangers_data.json；排名更新："
        +stamp+"；依每隻角色輸出最高的技能排序。";
      const missing=portraits.filter(x=>!x).length;
      generated={element,star};
      ui.download.disabled=false;
      status(missing?"已生成（"+missing+" 張角色圖片暫時無法讀取，已使用佔位圖）。":"已完成前六名技能傷害排名，可下載 1920 × 1080 PNG。",missing>0);
    } catch(error) {
      console.error(error);
      status("生成失敗："+error.message,true);
    } finally {busy=false;ui.run.disabled=false;}
  }
  function renderList(rows) {
    ui.list.replaceChildren();
    rows.forEach((r,i)=>{
      const li=document.createElement("li");
      li.textContent=(i+1)+". "+r.name+" — "+
        formatWan(r.damage,2)+"（攻擊 "+formatWan(r.attack,2)+"，技能 "+skillLabel(r)+"）";
      ui.list.appendChild(li);
    });
  }
  async function initialize() {
    initialized=true;
    try {
      status("正在讀取角色頭像位置與技能傷害排行榜…");
      const meta=await loadJSON("./data/ranger-metadata.json");
      if (!meta?.units) throw new Error("角色臉部位置資料不存在");
      metadata=meta.units;
      await draw();
    } catch (error) {
      status("初始化失敗："+error.message,true);
      ui.run.disabled=true;
    }
  }
  ui.run.addEventListener("click",draw);
  for(const sel of [ui.element,ui.star]) {
    sel.addEventListener("change",()=>{
      ui.download.disabled=true;generated=null;
      if(initialized)draw();
    });
  }
  ui.download.addEventListener("click",()=>{
    if(!generated||busy)return;
    ui.canvas.toBlob(blob=>{
      if(!blob){status("瀏覽器無法輸出 PNG",true);return;}
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;
      const label=generated.element.replace(/-/g,"_");
      link.download="SkillDamage_"+generated.star+"_"+label+".png";
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
    },"image/png");
  });
  if(location.hash==="#skill-damage")openDamage();
})();