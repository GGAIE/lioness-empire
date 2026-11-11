# EP07 ACT05 World｜製作規格與 QA

## 故事版本與證據界線
- 本次 **SC01 有效選項**：只有親訪 A2 CLEAR，書面或不處理均 FAIL 並且不播放拜訪劇情；學院賠償仍照原約進行。
- SC02 路恩蘇菲不積極清算，但尚未全面赦免。S3 於 ACT02 已判斷，本幕不再更新。
- SC03 由 EP07 ACT01 SC05 的模糊求援延伸：塔馬拉＝警備／路線，芬利＝文件／來源，卡利斯＝異常結晶識別。
- SC04 現場空箱：真貨是虛空能量結晶，在交易前因保存不當昇華。交易未完成；文書與現場痕跡保留可供追查。
- 學派舊轉運格式、王都西側倉庫、幾枚封蠟殘痕為本稿演出提案，**不推論學院首腦有罪**；World 艾拉協助核對，T2 / F4 同時 CLEAR 一次。
- ACT03 的虛空觀測站事故與這批結晶、ACT04 奧塔莉雅復活事件 **不設定因果關聯**。
- 本輪對話沒有核准數值成本，**不增設政治點數／動盪的任意±N**。

## 旗標與場景流程
```
SC01:
  A: play CG W05-03..07; set A2_CLEAR true; goto SC02
  B: play CG W05-08; set A2_CLEAR false; goto SC02
  C: set A2_CLEAR false; goto SC02
SC02:
  read existing S3_CLEAR; optional variant dialogue; no mutation
SC03:
  investigate; no T2/F4 mutation
SC04:
  on World route after Ayla records cross-check:
    set T2_CLEAR true
    set F4_CLEAR true
  preserve separate independent flags; no forced arrest/conviction
SC05:
  no significant numerical mutation; goto EP08
```

## 畫面一致性
| Tag | 角色 | 強制視覺 |
|---|---|---|
| @OLIVIA_REGENT | 奧莉維亞 | 長及腰藍黑直髮、琥珀金眼、獅徽戒與 Ogan 吊墜、深海軍藍與古金、**無王冠** |
| @ALINDA_ARMOR | 艾琳達 | 淡灰金低馬尾、鋼藍眼、實用第六騎士團護甲、儀式劍 |
| @FINLEY_ADMIN | 芬利 | 嬌小中性成年者、海軍藍長袍、完全人類、**無角／鱗／尾／尖耳** |
| @SHALIA_COMMAND | 莎莉雅 | 成熟女領主、森林綠、編髮低髻 |
| @TAMARA_GUARD | 塔馬拉 | 第二團靛藍與銀飾、短披肩與治安裝備 |
| 卡利斯 | 卡利斯・托維爾 | **必須以專案／先前角色設計為準**；本包不擅自鎖定髮色和五官 |
| 艾拉 | 艾拉・葛拉維茨 | 紅髮、魔法學院政治掮客；使用已核准形象 |

## CG QA 必檢
1. 34 個 ID 逐一對應完整劇本插入位置，所有 ID 唯一，無漏圖；按 manifest 產生單張影像。
2. 所有圖 16:9、1920x1080 起，禁可讀文字、Logo、浮水印；不要把提示集合拼成九宮格。
3. 奧莉維亞常服**不得戴冠**；角色體型、服裝、髮色跨圖一致；芬利是人類外觀。
4. 人物不多手、多指、頭翻轉、關節畸形；手部操作文件與晶體的姿勢自然。
5. SC01 選 B/C 時不得顯示 A 專屬的 CG 03–07；選 A 不顯示 B 的 CG 08。
6. SC04 空箱裡 **不得畫出任何完整實體結晶**；只可有極微弱紫色殘留物；不得畫大型虛空裂縫、爆炸或復活古龍。
7. 艾拉在 SC04 透過魔法通訊登場，不是人在現場；走私者沒有在本場被確認逮捕。
8. 是否能用到既有角色參考圖：本 ZIP 僅收文字提示與 manifest；不包含原先的人設參考 PNG 或生成好的 CG。
