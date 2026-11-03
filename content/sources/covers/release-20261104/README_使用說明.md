# 《母獅帝國》六款路線封面

2026-11-04（台北）。六個主題，每款提供桌機與手機獨立構圖，共十二張成品；所有圖片無內嵌文字。

## 快速開始

解壓後用瀏覽器開啟 `index.html`，上方選單可切換三路線與有人物／無人物版本。將視窗縮至 767px 以下，會切換手機直版。離線可用，沒有外部字型、追蹤或網路依賴。

| 檔名主幹 | 主題 | 人物 |
|---|---|---|
| star-character | 各方支持、順利上位的希望 | 奧莉維亞 |
| star-abstract | 星光、聖殿、旗幟與團結之光 | 無 |
| tower-character | 前線兵敗、面對王都陷落 | 奧莉維亞；手部已修正 |
| tower-abstract | 崩塔、焚城、破碎王權 | 無 |
| chariot-character | 兄妹政爭、針鋒相對 | 奧莉維亞、艾維斯 |
| chariot-abstract | 對立王室印記、旗幟與棋盤 | 無 |

## 檔案用途

- `masters/`：十二張生成原始 PNG，保留原始像素與生成資訊。
- `images/*-desktop.png`：1920×1080、精確 16:9，無損交付圖。
- `images/*-mobile.png`：1080×1920、精確 9:16，無損交付圖。
- `images/*.jpg`：品質 92 的網頁用版本，範例預設載入此格式。
- `index.html`、`cover.css`：可直接開啟的展示與響應式範例。
- `docs/`：生成提示詞、來源、QA、圖片尺寸與 SHA-256 清單。

原始生成為橫式 1672×941、直式 941×1672，交付版以高品質插值規整為以上精確尺寸；這是放大輸出，並非原生 1920 解析度。橫直版各自重新構圖，沒有從雙人橫圖硬裁直版。不要將 JPG 作為後續修圖母檔。

## 接入 HTML/CSS

複製 `images/` 與 `cover.css`，使用以下結構；更換主幹即可換路線或版本。

```html
<link rel="stylesheet" href="cover.css">
<section class="cover" aria-labelledby="title">
  <picture>
    <source media="(max-width: 767px)"
            srcset="images/tower-character-mobile.jpg">
    <img src="images/tower-character-desktop.jpg"
         width="1920" height="1080"
         alt="奧莉維亞面對燃燒的王都" fetchpriority="high">
  </picture>
  <div class="cover-copy">
    <p>高塔 · THE TOWER</p>
    <h1 id="title">母獅帝國</h1>
    <a href="/game/">進入遊戲</a>
  </div>
</section>
```

將 `/game/` 改為實際遊戲網址，並自行設定連結樣式；展示頁沒有假遊戲入口。若同頁使用多張封面，請使用不同標題 id。首屏以外圖片改用 `loading="lazy"` 並移除 `fetchpriority="high"`。

容器用 `aspect-ratio:16/9` 與手機 `9/16`，圖片用 `object-fit:contain`，保留全部構圖。不要直接改成全螢幕 `cover`，超寬螢幕與較長手機可能裁掉人物或符號。若需要全螢幕，讓外層使用深海軍藍留邊，內層仍維持比例。

文字與按鈕放底部約 28% 的低細節區，左右至少留 6% 內距；標題最多一行，副標一行，操作最多一排。原圖部分衣裙或石欄仍延伸至底區，UI 請維持簡短。CSS 已附底部漸層與安全邊距。圖片本身不用放遊戲文字，便於本地化與無障礙閱讀。

## 視覺基準與狀態

沿用官方來源圖（原檔名 v0.1）與官方美術規範中的已鎖定特徵：奧莉維亞成年、及腰藍黑直髮、琥珀金眼、冷白膚、海軍藍／古金／象牙、獅徽戒與吊墜、無冠；艾維斯維持成熟軍事統帥形象，未作反派化。詳見 `docs/SOURCES_QA.md`。

這是本次封面交付版；沒有將 v0.1 來源重新宣稱為使用者核准 v1.0 角色包。人物基準核准狀態沿用原始記錄，未新增核准；新建築、旗幟與大型獅徽是本次封面視覺詮釋，並非新增 Canon 或正式組織徽章基準。
