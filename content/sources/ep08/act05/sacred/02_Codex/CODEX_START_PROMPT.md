# Codex execution prompt — copy into connected project workspace

你現在要為既有《母獅帝國》HTML5/Unity 敘事工程匯入 `EP08 Sacred ACT05〈善意的限度〉`。讀取本資料夾的：

1. `README.md`、`04_Canon_and_QA/Current_Canon_and_Delta.md`；
2. `01_Story/ACT05_Sacred_Full_Script_v1.0.md`（正式匯入基準是其中全部新寫 DRAFT 場景文字，不可只匯入摘要）；
3. `02_Codex/ACT05_Choice_Graph.json` 與 `scene_data/SC01..SC05.json`；
4. `02_Codex/src/act05Resolver.ts` 與 `tests/all_36_political_combinations.json`；
5. `03_Art_Project/CG_Asset_Manifest.json` 與美術檔名規範。

請先比對現有專案 scene/choice/save schema，**保留現有已鎖劇情與命名**，不要假設示例 `HostState` 就是現有程式全部資料欄位。建立適配層，將五場文字、條件台詞、FL01–FL10、F5 A/B/C、P01 4 選 1、P02 3 選 1、P03 3 選 1、七種結果 T0–T6 匯入。

落實規則：
- 只有奧莉維亞有玩家選項；FL 純表達差異不得修改任何狀態。
- F5 A/B +1 CLEAR、C +0；只結算一次，不能減去以前 CLEAR。
- P01 A/B/C/D 基底 0/1/2/4；P02 LIMIT/BOUND/EXPAND −1/0/+1；P03 CASE/OPEN/STANDING −1/0/+1。tier=clamp(sum,0,6)；總政治點數 `[+30,+20,+10,0,-10,-25,-40]`、動亂 `[+15,+10,+5,-5,-10,-20,-30]`；只在 SC05 一次結算，動亂 clamp 0–100。
- 禁止把政治失敗 −40 加扣兩次；政治點數不足策略由現行全局系統決定，不自行改寫。
- EP09 章首動亂扣點不能在 ACT05 預扣；EP09 才決定是否正式增援，不得提前 Star/Tower 鎖線。
- 事件 CG 目前只有提示詞，匯入 asset slots 時保持 `PROMPT_ONLY`，沒有正式 PNG 時使用現有背景或未綁資源的安全退化方式。
- ACT05 地點是**東北塔**，**米椰爾主動來訪**，不是出發聖安奴加斯；艾莉西亞不是艾莉。F5 研究地點是**非爾斯敦**。

工作完成時請輸出：修改文件清單、場景導覽、已連結與尚缺的 CG ID、36 組路線測試結果、F5/存檔重播測試、未解決的來源衝突；不得無聲覆寫原版本。
