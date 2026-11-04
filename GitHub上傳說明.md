# GitHub Pages 上傳說明

已整理的遊戲位於 github-pages 資料夾，約 312 MB。首頁 index.html 就在該資料夾最外層：

```
github-pages/
├─ index.html
├─ .nojekyll
├─ assets/       遊戲程式、網頁版圖片、六首原始音樂
└─ content/      遊戲執行需要的劇情與設定
```

不要只上傳 index.html，assets 和 content 必須放在旁邊。

## 建議：保留目前 GitHub 專案，用自動發佈

1. 將這次更新的專案檔案推送到原本 GitHub 倉庫 main，包含 .github/workflows/pages.yml、package.json、package-lock.json、新打包程式及原本的劇情／素材。
2. GitHub 倉庫 → Settings → Pages → Build and deployment → Source，選 GitHub Actions。
3. 到 Actions 找 Publish game to GitHub Pages，第一次可按 Run workflow。之後更新 main 會自動產生並發佈網頁。
4. 等建置、發佈皆成功後，從 Settings → Pages 的 Visit site 開啟遊戲。

這條方式只發佈 github-pages 的內容。原專案根目錄不必放編譯後 index.html，dist 仍保持排除上傳；不會把原始 PNG、美術稽核與製作文件當成公開網站的一部分。

## 手動上傳現成網頁

已準備「母獅帝國_GitHubPages_上傳包.zip」。先解壓縮，裡面最外層就是 index.html；GitHub 不會自動解開 ZIP。

使用獨立的 gh-pages 分支（或專門放網頁的倉庫），讓最外層只包含上面這些發佈檔案，再將 Pages 設為 Deploy from a branch → gh-pages → /(root)。要放的是解壓後的所有內容，而不是 ZIP 檔或包住它們的外層資料夾。勿直接混入原專案全部檔案，否則原始圖片也會計入網站大小。

## 之後自行更新

雙擊「打包GitHub網頁.cmd」，或執行 npm run package:pages，會重新產生 github-pages 與 ZIP。網站採 WebP 品質 95、不縮放尺寸，原始 PNG/JPG 與原圖版 dist 不會被改寫；音樂原封保留。這是另行壓縮的網頁版本，不宣稱圖片位元組或像素與原圖完全相同。

網址在網域根目錄及 /lioness-empire/ 子目錄都已驗證，封面、遊戲 CG、音樂與舊存檔匯入可用。原本本機存檔與 GitHub 網站分屬不同網址，需要時用遊戲內匯出／匯入搬移。

GitHub Pages 發佈網站上限為 1 GB，本次發佈包約 312 MB。官方說明：
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

這次已完成本機目錄與發佈設定，尚未代你推送 GitHub 或更改線上 Pages 設定。
