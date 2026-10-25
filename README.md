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
