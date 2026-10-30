# 《母獅帝國》EP01〈王冠之前〉
# ACT III〈重返王都〉｜完整 VN 劇本與 20 張 CG 生成提示詞

**版本**：v0.3 DRAFT｜2026-10-30  
**內容**：五個 Scene／20 張獨立 CG／三組純對話選項（各三答案）／完整共同文本與分支文本  
**製作模式**：全 CG＋文字框；**不使用人物立繪**  
**版本治理**：依最新討論撰寫的新版草稿，**不自動取代原 EP01 鎖定正文**。所有新補的王宮程序與演出細節均屬本稿提案，待審後再標 `APPROVED`。

---

## 0. 本幕定位與承接

### 前情

ACT I：奧莉維亞在皇家魔法學院收到一封幾乎沒有溫度的王室公函。信上只提到父王健康欠佳、王儲艾維斯必須支援東線，命她儘速返都。她連父王病得多重都不知道。  
ACT II：原本因觀測任務出差的芬利回到學院。這位研究團隊核心成員與奧莉維亞整理未完成的工作，在學院核准下，作為研究聯絡／外派成員與她同行。ACT II 的工作優先方向可能不同，但不影響本幕事件次序。

### ACT III 的戲劇核心

奧莉維亞離開了可以靠實驗、證據與重做測試解決爭論的學院，回到一個即使資料有錯，也必須繼續運作的王都。這裡有家人，有官署，也有責任邊界。她看見問題，卻還**沒有**以王女身分直接調度國政的正式權限。

### 本幕必須遵守的事實

- 艾維斯是有能力、具合法地位的王儲；已婚並有三名子女。他支援東線是承擔軍務，不是逃避王都職責。
- 父王仍有意識與政治意志；不可藉病況預告死亡、被毒害或擅自設定秘密診斷。
- 芬利在本幕是學院派出的研究合作者，不是王室機密檔案的萬能通行證，也不是攝政副手。正式芬利支線起於 EP04。
- 王宮內廷、官署、醫療人員皆有各自的權責與資訊界線；對方未說明，不等於陰謀。
- **三組選項都只影響當下對話與反應，不變動政治點數、動盪值、好感度、路線與後續事件順序。**
- CG 圖片只承擔畫面；信件、資料與標題文字須由 VN 文字介面顯示，不由 AI 圖直接生成可讀內容。

### 場景索引

| Scene | 名稱 | CG | 玩家選項 | 推進 |
|---|---|---:|---|---|
| SC01 | 歸來的王女 | 4 | 無 | 抵達王都；吐槽「王室免費勞工」；轉入王女儀態 |
| SC02 | 北翼的燈火 | 4 | ① 三選一，零數值 | 詢問父王病況與晉見安排 |
| SC03 | 三份不一樣的報告 | 4 | ② 三選一，零數值 | 發現資料時間與範圍的差異，確立核實方式 |
| SC04 | 王儲的責任 | 4 | ③ 三選一，零數值 | 與艾維斯見面，釐清軍務與兄妹關係 |
| SC05 | 留在王都的人 | 4 | 無 | 夜間整理；理解權限界線；接 ACT IV |
| **合計** | | **20** | **3 組** | |

---

# 第一部分｜完整劇本

> 格式：`[CG]` 為換圖節點；「旁白」為敘事框；人物姓名為說話者。分支後標明 `COMMON`，可直接轉換為 VN node。全 CG 模式下，對話時保持當前 CG 畫面，不需要另作表情立繪。

## SC01｜歸來的王女

**時間**：返都日午後  
**地點**：王都外圍道路 → 王都街道 → 王宮門前  
**場景作用**：展示王都的繁華與秩序，建立奧莉維亞在芬利面前的私人幽默，並用進宮前的儀態轉換帶出她雙重身分。

### [CG ACT03-SC01-01] 城牆在望

**旁白**：王都的城牆在午後陽光下逐漸清晰。通向城門的道路比學院附近擁擠得多，商旅、驛車與運貨隊伍混在同一條路上，偶爾還有小隊士兵穿過人群。

**旁白**：馬車的簾子晃動著。芬利坐在車內，膝上放著出差帶回的資料匣，還在核對路上記下的幾項問題。奧莉維亞則把手肘靠在窗框邊，望向熟悉而又有些久違的輪廓。

**芬利**：「比我想的還熱鬧。」

**奧莉維亞**：「王都從來沒有因為誰不在，就決定休息一天。」

**芬利**：「那倒很符合行政工作的精神。」

**奧莉維亞**：「別急著稱讚，等你看過王宮裡的公文再說。」

**旁白**：芬利終於從資料上抬頭，看見她帶著熟悉的半笑神情。

### [CG ACT03-SC01-02] 馬車裡的抱怨

**奧莉維亞**：「芬利，我突然想到一件事。」

**芬利**：「如果是研究經費，我們離開學院前已經核對過了。」

**奧莉維亞**：「不是經費。你知道我上次被叫回家，是為了什麼嗎？」

**芬利**：「王室活動？」

**奧莉維亞**：「幫忙整理一堆根本沒人想碰的文件。」

**芬利**：「……文件？」

**奧莉維亞**：「對。明明宮裡有一整套行政系統，最後不知道為什麼，總有人覺得把事情丟給我比較快。」

**旁白**：馬車通過城門外的一處檢查點。守衛循例查看通行文件，確認車隊的安排，隨即放行。奧莉維亞等車輪重新轉動，才又接著說下去。

**奧莉維亞**：「我真的懷疑，他們是不是覺得我在學院做研究，就是每天都有大把時間等著被叫回來。」

**芬利**：「妳通常也確實能把那些文件整理得比較快。」

**奧莉維亞**：「你這是在替他們說話？」

**芬利**：「我只是在解釋，他們為什麼會先想到妳。」

**奧莉維亞**：「這正是問題。我做得快，所以工作變多；工作變多，又因為我做得快，所以繼續找我。」

### [CG ACT03-SC01-03] 一本正經的反擊

**芬利**：「聽起來很像我們研究室。」

**旁白**：奧莉維亞慢慢轉過頭。

**奧莉維亞**：「你現在是在暗示我也這樣對你？」

**芬利**：「我沒有說。」

**奧莉維亞**：「你的表情有。」

**芬利**：「那可能是這次出差太累了。」

**旁白**：芬利低下頭，假裝專心整理資料。奧莉維亞瞪了他幾息，最後還是笑出聲。

**奧莉維亞**：「總之，我已經有不好的預感。他們這次恐怕又想把我當免費勞工。」

**芬利**：「妳是王女。」

**奧莉維亞**：「所以呢？」

**芬利**：「嚴格來說，妳的生活開銷應該由王室負擔。」

**奧莉維亞**：「芬利。」

**芬利**：「嗯？」

**奧莉維亞**：「你真的很不適合安慰人。」

**芬利**：「我以為我們在討論財務問題。」

**奧莉維亞**：「我們在討論我的人生。」

**旁白**：兩人又安靜了片刻。城內的街景從窗邊流過；遠處宮殿的輪廓漸漸佔滿視野。

**芬利**：「不過，這次應該不只是整理文件吧。」

**旁白**：奧莉維亞唇邊的笑意淡了些。

**奧莉維亞**：「嗯。我也希望只是整理文件。」

**旁白**：她摸了摸收在身邊的信件夾層。那封短得近乎無情的召回令，仍然沒有告訴她更多事情。

### [CG ACT03-SC01-04] 王宮門前

**旁白**：馬車抵達王宮外門。守衛辨認出王室車隊，依照既定程序通報；站在門前的接待人員早已候著。

**旁白**：奧莉維亞理了理衣領與袖口，將方才靠著車窗的隨意姿態收起。她下車時的步伐從容而穩定，像是從未在車裡抱怨過自己是家裡的免費勞工。

**芬利**（低聲）：「剛剛那位抱怨加班的研究者呢？」

**奧莉維亞**（低聲）：「從現在起，請稱呼她為王女殿下。」

**芬利**：「明白，王女殿下。」

**旁白**：迎接她的內廷人員行禮，奧莉維亞正式回禮。

**奧莉維亞**：「辛苦了。我想先了解父王目前的情況，再按內廷安排辦理其他事項。」

**旁白**：王宮大門在兩人身後緩緩闔上。

**SC01 END → SC02**

---

## SC02｜北翼的燈火

**時間**：返都日午後  
**地點**：王宮接待廊、北翼外廊與休息室  
**場景作用**：讓玩家看到奧莉維亞對父親的真實擔憂；說明王室醫療與晉見程序，不製造未經證實的陰謀。

### [CG ACT03-SC02-01] 熟悉的長廊

**旁白**：王宮的長廊幾乎沒有改變。大理石地面擦得光亮，牆上仍掛著奧莉維亞記憶中的紋章與舊畫。只是與平時相比，通往北翼的通道多了來往匆忙的侍從，偶爾有醫療人員抱著封好的藥匣經過。

**旁白**：內廷接待官帶她往一處安靜的房間走去。芬利的行李與研究資料另由專人登記，安排放在允許使用的客房與工作空間；未經授權的宮中區域不在他的出入範圍內。

**內廷接待官**：「王女殿下，您返都的消息已經傳達。國王陛下目前正在休養，醫療團隊希望先減少不必要的打擾。」

**奧莉維亞**：「我明白。我想知道的是，父王現在能否清楚與人交談？」

**內廷接待官**：「就我們接獲的正式回報，陛下仍能聽取必要事項，也會親自作出決定。但關於病情細節，仍需由負責醫療的人員向您說明。」

### [CG ACT03-SC02-02] 北翼外廊

**旁白**：奧莉維亞在北翼入口稍稍停步。前方並沒有誰刻意攔住她，只是已經安排好的照護秩序，不容一群人因她歸來而立刻改變。

**奧莉維亞**：「那麼，我什麼時候能見到他？」

**內廷接待官**：「我們會先向醫療團隊確認適當時段，也須得到陛下本人的同意。」

**旁白**：她知道這是合理的回答。身為女兒，她卻仍然不喜歡只能站在門外等消息的感覺。

**內廷接待官**：「殿下若還有其他需要，請吩咐。」

### [CG ACT03-SC02-03] 女兒的回答｜選項①

**系統／玩家選項**：「奧莉維亞應如何回答？」

- **A：**「我只是想知道，父王現在好不好。」
- **B：**「請在適當的時候，替我安排晉見父王。」
- **C：**「至少這次能有人告訴我，比信上多一點的事嗎？」

#### 選 A：私人關心

**奧莉維亞**：「我只是想知道，父王現在好不好。」

**旁白**：這一次，她沒有刻意維持王室場合的完整措辭。接待官察覺了她的心情，說話也放輕了些。

**內廷接待官**：「陛下受到妥善照護。王女殿下的關心，我會如實轉達。只要安排獲准，我們便立即通知您。」

**奧莉維亞**：「謝謝。」

**→ SC02_COMMON**

#### 選 B：正式請求

**奧莉維亞**：「請在適當的時候，替我安排晉見父王。」

**內廷接待官**：「是。我會依照醫療團隊的安排與陛下本人的意願辦理。」

**奧莉維亞**：「如果父王正在處理必要政務，也請不要因我的到來打亂原有次序。」

**內廷接待官**：「明白，殿下。」

**→ SC02_COMMON**

#### 選 C：對公文的微諷

**奧莉維亞**：「至少這次能有人告訴我，比信上多一點的事嗎？」

**旁白**：接待官短暫地停了一下，顯然明白她指的是那封過於簡短的正式召回令。

**內廷接待官**：「召回公函只負責傳達行程命令，沒有附詳細病況。我很抱歉讓您在路上如此擔憂。」

**奧莉維亞**：「我不是要責備你。只是下一次，如果事情關係到家人的健康，請不要讓我只剩猜測。」

**內廷接待官**：「我會將您的意思轉達。」

**→ SC02_COMMON**

### [CG ACT03-SC02-04] 等候晉見

#### SC02_COMMON

**旁白**：無論她採取哪一種語氣，得到的答案都沒有本質上的不同：父王仍可清楚處理必要事項，但暫時需要休息；詳細病況與晉見時間，尚須依正式程序安排。

**旁白**：接待官離開後，芬利在允許會客的房間與她會合。他將學院交付的外派文件放好，沒有追問不屬於自己知悉範圍的王室醫療細節。

**芬利**：「至少可以先確認，國王陛下不是完全無法處理政務。」

**奧莉維亞**：「對。但我還是想親眼看看他。」

**芬利**：「那就先把能確認的事整理出來。剩下的，不必靠猜。」

**旁白**：奧莉維亞點頭。她今天第一次真正感到，理智與擔憂完全可以同時存在。

**SC02 END → SC03**

---

## SC03｜三份不一樣的報告

**時間**：同日傍晚前  
**地點**：王宮借用書房／接待工作室  
**場景作用**：承接 ACT II 工作優先順序，呈現王宮報告的資料落差；三選項只是奧莉維亞與芬利的對話方法，不改變資訊取得量與數值。

### [CG ACT03-SC03-01] 三疊資料

**旁白**：內廷提供了一間供奧莉維亞整理隨行資料的書房。幾份允許閱覽的正式摘要已送到桌上，另有芬利從學院帶來的研究紀錄。桌面很快被分成三個區域：國王病況與內廷程序、東線相關公告與公開調度資訊，以及學院原有的技術資料。

**旁白**：奧莉維亞先看了其中一份日期，又翻到另一份文件。她眉頭微微皺起。

**奧莉維亞**：「這份提到的安排，日期比旁邊那份早。可是後一份寫的，像是前一項工作還沒有結束。」

**芬利**：「不一定矛盾。可能是統計截止時間不同，也可能是編製部門不同。」

**奧莉維亞**：「也可能是有人到現在還沒完成應該完成的事。」

**芬利**：「也可能。」

### [CG ACT03-SC03-02] 記錄之間的空白

**旁白**：芬利抽出一張空白紙，將每份文件的日期、來源與適用範圍簡單列在同一頁上。幾個看似相互衝突的細節因此變得比較容易理解；另一些卻反而顯得更值得追問。

**芬利**：「至少現在不能直接拿這些摘要下結論。它們不是同一種資料，也不是同一時間的完整紀錄。」

**奧莉維亞**：「在學院遇到這種情況，我會叫大家把測試重做一次。」

**芬利**：「可惜王都不會因為我們想要重做，就把昨天重來一遍。」

**奧莉維亞**：「我開始想念研究室了。」

**旁白**：她看著桌上的三疊文件。此刻的問題並不是選哪一類資料比較重要，而是應該用什麼態度面對這些還不完整的東西。

### [CG ACT03-SC03-03] 研究者的回答｜選項②

**系統／玩家選項**：「奧莉維亞如何回應芬利？」

- **A：**「先把資料來源弄清楚，再談結論。」
- **B：**「文件不會自己說話，我想聽聽承辦人的看法。」
- **C：**「我以為王宮至少會比學院更擅長整理公文。」

#### 選 A：先釐清來源

**奧莉維亞**：「先把資料來源弄清楚，再談結論。」

**芬利**：「我贊成。尤其要注意摘要與原始紀錄之間的差別。」

**奧莉維亞**：「拿不到原始紀錄的地方，就先清楚標註我們還不知道。」

**芬利**：「這樣至少不會把猜測誤當成證據。」

**→ SC03_COMMON**

#### 選 B：重視承辦人的看法

**奧莉維亞**：「文件不會自己說話，我想聽聽承辦人的看法。」

**芬利**：「可以。但口頭說法也有自己的限制，還是需要跟資料互相驗證。」

**奧莉維亞**：「我知道。只是如果每個人都只轉交下一份文件，我們永遠不知道事情卡在哪裡。」

**芬利**：「那就把需要詢問的事項列清楚，等有正式窗口再核實。」

**→ SC03_COMMON**

#### 選 C：熟悉的吐槽

**奧莉維亞**：「我以為王宮至少會比學院更擅長整理公文。」

**芬利**：「學院的公文至少還知道自己有問題。」

**旁白**：奧莉維亞忍不住笑了一聲。

**奧莉維亞**：「很好。你才來王都第一天，就已經學會在這裡生存的第一項技能了。」

**芬利**：「不要隨便相信一份看起來很整齊的表格？」

**奧莉維亞**：「正是。」

**→ SC03_COMMON**

### [CG ACT03-SC03-04] 第一份核對清單

#### SC03_COMMON

**旁白**：兩人最後完成的，是同一份保守的初步核對清單。哪些資訊已可確認、哪些只是摘要、哪些需要向有權限的人正式提出問題，都被分門別類地記錄下來。

**旁白**：奧莉維亞沒有命令任何官署交出機密，也沒有讓芬利以學院研究員的身分越過宮廷程序。

**芬利**：「這樣至少有個起點。」

**奧莉維亞**：「我以為回家以後，最難的事應該是弄清楚誰把我的房間改成了儲藏室。」

**芬利**：「看來妳的房間至少還算安全。」

**奧莉維亞**：「現在先別替它立旗。」

**旁白**：窗外天色逐漸轉暗。內廷傳來通知，王儲艾維斯希望在晚間軍務安排開始前，先與妹妹見上一面。

**SC03 END → SC04**

---

## SC04｜王儲的責任

**時間**：傍晚  
**地點**：王宮王儲會客室／軍務準備書房  
**場景作用**：建立艾維斯可靠且具獨立權責的形象。讓兄妹相處有感情與幽默，避免第一章就寫成敵對關係。

### [CG ACT03-SC04-01] 兄妹重逢

**旁白**：會客室的門開著，裡面沒有隆重的接見儀式。書桌上放著待核的行程表、東線地圖，以及幾封已封緘的軍務文件。

**旁白**：艾維斯看見奧莉維亞進門，先讓身旁的侍從暫退片刻。他身上仍是方便處理軍務的正式服裝，神情有些疲憊，卻沒有失去一貫的穩定。

**艾維斯**：「奧莉維亞。路上還順利嗎？」

**奧莉維亞**：「順利得讓我差點以為，這次回來只是普通探親。」

**艾維斯**：「我倒希望真的是。」

**旁白**：兄妹短暫相視，先前那點不必明說的熟悉感，又在幾句話間回到兩人之間。

**艾維斯**：「父王的事，妳已經知道多少？」

**奧莉維亞**：「公函寫的那幾句，加上內廷能告訴我的部分。還不夠。」

**艾維斯**：「我知道。」

### [CG ACT03-SC04-02] 東線與責任

**旁白**：艾維斯請她坐下，先把能明確交代的情況說清楚。

**艾維斯**：「父王仍然能聽取必要政務，也清楚知道我這次要去東線。但醫療團隊希望他減少負擔，這點我們得尊重。」

**奧莉維亞**：「那你呢？東線真的需要你親自過去？」

**艾維斯**：「有些工作可以交給將領，有些則需要王儲親自到場協調。我不是去替誰收拾一場完全失控的局面，而是希望在事情惡化以前，把需要確認的安排做完。」

**旁白**：他沒有把軍務說得輕鬆，也沒有刻意把每件事講得危急。奧莉維亞能聽出，那是已經反覆衡量過行程與責任之後的判斷。

**奧莉維亞**：「父王需要休養，你又要離開。王宮這邊呢？」

**艾維斯**：「既有官署照常工作。碰到需要王命的事項，仍得遵循正式程序。妳回來，是先熟悉現況、處理能依法交付的事情，不是要妳在一天之內代替所有人。」

**旁白**：奧莉維亞想起馬車裡的抱怨，沒有把那句『免費勞工』立刻說出口。

**艾維斯**：「抱歉，這次是用這種方式把妳叫回來。」

### [CG ACT03-SC04-03] 王妹的回答｜選項③

**系統／玩家選項**：「奧莉維亞如何回應哥哥？」

- **A：**「比起那些公文，我更希望你親自寫信給我。」
- **B：**「既然我回來了，就告訴我現在能幫上什麼忙。」
- **C：**「下次要我回家，至少挑個比較好聽的理由。」

#### 選 A：親人的請求

**奧莉維亞**：「比起那些公文，我更希望你親自寫信給我。」

**艾維斯**：「妳說得對。事情太急，我沒來得及另外寫信。」

**奧莉維亞**：「我不是要你為難。只是那封信看起來，像我收到的是一張調職通知。」

**艾維斯**：「等這陣子過去，我欠妳一封真正寫給妹妹的信。」

**→ SC04_COMMON**

#### 選 B：務實回應

**奧莉維亞**：「既然我回來了，就告訴我現在能幫上什麼忙。」

**艾維斯**：「先不要急著接任何職位。熟悉王都的工作狀態，知道哪些事已有人負責，會比一開始就把所有東西攬在身上更有用。」

**奧莉維亞**：「你這話聽起來，好像是在阻止我被叫去當免費勞工。」

**艾維斯**（淡笑）：「我很清楚妳在抱怨什麼。」

**→ SC04_COMMON**

#### 選 C：兄妹式的玩笑

**奧莉維亞**：「下次要我回家，至少挑個比較好聽的理由。」

**艾維斯**：「我也寧可說是家庭聚會。」

**奧莉維亞**：「最好還有人替我把行李搬好，研究室的善後也順便處理。」

**艾維斯**：「這一點，我恐怕不能替妳向學院保證。」

**旁白**：兩人都笑了。笑意很短，卻足以讓房間裡的疲憊稍微退開。

**→ SC04_COMMON**

### [CG ACT03-SC04-04] 兄長離席前

#### SC04_COMMON

**艾維斯**：「我知道妳擔心父王。我也一樣。」

**奧莉維亞**：「你在東線也要照顧自己。」

**艾維斯**：「我會。家裡那三個孩子已經夠讓我明白，隨便逞強不是一件值得驕傲的事。」

**奧莉維亞**：「那就讓他們繼續監督你。」

**艾維斯**：「他們一直很擅長。」

**旁白**：片刻後，外頭有人輕聲提醒下一項軍務安排即將開始。

**艾維斯**：「妳今天才剛到，不必把每一份文件都看完。先好好休息。等父王方便見妳，內廷會通知。」

**奧莉維亞**：「我明白。」

**旁白**：艾維斯起身，向她點了點頭。這是一場久違的家人會面，也是一段有時間限制的正式談話。

**旁白**：奧莉維亞目送他離開，沒有從這場對話裡得到攝政權，也沒有得到能解答所有疑問的保證。她至少確認了另一件事：哥哥不是將她留在王都、自己抽身離開的人。

**SC04 END → SC05**

---

## SC05｜留在王都的人

**時間**：同日夜晚  
**地點**：王宮借用書房與窗邊  
**場景作用**：總結王都的資訊與權限差異，承接 ACT IV 的有限行政交辦；不提前開始攝政。

### [CG ACT03-SC05-01] 王宮書房的夜晚

**旁白**：夜幕落下時，王宮仍沒有停止運作。遠處廊道偶有腳步聲，值夜的侍從依次點亮壁燈。與學院研究室不同，這裡的燈火總是為一件已在發生的事情亮著。

**旁白**：奧莉維亞坐回借用書房。芬利把白天整理好的資料清單攤開，和她一起確認哪些問題仍然沒有答案。

**芬利**：「今天至少知道三件事：國王陛下還能處理必要政務；艾維斯的東線工作已有安排；官署的日常程序沒有因為妳回來而停下。」

**奧莉維亞**：「而第四件事，是它們並不代表所有事情都順利。」

**芬利**：「正是。」

### [CG ACT03-SC05-02] 被標出的空白

**旁白**：奧莉維亞把幾份摘要排在一起。她注意到，問題有時不是『沒有人做』，而是『沒有人知道下一個決定應該由誰來確認』。

**奧莉維亞**：「在學院，資料如果有問題，我們可以補做一輪測試。」

**芬利**：「在王宮，今天的文件可能已經變成明天的安排。」

**奧莉維亞**：「所以這裡的人連『我們還不確定』都得說得很小心。」

**芬利**：「但不確定，不應該因此變成確定。」

**旁白**：奧莉維亞將一項標註圈起，隨即把筆放下。她沒有因為看出問題，就認為自己可以立刻代替所有有權處理的人做決定。

### [CG ACT03-SC05-03] 學院與王宮之間

**奧莉維亞**：「你覺得我們把研究帶到這裡，是好主意嗎？」

**芬利**：「如果妳問的是資料整理，至少它比我預想中更需要。」

**奧莉維亞**：「我問的不是那個。」

**芬利**：「我知道。」

**旁白**：芬利稍稍停頓，才接著說。

**芬利**：「我們能做的，是讓看得見的東西更清楚。至於誰有權決定、誰願意承擔結果，那不是研究團隊一句話能替代的。」

**奧莉維亞**：「這話不怎麼令人安心。」

**芬利**：「但很適合寫在工作守則的第一頁。」

**奧莉維亞**：「不准。學院那邊已經有夠多守則了。」

**旁白**：兩人交換了一個很輕的笑。至少在這裡，他們仍然能以熟悉的方法把一件事拆成可理解的部分。

### [CG ACT03-SC05-04] 新的待辦

**旁白**：門外傳來輕叩聲。內廷人員送來一份次日的初步日程，以及已由相關官署確認、可向奧莉維亞說明的工作項目。

**內廷人員**：「王女殿下，這是明日的會見與事務簡表。若有任何變動，內廷會再正式通知。」

**奧莉維亞**：「辛苦了。」

**旁白**：文件很薄，遠沒有研究室裡那些堆成小山的紀錄嚇人。

**旁白**：奧莉維亞卻沒有立即打開。她先看了一眼窗外的王都燈火，又低頭看著桌上尚未核實的幾項標記。

**奧莉維亞**：「芬利。」

**芬利**：「嗯？」

**奧莉維亞**：「我開始覺得，這次真的不只是回來整理文件。」

**芬利**：「至少妳已經比昨天知道得多一點。」

**旁白**：奧莉維亞打開日程，翻到第一頁。

**旁白**：在學院，她習慣先提出問題，再決定要如何回答。明天開始，她可能得學著面對另一種更難的情況：有人會先把問題交到她面前，再問她願不願意負責。

**幕尾字幕**：ACT III〈重返王都〉 完

**ACT III END → ACT IV〈有限的責任〉（暫名）**

---

# 第二部分｜20 張 CG 英文提示詞

> **重要**：以下為待生成的提示詞，並非已經產生的圖片。二十張 CG 均為獨立場景；分支選項僅改變文字，不增加畫面。

## 共通視覺鎖定（每張生圖時與單張提示詞一起使用）

**GLOBAL STYLE / NEGATIVE**  
`Premium Japanese dark political fantasy visual novel event CG, refined hand-painted anime illustration, mature coherent character design, cinematic lighting and framing, 16:9 landscape composition, suitable negative space for visual novel dialogue UI, rich but plausible medieval fantasy architecture, no readable text, no letters, no subtitles, no UI, no watermark, no logo. No modern objects, no school uniforms, no crowns on Olivia, no chibi proportions.`

**OLIVIA CHARACTER LOCK**  
`Olivia: adult royal woman, pale skin, very long straight blue-black hair reaching her waist, amber-gold eyes, elegant navy-and-ivory academic-to-royal travel attire with restrained gold details, lion-emblem ring and Ogan pendant, intelligent warm face, refined but natural expression, no crown.`

**FINLEY CHARACTER LOCK**  
`Finley: petite androgynous fully human academy scholar, navy academic robes and practical travel accessories, a scholarly and composed presence, research satchel or document case when relevant. Use the approved Finley character reference for exact face, hair and eye color; do not invent non-human traits. No horns, scales, tail, pointed ears or dragon eyes.`

**AIVIS CHARACTER LOCK**  
`Aivis: adult capable royal crown prince, dignified and warm, restrained navy and gold military-court clothing suitable for preparing eastern-front duties, visually consistent with approved Aivis reference. No villainous expression or exaggerated menace.`

**FAYED** 不於本幕必須出場。其他接待官與侍從保持次要構圖，不搶奧莉維亞主視覺。

### SC01｜歸來的王女（4 CG）

**CG ACT03-SC01-01｜城牆在望**  
`Wide cinematic establishing shot of a fantasy royal capital in warm afternoon light, impressive stone walls and gate, merchant carts and travelers lining the road, a dignified royal carriage approaching the city. The atmosphere is lively and functioning rather than collapsing; distant military logistics are subtly visible, not a war zone. Premium Japanese dark political fantasy visual novel event CG, 16:9, no readable text.`

**CG ACT03-SC01-02｜馬車裡的抱怨**  
`Interior of a comfortable but practical royal carriage moving through a medieval fantasy capital. Olivia, adult princess with long straight blue-black hair and amber-gold eyes, sits relaxed beside a window with a wry amused smile, gesturing as she complains to Finley. Finley sits opposite with a field research document case on his lap, listening with dry composure. Warm daylight, genuine long-time scholarly friendship, medium two-shot, 16:9, no readable text.`

**CG ACT03-SC01-03｜芬利一本正經的反擊**  
`Inside the same carriage, a closer dynamic two-shot: Finley calmly looking down at research notes with a barely perceptible teasing expression, while Olivia turns toward him in mock indignation, eyebrows raised, half smiling. Natural affectionate banter between established academic partners, city seen through window, premium Japanese visual novel event CG, 16:9, no readable text.`

**CG ACT03-SC01-04｜王宮門前**  
`Royal palace entrance courtyard, ceremonial but not grandiose, afternoon light on stone columns and guarded gates. Olivia has just stepped out of the carriage, straightening her dark navy royal travel attire and adopting a poised official demeanor. Finley stands slightly behind holding a research satchel, dignified court attendants waiting at a respectful distance. Strong visual contrast between private and public roles, 16:9, no crown, no readable text.`

### SC02｜北翼的燈火（4 CG）

**CG ACT03-SC02-01｜熟悉的長廊**  
`Interior of a refined royal palace north-wing corridor, polished stone floors, old heraldic paintings and wall lamps, palace servants and medical attendants moving quietly with sealed medicine cases. Olivia walks beside a professional court reception official, looking toward the deeper corridor with restrained concern. Premium dark fantasy anime visual novel event CG, 16:9, no readable text.`

**CG ACT03-SC02-02｜北翼外廊**  
`Olivia standing near the entrance to a quiet royal north-wing passage, speaking calmly with a court reception official. Soft light falls across closed doors, a few respectful attendants remain in the background. She is a worried daughter maintaining the manners of a royal princess; no dramatic guards blocking her, no sickbed shown. Cinematic 16:9 Japanese fantasy visual novel CG.`

**CG ACT03-SC02-03｜女兒的回答（選項共用）**  
`Medium close-up of Olivia in a quiet palace antechamber, facing a courteous official just outside the focal plane. Her amber-gold eyes convey restrained emotional tension and her posture remains composed; expression sufficiently neutral to support three different dialogue responses: personal worry, formal request, or dry frustration. Gentle window light, refined navy travel dress, no crown, premium Japanese anime visual novel CG, 16:9.`

**CG ACT03-SC02-04｜等候晉見**  
`A peaceful palace waiting room near the north wing at late afternoon. Olivia sits at a window or beside a small table, thoughtful after learning the king is resting; Finley stands or sits respectfully nearby with a closed document folder, offering quiet practical support. The scene conveys uncertainty without conspiracy, warm melancholic light, cinematic Japanese fantasy visual novel event CG, 16:9.`

### SC03｜三份不一樣的報告（4 CG）

**CG ACT03-SC03-01｜三疊資料**  
`A palace study worktable divided into three distinct sets of documents and objects: royal court and medical procedure papers, eastern-front dispatch summaries with a folded map, and magical academy technical observations with a small communication crystal. Olivia and Finley review the materials together. Visual distinctions achieved by objects and colors, no readable labels or writing. Premium Japanese political fantasy VN CG, 16:9.`

**CG ACT03-SC03-02｜記錄之間的空白**  
`Finley in navy scholarly robes carefully comparing several document sheets on a desk, indicating conflicting dates and source positions with a pencil, while Olivia leans closer and studies the same materials. Restrained serious analytical atmosphere, palace study with evening daylight, no suspicious silhouettes or secret conspiracy clues, hand-painted anime visual novel event CG, cinematic 16:9, no readable text.`

**CG ACT03-SC03-03｜研究者的回答（選項共用）**  
`Character-focused medium shot of Olivia considering several incomplete reports on a palace study desk. Finley is in the near background allowing her to speak. Olivia's face is alert, thoughtful, with just a hint of her usual dry humor; neutral enough for three alternate dialogue responses. Three organized paper stacks, refined palace interior, cinematic 16:9 premium anime visual novel CG, no readable text.`

**CG ACT03-SC03-04｜第一份核對清單**  
`Olivia and Finley have completed a careful cross-reference sheet in a palace study, papers now organized neatly into confirmed and unresolved groups. Both sit in calm professional collaboration, subdued relief without triumph. Late afternoon golden light, carved wooden desk, elegant fantasy setting, cinematic Japanese visual novel event CG, 16:9, no readable text.`

### SC04｜王儲的責任（4 CG）

**CG ACT03-SC04-01｜兄妹重逢**  
`A dignified but intimate palace meeting room. Olivia, adult royal woman with very long blue-black hair and amber-gold eyes, enters and is warmly greeted by her elder brother Aivis, a capable adult crown prince wearing restrained navy and gold military-court attire. A desk with orderly documents and a military map in background. Sincere familial warmth, not antagonism, cinematic Japanese fantasy visual novel event CG, 16:9.`

**CG ACT03-SC04-02｜東線與責任**  
`Olivia and Aivis seated together in an elegant royal council study. Aivis calmly explains an eastern-front military route on a detailed map, one hand resting near folded dispatches; Olivia listens with intelligent focus and concern. He is competent and responsible, not frightened or defeated. Soft evening light, premium hand-painted anime dark political fantasy visual novel CG, 16:9, no readable text.`

**CG ACT03-SC04-03｜王妹的回答（選項共用）**  
`An intimate medium two-shot of Olivia speaking to her elder brother Aivis in a quiet palace room, her expression warm but measured and capable of supporting tender, pragmatic, or gently teasing dialogue. Aivis listens with a restrained, familiar smile. No hostility, no romantic framing. Warm familial atmosphere, Japanese fantasy visual novel event CG, 16:9.`

**CG ACT03-SC04-04｜兄長離席前**  
`Aivis standing near the palace meeting-room doorway before departing for further military duties, turning back to offer his sister Olivia a quiet reassuring look. Olivia remains beside the desk, concerned but respectful. Family bond and separate responsibilities, refined dark fantasy palace, cinematic premium Japanese visual novel CG, 16:9, no readable text.`

### SC05｜留在王都的人（4 CG）

**CG ACT03-SC05-01｜王宮書房的夜晚**  
`Nighttime palace study illuminated by warm wall lamps and candlelight, Olivia and Finley working through documents at a large wooden desk. Through a tall window, royal capital lights glow in the distance. Quiet analytical atmosphere, elegant dark fantasy Japanese visual novel event CG, cinematic 16:9, no readable text.`

**CG ACT03-SC05-02｜被標出的空白**  
`Close-to-medium event CG focused on the worktable where Olivia marks unresolved gaps in multiple reports, placing a pen beside incomplete comparison sheets. Finley's hands or figure nearby, serious restrained expressions. The image symbolizes information gaps rather than proof of hidden conspiracy, detailed paper textures but absolutely no readable text, premium Japanese fantasy VN CG, 16:9.`

**CG ACT03-SC05-03｜學院與王宮之間**  
`A thoughtful two-character scene in a quiet nighttime palace study. Olivia sits near a desk, turning to Finley with a weary half smile; Finley responds with his characteristic measured scholarly composure. The two long-time academic partners remain equals in discussion, even inside the royal palace. Warm low light against cool night windows, cinematic 16:9 Japanese anime visual novel CG, no readable text.`

**CG ACT03-SC05-04｜新的待辦（本幕尾圖）**  
`Wide cinematic closing event CG in a palace study at night. Olivia sits at the desk opening a slim official schedule folder, while Finley stands nearby and the illuminated capital is visible through a tall gothic window. The atmosphere holds uncertainty, duty, and the beginning of new responsibilities, without a crown or regency ceremony. Rich dark blue and gold palette, premium Japanese political fantasy visual novel illustration, 16:9, no readable text, no watermark.`

---

# 第三部分｜選項、路線與演出實作備忘

## 三組純對話選項

| ID | Scene | 可選風格 | 政治點數 | 動盪值 | 好感度／路線 | 匯流節點 |
|---|---|---|---:|---:|---|---|
| `EP01_A03_SC02_FLAVOR` | SC02 | 關心／正式／微諷 | 0 | 0 | 0 | `SC02_COMMON` |
| `EP01_A03_SC03_FLAVOR` | SC03 | 方法／人員／吐槽 | 0 | 0 | 0 | `SC03_COMMON` |
| `EP01_A03_SC04_FLAVOR` | SC04 | 親情／務實／玩笑 | 0 | 0 | 0 | `SC04_COMMON` |

```yaml
act_id: EP01_ACT03
cg_total: 20
scenes_total: 5
choice_count: 3
choices:
  - id: EP01_A03_SC02_FLAVOR
    type: DIALOGUE_FLAVOR
    options: [concern, formal, dry]
    point_delta: 0
    unrest_delta: 0
    affinity_delta: 0
    route_delta: 0
    merge: SC02_COMMON
  - id: EP01_A03_SC03_FLAVOR
    type: DIALOGUE_FLAVOR
    options: [method, people, joke]
    point_delta: 0
    unrest_delta: 0
    affinity_delta: 0
    route_delta: 0
    merge: SC03_COMMON
  - id: EP01_A03_SC04_FLAVOR
    type: DIALOGUE_FLAVOR
    options: [warm, practical, tease]
    point_delta: 0
    unrest_delta: 0
    affinity_delta: 0
    route_delta: 0
    merge: SC04_COMMON
```

**提示**：若需保留玩家最後一次選了哪種口吻以便讀檔顯示，可在會話暫存中保存純 UI 選中值；不轉化為政治或關係系統數值，也不在後續關卡偷偷獎懲。

## 與 ACT II 選項的相容方式

ACT II 的優先工作方向可決定 SC03 當下由奧莉維亞先打開哪一疊文件、或增加一句不同的提醒；**本稿的共同可知情報、三個選項文本與最後結果仍完全一致**。未經另行確認，不把 ACT II 決策擴展為額外 CG、隱藏優勢或鎖線條件。

## CG 演出方式

1. 每 Scene 固定 4 張，換圖節點明列於正文；每張可承載多句旁白與對話。
2. SC02、SC03、SC04 的第三張 CG 是三種回應**共用**的「中性可兼容表情」畫面。
3. 角色外觀須先用已核准角色參考圖校對；本稿不重新定義芬利與艾維斯未核准的精細髮色、臉型或服飾紋章。
4. 王室文字、軍情報告與選項字句全部使用遊戲 UI，禁止依賴圖片中的 AI 字形。

## 建議資產檔名

`LE_EP01_ACT03_SC01_CG01.png` 至 `LE_EP01_ACT03_SC05_CG04.png`。  
各 Scene CG 與正文節點一一對應，無重複編號。

## ACT III 結束旗標（狀態而非數值）

- `OLIVIA_AT_CAPITAL = true`
- `FINLEY_AT_CAPITAL_AS_ACADEMY_LIAISON = true`
- `KING_HEALTH_INITIAL_BRIEFING_RECEIVED = true`
- `AIVIS_EASTERN_DUTY_CONFIRMED = true`
- `ROYAL_RECORDS_PRELIMINARY_REVIEW = true`
- `OLIVIA_REGENCY_AUTHORITY = false`

**ACT IV 接續要求**：由有限、經授權的王室／行政責任開始，不得因本幕整理資料就直接取得攝政職務；EP04 才開啟首次暫時攝政及芬利正式角色支線。

---

## 本稿需留待確認的設定點

1. 「北翼」是否為新版王室病中休養區的正式命名；此處沿用既有王宮場景語彙，未宣稱建築用途已獲核准。
2. 王宮接待官、醫療程序與晉見安排為本次演出合理化提案，不視為已確立的憲制／醫療制度條文。
3. 艾維斯確切出征日期、前線地理與王宮軍務細節未在此新增定案。
4. 本稿共用的 CG 生圖提示詞必須依正式角色參考圖最終校對。

**稿件狀態：DRAFT，供逐場審閱與後續圖片製作。**
