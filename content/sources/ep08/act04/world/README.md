# Lioness Empire EP08 ACT04 World — 未降臨的寒冰

**完整劇情 + CG 製作提示詞包 v1.0（DRAFT / 待作者核准）**

### 檔案
- `01_Script/Full_Script.md`：五場繁中完整對白、12組純口吻三選一、雙重知會與四組政治分支、所有結算結果。
- `02_CG_Prompts/All_CG_Prompts_34.md`：34條詳細英文 CG Prompt 全集；`Individual/` 分張 34 個可獨立引用檔。
- `03_Production/CG_Manifest.json/.csv`：圖位、互斥條件及對應提示詞。
- `03_Production/Choices_Flags_and_Branch_Matrix.json`：工程可參考的候選旗標和選項規格，不是已匯入正式工程。
- `03_Production/Outcome_Matrix_16_Routes.csv`：兩次知會×兩次政治選擇的16種組合，正確保存每一路線總數值。
- `03_Production/Continuity_and_QA.md`：版本優先序、主要限制及資料缺口。
- `03_Production/Validation_Report.json`：自動檢查結果。

### 核心規則
`NOTIFIED = LETTER_SENT OR VISIT_FIRST`。知會則莎莉雅以主人身分全力規劃、角色事件完成；兩次未知會則收費、調走額外資源、角色事件失敗。兩組中間政治選擇只調整各區間內的結果，未知會最優永遠不及已知會最差。每個分支的點數與動亂已包含中間所有敘事費用，僅於SC05執行一次結果結算。結算標題四級（大成功、小成功、小失敗、大失敗）、實際六數值檔位。

世界線：艾莉不在現場；皇家魔法學院利用其永久精靈契約及古龍研究，在寒冰之眼現世前完成召喚中斷，任何分支都不生成巨龍本體。資料來源啟動包內曾留有 OPEN 項目，本次劇情新提案不冒充已核准原文或最終古龍設定。

### CG 資產狀態
這份 ZIP 提供 **34 條 CG 生圖提示詞，沒有生成 34 張 CG 圖片**；也沒有冒充真正的人設圖片。若開始生圖，請使用專案既有 `@OLIVIA_REGENT`、`@FINLEY_ADMIN`、`@SHALIA_COMMAND` 角色基準。
