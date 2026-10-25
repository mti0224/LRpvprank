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

## 前 20 名排名圖（新增分頁）

- 網頁上方可切換「使用率統計」與「全段位前 20 名排名圖」。
- 依台灣時間選擇 `data/history/index.json` 中已保存的日期；只能選擇有快照的日期，**不會用最新數據冒充過去的資料**。
- `scripts/update_data.py` 與原本的定時工作流程會同步更新 `data/latest.json`，也為各日期保存 `data/history/YYYY-MM-DD.json`。同一日期保留當日最新成功快照。
- 排名來源是 `snapshots.all` / `sorted.all`，對應傳奇榜前 200 名玩家 A/B 隊伍的 Ranger 使用次數；圖中的日期是資料抓取日期，不保證等同遊戲官方週結算時間。
- 圖片輸出為 1920 × 1080 PNG；4 欄 × 5 列，排名由上而下再由左至右。
- 背景、外框、星級使用此 repo 的 `image/bg.jpg`、`frame_bottom_*.png`、`frame_top.png` 與 `star_*.png`；透明角色縮圖從 `mti0224/rangerbook_res` 載入。
- `data/ranger-metadata.json` 保存 Rangers 與原始 `faceCenter`、`sizeRatio` 的映射，供圖片裁切。
- **只有排名圖分頁與 Canvas** 使用「王漢宗綜藝體繁」（HanWangZonYi）字體；透過外部 jsDelivr webfont 載入，不變更其他頁面字體。若字體載入失敗則不會用替代字體產生 PNG。
- 若人物縮圖失效會顯示佔位符並在預覽上方標明數量，避免匯出時悄悄遺漏。
