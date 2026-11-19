# Codex Agent 啟動任務
請先閱讀 `00_README/README.md`、`01_SCRIPT/ACT01_FULL_SCRIPT.md`、`03_SYSTEM/CHOICES_FLAGS_QA.md`、`04_CHARACTERS/ASSET_EXTRACTION.md`、`02_CG/CG_MANIFEST.md` 及 `02_CG/PROMPTS_EN.md`。

**作業模式**
1. 先 Audit 現有 HTML/JS/CSS 劇情 registry、EP09 World 預留結構、政治點數及全域 bad end、save migration、CG asset manifest。寫出 `EP09_WORLD_ACT01_AUDIT.md` 後才改動程式。
2. 檢索既有已完成的 Hebe 與 Roland 人物設計，輸出確切路徑、版本與比對結果。找不到則 `SOURCE_REQUIRED`，不自行生成新立繪。不重繪原人設，不偷用圖片 prompt 當外觀 Canon。
3. 將劇本五場按固定 sceneId 匯入 World 分線，使用繁體中文原稿，不拆掉 SC01–05 的政治因果。SC01–SC05 各自 5–6 個 CG 插入點，對應 `CG_MANIFEST.md`。
4. F01–F06 三分支只切換短對白，不寫持久數值／旗標。M01 四選一且一次性結算 +10、+5、+0、-15（最後暫定），D 設赫碧政治人情並由家族補資金，四分支安置主線持續。
5. ACT01 不完成七領地正式接收，不殺羅蘭、不鎖定東線 Tarot；ACT02 後續兩岸夾擊艾琳達擊殺羅蘭，ACT04–05 議會議決，另幕間東線增援的時間衝突先報告遷移方案。
6. 圖片清單是生圖提示，不是圖片已存在；美術製作完成前應以標示缺圖的 manifest placeholder 表現，不能把示意佔位當成正式 CG。
7. 交付：audit、變更檔清單、choice / flags / migration 說明、遊戲畫面測試、28 個 manifest 項目校驗、SOURCE_REQUIRED 清單。已核准舊正文不擅自改寫。
