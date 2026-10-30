# 序幕〈母獅登基〉v0.6 接入

日期：2026-10-30。依使用者本輪要求，把提供的 Markdown 和八張 CG 製作為可閱讀的無選項過場。

## 交付內容

- 預設入口 `PRO-SC01`，連續播放至 `PRO-SC08`；8 Scene、346 段可閱讀文字、8 CG、0 Choice。
- 保留旁白、角色對白、艾琳達心聲及轉場字幕，未改寫對白、姓名用字與劇情。
- SC08 在原稿的「畫面漸黑」位置轉黑，依序顯示「數年前。」「皇家魔法學院。」及最後一段旁白。
- 結尾顯示序幕完成；2026-10-30 已新增「進入 EP01 第一幕」按鈕，銜接後續交付的學院正文，也不觸發正式結局解析。
- 支援點擊／空白鍵推進、逐字、AUTO、回顧、存讀檔、CG 收藏；只有實際顯示過的 CG 解鎖，標題頁不先解鎖圖片。
- 新制政治點數50、動盪30，整段不扣點、不加分、不彈出政治結算；資源狀態納入玩家存檔，與作者試算隔離。
- 每幕引用一張使用者提供的原圖，未修改圖片。桌面採約16:9，手機以保留完整構圖的留邊方式顯示。

## Scene / CG

| Scene | 標題 | CG |
| --- | --- | --- |
| PRO-SC01 | 加冕之日 | PRO-CG01_v1.png |
| PRO-SC02 | 領主的席位 | PRO-CG02_v1.png |
| PRO-SC03 | 王國的秩序 | PRO-CG03_v1.png |
| PRO-SC04 | 未被說出口的事 | PRO-CG04_v1.png |
| PRO-SC05 | 奧莉維亞 | PRO-CG05_v1.png |
| PRO-SC06 | 王冠與誓言 | PRO-CG06_v1.png |
| PRO-SC07 | 母獅登基 | PRO-CG07_v1.png |
| PRO-SC08 | 故事尚未開始 | PRO-CG08_v1.png |

## 來源與狀態

正文原件保存在 `content/sources/prologue/source-v0.6.md`，資料在 `content/episodes/prologue/chapter.json`，圖片在 `assets/cg/prologue/`，素材 ID 在 `content/manifests/assets.json`。

原文件標示「DRAFT，尚未核准」，因此內容狀態保留為 DRAFT，索引為 DRAFT_AVAILABLE；使用者要求接入播放不會被工程自行改成全局正式 Canon 核准。這個標記不阻止試玩，也不增加確認流程。英文 CG 提示詞與製作註記不當成角色台詞。

原稿尾端稱 EP01 為〈王冠之前〉，先前逐章規劃索引稱〈從魔法學院召回〉。保留兩份原稿；後續已交付的 EP01 ACT I v0.3 亦使用〈王冠之前〉，現以新劇本標題顯示可繼續閱讀的第一幕，詳見 `EP01_ACT01_DELIVERY.md`。

未收到配樂、音效或配音檔，故本版不套用引擎測試音樂，不把文字音效指示當作旁白播放；指示保存在各場景 directions，留待提供音訊後對應。

`docs/prologue-import-report.json` 記錄正文原件與八張 PNG 的 SHA-256、尺寸、檔案大小及匯入數量。圖片為約16:9（來源原圖1672×941），以原始位元組保存。

## 維護與驗證

```sh
npm run content:import-prologue
npm run content:validate
npm run schema:export
npm test
npm run build
npm run test:production
npm run test:e2e
```

匯入工具從已保留的 Markdown 及圖片重建章節／索引，不改原件；已有主線結局草案與舊 DEMO 保留。開發模式另有「引擎試演」供舊測試流程使用，正式玩家建置提供序幕及已交付的 EP01 第一幕入口。

新存檔包含 PLAYER 類型的獨立 CampaignState。較早的試驗存檔若在本無計分序幕缺少新制數值，讀取時會提示補入50／30；原始存檔仍走既有備份／確認流程。舊 DEMO 的政治存續 PS 不作新制政治點數。

新增測試核對原件、段落、說話者、字幕、0選項、原圖雜湊、346段純流程、途中存讀與八張圖的實際顯示。桌面完整點選346段；Android尺寸的Chromium與iPhone尺寸的WebKit亦驗證全部八個CG場景與結尾。這些瀏覽器裝置設定測試不等同實體手機驗機。
