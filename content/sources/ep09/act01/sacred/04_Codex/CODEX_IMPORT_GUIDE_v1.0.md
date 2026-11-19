# Codex 匯入指引｜EP09 Sacred ACT01 v1.0

本包是**待審核劇本文字與效果規格**，不是可不經審核直接覆寫現有程式的補丁。

1. 先讀原 `Lioness_Empire_EP09_Complete_Startup_v1.0` 中 `00_Governance/CANON_AND_CONFLICTS.md`、`01_Story/EP09_FIVE_ACTS.md`、`02_Routes/SACRED.md`、`03_Implementation/FLAGS_AND_CHOICES.md`；再讀本包完整版劇本及選項表。
2. 以現有 scene registry/API 將五個場景映射進 Sacred ACT01；不可憑空創建第二次路線選擇，不修改 World 線。
3. 每個 FLAVOR 選項將三個文本分支匯流至同一個後續節點，不能隱性寫入歷史旗標、關係值或政治點數。
4. SC03 只有 `C03_PACT_B` 觸發 `-30 Political Points`；先核對欄位名稱、扣點函數、clamp 與全域失敗 Resolver，避免覆蓋全域規則。
5. 無論 SC03 A/B/C，未觸發 VI 時教會同意收容難民。教會不為王室觀望政策背書，也不取得七領地主權。
6. 軍事結果留 ACT02；議會合法接收留 ACT04–05；東線增援選擇留新幕間《東線告急》。
7. 不生成 CG；缺圖使用明確資產待補標記，禁止將暫定角色造型或歷史地名當作已核准設定。
8. 提交匯入前的差異報告、scene navigation QA、選項效果測試，以及舊存檔相容與 rollback 方案。
