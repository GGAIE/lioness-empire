# 正式劇情匯入與更新手冊

## EP04 後三幕與條件場景

執行 `npm run content:import-ep04-later-acts`。`availableWhen` 控制整場與目錄可見性，`conditionalNext` 控制自動接續，`completionEffects` 於實際讀完末段後依旗標執行。一次性獎勵須同步推進守門狀態；F1 已完成者回讀第三幕不得倒退狀態。CG、說話者與閱讀版編輯皆用精確來源文字核對。先完成建置，再跑瀏覽器測試，避免讀到正在複製的公開資料。

本工程執行時只載入外部 JSON，無 AI 生成、改寫 Canon 的流程。故事原稿與核准作業在工程外進行；正式 JSON 是執行資料。

## 1. 編輯入口與常用指令

在 `lioness-empire` 目錄執行：

```sh
npm ci
npm run content:validate
npm run content:report
npm test
npm run build
npm run dev
```

`content:validate` 及 `content:report` 均檢查內容並更新 `docs/content-report.json`，失敗時回傳非零狀態。`dev` 啟動前會驗證並複製內容；修改來源 JSON 後，重新執行驗證再重新整理瀏覽器。不要直接編輯 `apps/web-vn/public/content` 或 `dist`，兩者是交付副本。部署時將整個 `dist/` 交給任意靜態 HTTP(S) 主機；不需帳號、外部 API、伺服器業務程式或付費服務。不要用 `file://` 雙擊 HTML，瀏覽器會限制 JSON 讀取與儲存。

`package-lock.json` 固定套件實際版本。更換開發機請用 `npm ci`；首次執行瀏覽器測試先用 `npx playwright install chromium webkit`。

## 2. 單章獨立交付

內容索引：`content/manifests/story.json`。每一章引用一個獨立 JSON，可在章檔中放多幕／場景。更新 EP04 只編輯 `content/episodes/ep04/chapter.json` 與版本／必要索引，不需改 EP05–EP12。

尚未交付的章節保持：

```json
{"id":"EP04","title":"不得已攝政","status":"NOT_YET_AVAILABLE"}
```

核准後建立章檔，加入 `file`、`entry` 並將索引狀態改成 `AVAILABLE`。章檔的 `status` 及每個場景 `status` 都必須為 `CANON`，`id` 與場景 `chapter` 必須和索引一致。範例結構：

```json
{
  "schemaVersion": 1,
  "id": "EP04",
  "version": "1.0.0",
  "status": "CANON",
  "source": "已核准原稿名稱／版本／幕次／頁碼",
  "scenes": []
}
```

將下一節的場景物件放入 `scenes`。空章不應標成 AVAILABLE。未來第一段正式內容就緒時將根索引 `start` 改成該章 `entry`。DEMO_ONLY 不可混入正式章節，也不可由正式場景連到 DEMO；測試包可以保留獨立入口供開發使用。

目前載入器會一次讀取索引中已交付的章檔；大量製作後可再增加按需載入，但不需要變更資料模型。未完成章節不載入、也不自行生成替代內容。既有 EP01／EP02 工作稿仍需先核對 v2。

## 3. 新增一幕／場景

以 `docs/templates/scene.json` 為範本。場景 ID 建議 `EP04_ACT01_SC01`；幕次寫在 `act`，章節寫在 `chapter`。`segments` 中每段也必須有穩定 ID，如 `L001`。修正文句、替換圖片時維持原 Scene／Segment ID；真正新增段落才配新 ID。

欄位責任：

| 欄位 | 說明 |
| --- | --- |
| `kind` | narrative / choice / result / end |
| `pov`、`cast`、segment `speaker` | 必須引用 `content/characters/index.json` 的人物 ID；NARRATOR 供旁白視角 |
| `knowledge.knows`、`withheld` | 當下人物可知／不能得知事項；需人工校對時間線與文意 |
| `source`、`version` | 必填來源與場景修訂版；不因引用舊稿就標為已核准 |
| `cg`、`bgm` | 引用素材 ID；場景進入時明確重建媒體，省略 bgm 會停止前一場配樂 |
| `next` | narrative/result 的下一場；end 不可有 next |
| `segments[].when` | 可選的顯示條件；每場至少一段無條件文字，確保存檔位置可恢復 |
| `segments[].cg`、`sfx` | 閱讀到該段才顯示／觸發；被條件略過的段落不觸發 |

Result Scene 需 `kind: "result"`、無 choices，以文字呈現其他角色怎麼執行、權力和代價歸誰；不能把決策交還玩家。只有 OLIVIA POV 可以有 Choice。EP12 一律禁止 Choice。`end` 的多段文字仍可逐段讀完。

## 4. 選項、條件與效果

```json
{
  "id": "inspect-record",
  "text": "查閱記錄",
  "next": "EP04_ACT01_SC03",
  "when": {"all": [
    {"path": "clear.finley", "op": "gte", "value": 3},
    {"path": "flags.RECORD_AVAILABLE", "op": "eq", "value": true}
  ]},
  "effects": [
    {"type": "flag", "key": "RECORD_INSPECTED", "value": true},
    {"type": "clear", "key": "finley", "delta": 1}
  ]
}
```

使用前在根索引 `flags` 宣告 `RECORD_AVAILABLE`、`RECORD_INSPECTED` 的 `initial` 與 `description`。旗標支援 boolean / number / string；同一旗標不得跨版本擅改型別。AND / OR / NOT 對應 `all` / `any` / `not`；比較支援 eq/ne/gt/gte/lt/lte/exists。數值比較只能用於數字；路徑只能是 Schema 允許的 GameState 欄位，不執行任意 JavaScript。

每個 Choice 場景至少保留一個無條件 fallback，避免所有選項消失。選項 ID 在場景內唯一。效果以完整副本交易執行，任一效果非法即不提交。`decisionLog` 以 Scene ID + Choice ID 鎖定，同一輪不能重返場景累加效果；讀取「決策前」存檔可以重新選擇，這是不同時間點。

效果種類：

```json
[
  {"type":"score","delta":-5},
  {"type":"political","value":"SACRED"},
  {"type":"reinforce","value":true}
]
```

以上是語法展示，不代表要放在同一個正式選項。`political` 應在 EP06 鎖定 SACRED/WORLD；EP09 的 `reinforce:true` 將 SACRED→STAR、WORLD→CHARIOT，`false`→TOWER。路線確立後拒絕二次轉換，不能以 CLEAR 或分數最大值替代歷史決定。`EARLY_PS_ZERO` 必須由核准的早期政治失敗事件明確寫入，Tower 之後不可只因 PS=0 就寫死亡。

數值範圍：alinda 0–7、finley 0–10、tamara 0–6、shalia 0–6；PS 為非負整數，未自行假定上限。CLEAR 是制度支柱完成度，與存活、好感不是同一數值。塔莉雅 TALIA 與塔娜拉 TAMARA 不可合併。

## 5. 替換 CG／聲音

把圖片放到 `assets/cg/`，音樂／音效放 `assets/bgm/`／`assets/sfx/`，修改 `content/manifests/assets.json` 中同一個 `id` 的 `src`。劇本保持引用原 CG ID，不需改場景與 UI。路徑只接受 `assets/` 下安全相對路徑，禁止 `..` 與外部網址。

```json
{"id":"hall-dawn","type":"cg","src":"assets/cg/hall-dawn.webp","label":"黎明議事廳","status":"APPROVED","source":"美術核准版本／作者／權限依據"}
```

圖片建議 16:9；可用 `presentation` 設定 `fit`（cover/contain）、focusX/focusY（0–100）、zoom（1–1.3）、panX（-5–5 百分比）與 fadeMs（0–3000）。淡入與緩慢縮放／平移遵守系統減少動態效果設定。`imageWhen` 可控制整場圖片顯示。CG 載入失敗有安全提示，不中斷對話；下一場與選項目標圖片會預載。圖片成功顯示後解鎖收藏。

WebP/JPEG/PNG 適合正式圖片；MP3/AAC/WAV 適合跨裝置音訊，實際編碼仍需在目標 Safari/Chrome 測試。音訊需玩家按「開啟聲音」；存檔不記音樂精確秒數，讀檔重新建立本場媒體。新場景沒有 bgm 就停止，不暗中承接前場。

## 6. 更新結局規則

`content/endings/rules.json` 是正式結局槽位與規則草案；`demo.json` 專供 DEMO_ONLY。規則含 `id/title/orientation/grade/status/priority/when/reason/source`。priority 越小越先；不得重複。解析器是純函式，回傳候選、最終狀態、被覆蓋規則與遞迴條件實際值。

`APPROVED` 只用於已由 Canon 負責人核准、可追溯來源且測試完成的條件；此時玩家正式圖鑑可解鎖。`DRAFT` 或 `UNRESOLVED` 即使命中仍回傳 UNRESOLVED，不頒發正式結局；缺條件也不自動 fallback。所有現有三十條皆未核准。不要把「單元測試可以造出候選狀態」誤認為劇本已確保可達。

調整優先序時重跑 `tests/unit/core.test.ts` 中的 30 候選案例與重疊／邊界案例。現行順序依 v2 草案：早期政治失敗 → Tower T=0 → 多核心缺席 → 愚者條約 → 逆位／單缺席 → 低 PS／生存失敗 → 世界結構性 → 路線結果。VII/XVII 政爭拘束分界、Tower 完整生存與庇護事件仍待核定，不能因工程需要自行升格。

## 7. 存檔相容與遷移

IndexedDB `lioness-empire-html5-v1` 保存 6 手動槽、自動槽、遷移備份；收藏與設定獨立於遊戲槽。存檔含 schemaVersion、contentVersion、場景／段落、路線、CLEAR、旗標、decisionLog、已讀與歷史。縮圖是本地圖片轉成 320×180 JPEG，圖片失敗仍可保存無縮圖的進度。

變更章節後更新根 `version`、章 `version`、場景 `version` 與 `content/CHANGELOG.md`，列出來源、修改範圍及遷移。已刪除或改名場景在根 `migrations` 中加入 `"舊ID":"新ID"`；目的場景必須存在。版本不同、場景遷移、段落縮短、新旗標均會提示並要求玩家確認。

無映射的舊場景會提議以**新遊戲狀態**回到安全起點，保留已讀／回顧；不能帶著舊 decisionLog 讓玩家卡在已決策的選項。確認遷移前先備份原始 record，存讀檔視窗可匯出原始資料。備份失敗就不替換當前進度。不要默默丟棄無法理解的存檔。

已支援本 HTML5 格式 schema v1→v2 的明確適配；未來 schema 變動需新增遷移分支與測試。**既有 v0.3 閱讀器和 Unity 的存檔格式未自動轉換**，兩者原資料仍保留在各自位置。匯入只接受本工程的包裝格式（exportVersion 1，最大 5 MB），拒絕未支援版本、越界數值、矛盾路線和錯型旗標。

替換台詞而沿用同 Segment ID 會保留已讀狀態；若改寫到需要玩家重新閱讀，給新 Segment ID 並記錄修訂理由。不要為一般文字修正任意更換 Scene ID。

## 8. 驗證範圍與人工 QA

自動檢查：Schema、未知欄位、重複 ID、人物／素材引用、實體檔案、分支目標、選項 POV、EP12 禁令、測試／正式隔離、旗標型別、結局 priority、遷移目標、結構可達性與沒有出口的循環。從 start 探索最多 10,000 個實際狀態，檢查條件死路、路線效果和數值越界；達上限會失敗而不假稱完整。

尚未從任意章節與任意匯入狀態做數學式證明；未完成正式劇情時亦無法證明三十結局在正式流程全部可達。每批交付還需人工檢查人物知識界線、Canon、場景因果、媒體時點與手機長文排版。

```sh
npm run schema:export
npm run test:e2e
npm run build
npm run test:production
```

JSON Schema 位於 `schemas/`，可供外部編輯工具及未來 Unity 讀取；遞迴條件使用 JSON Schema `$ref`。修改 Schema 後重新匯出，不能只手改產出檔。

## 9. 下一輪正式交付建議格式

每批提供：核准章節 JSON、來源文稿、章／幕／Scene ID 清單、人物知識邊界、旗標設定與讀取表、CG／BGM／SFX manifest、版本差異及存檔映射。新增已支援資料只需內容檔／索引，不需改 UI 或核心。若新演出超出 Schema（如嘴型同步、角色立繪動畫），先提出資料協定擴充，再實作通用引擎能力，不能把單章特例寫進 UI。

## 10. 逐章規劃 v0.1 接入

新增 `content/planning/part-one.json` 及原始 Markdown，對應序幕＋EP01–12、五幕節點與24件角色事件。正式 CANON 場景需填 `planNodeId`，例如 `EP04_ACT01`；一幕可有多個場景，不強制三場。驗證會檢查章幕一致性，並拒絕在無有效選項的節點放 Choice。

新政治資源／動盪模型使用獨立 CampaignState；舊 DEMO 的 politicalScore 及舊存檔不自動轉換。舊 PS／XI 受影響門檻已退出現用規則，原規則副本只供回歸測試。新模型當前用於作者走訪與純函式規則測試，正式戰役的數值、場景適配與存檔遷移待核准後接入。

完整差異、未定規則、更新指令及來源權限見 [逐章規劃接入紀錄](CHAPTER_PLAN_INTEGRATION.md)。

## 11. 固定劇情選項與雙數值效果

政治點數與動盪變化必須由固定劇情選項資料決定。玩家只提交決策 ID 與選項 ID；引擎從 CampaignPlan.decisions 讀取作者預先設定的 cost、resourceGain、unrestDelta。相同狀態／選項的效果相同，不接受玩家輸入數值、不隨機計分、不由執行時 AI 改寫。

範本：docs/templates/story-decision.json。缺值保留 null 與 PENDING；三項固定效果都填妥並經核准才標 APPROVED。章初級距由前一章選項造成的動盪自動結算。作者工具的初始狀態試算僅供工程驗證，已收納於進階開發測試，不能當成玩家操作。

## 場景末事實與缺圖

completionFlags用於非choice場景，只有末段讀完才套用已宣告、型別相符的事實；不應用來把選項提前當成結果。整幕／章完成仍使用kind=end與completion.scope，不得以中間場景冒充整章結算。DRAFT的PLACEHOLDER插圖不渲染示範畫面亦不收藏，讀者會看到「此張插圖待補」，DEMO展示行為保留。

## 玩家閱讀版文字潤飾

明確的出戲文字編輯保存在 `content/reader/immersive-text-v1.json`，記錄原文與精確場景／段落或選項 ID。發佈時自動套用，原始匯入資料保留；新來源若改動該段原文，須重新檢查對照。正文與選項另檢查 ACT／EP／SC／CG 編號、章幕指涉及鏡頭指令；此檢查不掃描合法的場景識別碼與製作註記。驗證與詳細紀錄見 `IMMERSIVE_TEXT_REVIEW.md`。
