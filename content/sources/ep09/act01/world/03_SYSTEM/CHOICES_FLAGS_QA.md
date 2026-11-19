# Choices, flags and validation｜待與既有 GameState 對映

## 玩家選項
- `F01` SC01 三選一／`F02` SC02 三選一／`F03` SC03 三選一／`F04` SC03 三選一／`F05` SC04 三選一／`F06` SC05 三選一：全部無影響，`effects: []`，只改該段顯示對白，隨後匯合，不記錄長期狀態。
- `M01` SC03 唯一有效選項：
  - `M01_A_GRAVITZ`：Political Points +10；`fundingSource=GRAVITZ`；資金到位，葛拉維茨未來條件保留 OPEN。
  - `M01_B_ACADEMY`：Political Points +5；`fundingSource=ACADEMY`；`academyLeaseNegotiation=true`，**只開租地談判**，尚未簽租約。
  - `M01_C_BASIC`：Political Points +0；`fundingSource=BASIC_AID`；物資到位，後續重建融資待補；難民救援持續。
  - `M01_D_LAND_MISTAKE`：Political Points -15 **暫定需校準**；`fundingSource=HEBE_BRIDGE`; `hebeFavorOwed=true`; `valkenLandOfferRejected=true`；赫碧家族補資金缺口，並非現場取得土地所有權。

## invariants
- 每次遊玩 M01 有且只能選一次。不可重複進出場景刷點；保存 processedChoiceId。
- 所有分支 `VALKEN_REFUGEE_COMMITMENT=true`，不觸發安置主線失敗；四種來源有不同資金／待補後果。
- World 線 `HEBE_FAMILY_LAND_INTEREST=true`，**ACT01 不代表法律移轉**；七領地 `LEGAL_SETTLED=false` 至 ACT05。
- `HEBE_FAVOR_OWED` 只由 D 觸發；A 不可因艾拉出資誤設為欠赫碧人情。
- 第三、第六騎士團進攻指令於 SC05 發出；本 ACT `ROLAND_DEFEATED=false`、`ROLAND_DEAD=false`。
- 不將 Hex/CG 內出現人物視為畫面完成，也不得用名字自動生成新角色設定。
- 政治點數 0 觸發共通的 VI《被寫回條約》：黑畫面、不新配 CG，最後台詞「遊戲結束了，你該回主畫面了。」；本幕不改 resolver 優先序。
- 新選項不能覆寫既有 `F5`、尼爾斯、EP06 World、EP08 Hebe 議員身分等存檔。

## schema mapping（僅候選）
`EP09_W_ACT01_M01_CHOICE` enum；`EP09_W_VALKEN_FUNDING_SOURCE` enum；`EP09_W_HEBE_FAVOR_OWED` boolean；`EP09_W_VALKEN_LAND_OFFER_REJECTED` boolean；`EP09_W_ACADEMY_LAND_LEASE_PENDING` boolean；`EP09_W_VALKEN_REFUGEE_COMMITMENT` boolean；`EP09_W_HEBE_FAMILY_LAND_INTEREST` boolean；`EP09_W_ACT01_COMPLETE` boolean。Codex 須先對照既有 registry，不得直接覆蓋／建立平行重複欄位。

## QA 矩陣
1. 以 EP08 World 存檔進入，本幕只接受 World，赫碧仍是議員。
2. F01–F06 各自三支：前後政治點數、動盪、所有持久旗標不變。
3. M01 A/B/C/D 個別獨立測試，分別 +10/+5/+0/-15（最後一項校準）；每支進 SC04、SC05，並可進 ACT02。
4. D：資金缺口由 Hebe 家族補足，`hebeFavorOwed=true`，瓦肯拒地，地圖與領地所有權不變；ACT04–05 可以引用人情但不可強制創造額外土地分贓。
5. M01 不能二次結算，讀檔、返回前頁、重新整理需保持一致。
6. ACT01 無羅蘭死亡、無七領地主權或土地移轉、無東線正式增援、無塔羅路線改寫。
7. 玩家 PS 被扣到 0 時，由既有全域 VI bad end 接手；不生成本 ACT 額外 CG。
8. 舊存檔旗標缺席需使用安全預設並提供 migration 和 rollback 記錄。
