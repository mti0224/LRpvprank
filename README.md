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
