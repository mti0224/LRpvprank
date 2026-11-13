# LRpvprank

LINE Rangers 傳奇段位 PvP 角色使用率統計頁面。

這個專案的 GitHub Action 會讀取 rangerbook 目前使用的 PvP 統計資料：

- `https://pvp-data.warmycat.com/usage.json`

並將 rangerbook 的 PvP scopes 轉換成 LRpvprank 原本的 `data/latest.json` 格式：

- 前 10 名玩家角色使用率
- 前 50 名玩家角色使用率
- 前 100 名玩家角色使用率
- 前 200 名玩家的 A/B 隊伍角色使用率
- Discord 公告格式文字

角色次數沿用 rangerbook 的 `appearanceCount`，因此 LRpvprank 原本的 Discord 文字格式不需要修改。

## 使用方式

直接開啟 `index.html` 即可。

若要部署到 GitHub Pages：

`Settings` → `Pages` → `Deploy from a branch` → 選擇 `main / root`

## 更新資料

可從頁面觸發 `Update PvP rank data` workflow，或直接到 GitHub Actions 手動執行。

workflow 會重新讀取 rangerbook PvP 資料並更新 `data/latest.json`。


## 技能傷害排名圖片下載

「技能傷害排名圖」是獨立第三個分頁，繼承使用率排名圖的 Canvas 1920×1080 PNG 下載方式。提供五種屬性條件（光＋暗包含 NFT、光＋暗不包含 NFT、火、木、水）與兩種星級（超進化8星、九星），共 10 種組合。每次輸出前六名，依參考 PPT 的前 3 名左欄、4～6 名右欄排列。圓形頭像採用 `data/ranger-metadata.json` 的 `faceCenter` / `sizeRatio` 和 `image/portrait_mask_native.png`，與使用率圖片共用原生定位方式。

- 資料來源：Rangerbook `res/Rangers_data.json`。`scripts/build_damage_rankings.py` 輸出 `data/skill-damage.json`，由現有五分鐘 `update-data.yml` 排程一起更新；輸出排名不變時不會重複提交。
- 總攻擊力＝物理攻擊力＋魔法攻擊力；**單一技能輸出＝總攻擊力 ×（單擊傷害% ＋ Σ（持續傷害% × 秒數））÷ 100**。依 PPT「30 倍 + 6 倍 × 6 秒」例子，單擊和持續傷害是相加，而非相乘。百分比 3000% 等於 30 倍。每秒視為一次 DoT；不納入技能發動率、抗性、裝備、才能與戰鬥加成。
- 同一角色的技能 1 和技能 2 分開計算，取輸出較高者；非 `傷害 (單擊)` 或 `傷害 (持續)` 的效果不計。攻擊係數或 DoT 秒數不明時排除該技能，避免假設數值。
- NFT 身分依角色名稱包含字面 `[T]` 判斷，光暗不包含 NFT 篩選完全移除這些角色。
- 若新進入前六名的角色缺少原生頭像定位資料，會從 Rangerbook `res/v2/projectiles.json` 取得 `faceCenter` 與 `scale` 補入 metadata。
- `tests/damage-poster.test.cjs` 驗證 10 種分類、六名排序、公式、NFT 與頭像 metadata；`tests/damage-browser.test.cjs` 在 GitHub Actions 的 Chrome 檢查實際產圖與切換。

## 本月傳奇熱門寵排名圖

- 「全段位前 20 名排名圖」分頁的 **歷史資料來源** 為 Rangerbook 使用率歷程：`https://pvp-data.warmycat.com/history/index.json`，由索引載入月份檔案（例如 `history/2026-10.json`）。
- 下拉選單提供 Rangerbook 歷史中具備 `scopes.all.rangers` 的實際日期；當歷史服務無法讀取時，則保留 LRpvprank 本地每日快照作為備援，並在介面提示。2026/10/25 實機瀏覽器測試可選 79 個日期（7/25～10/25）。
- 歷史資料直接以 `unitCode` 鍵與 `appearanceCount` 排序，避免中文名稱碰撞造成錯誤。當日最新資料依 `data/latest.json`；無法用最新快照冒充缺失日期。
- `scripts/update_data.py` 也會保存 `data/history/YYYY-MM-DD.json` 作為本地備援；資料日期不保證等同遊戲官方週結算時刻。
- 圖片採 1920×1080 PNG、4 欄×5 列、由上而下再向右排列。主標題「本月傳奇熱門寵」與較小日期括號分開繪製，卡片只顯示角色、星級及使用次數。
- `image/bg.jpg`、`frame_bottom_*.png`、`frame_top.png`、`star_*.png` 都沿用本 repo 的遊戲素材；角色原始透明縮圖來自 `mti0224/rangerbook_res`。
- `data/ranger-metadata.json` 由 Rangerbook V2 的 `visual.faceCenter.x/y` 與 `visual.scale` 整理而成，將臉部錨點實際參與縮圖定位和縮放，並套用外框內裁切。
- 「王漢宗綜藝體繁」（HanWangZonYi）只用在 Canvas 內的文字，不會改動網站按鈕、下拉選單或全站字型。圖片產生前會等待字型載入。
- `.github/workflows/poster-check.yml` 執行靜態合約檢查，`poster-browser-check.yml` 用實際 Chrome 驗證歷史日期、生成及圖片尺寸；`history-schema-check.yml` 則可重新確認上游歷史 API 結構。


### 角色縮圖還原（libgame.so 核對）

本頁原圖首先載入 `-thum.png`（只有不存在時才改用 `-thum-140.png`）。對照原生 ARM64 流程，`faceCenterX/Y` 是 Sprite 的 AnchorPoint（Y 由下往上），`sizeRatio` 是 Sprite 縮放倍率，原生縮放為呼叫端的 uiScale 乘上 sizeRatio。已核對的角色清單合成流程 uiScale=1.0，以原圖實際像素及錨點配置進 114×118 的遊戲原始遮罩，使用 `image/portrait_mask_native.png` 合成，最後將合成圖縮放到排行圖框。已移除原先自訂的 1.72 倍縮放與 51%／43% 定位；星級、背景等欄位沿用資料站原有素材。
