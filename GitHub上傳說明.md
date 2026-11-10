# GitHub 根目錄發佈

已依要求把真正的遊戲首頁 index.html 放在專案根目錄。可直接使用 GitHub Pages 的 main 分支／根目錄發佈，不必開啟自訂 Actions。

## 這次只需推送這些更新

```
專案根目錄/
├─ index.html          首頁
├─ _config.yml         排除原始大圖與開發檔案
└─ github-pages/       必須一起上傳的完整遊戲資料
   ├─ index.html
   ├─ assets/
   └─ content/
```

在 GitHub Desktop 將這次修改及新增檔案 Commit，再按 Push origin。github-pages 已取消排除，應能看到它裡面的新增檔案。

GitHub 倉庫 → Settings → Pages → Source：Deploy from a branch → Branch：main → Folder：/(root) → Save。如果已經選好 main／根目錄，保持原設定即可。等 GitHub 的 Pages build and deployment 完成後開啟遊戲。

## ZIP 也已改成同一種根目錄結構

「母獅帝國_GitHubPages_上傳包.zip」解壓到目前專案根目錄即可，會放入 index.html、_config.yml、github-pages；不會覆蓋原始 assets、content 或劇本。此電腦已經完成整理，不必再解壓一次。

首頁利用 base 路徑讀取 github-pages 內的遊戲程式、圖片與劇情；不是轉址或提示頁。index.html、_config.yml 與 github-pages 必須一起推送。根目錄不要放 .nojekyll，否則 GitHub 會跳過排除大圖的設定。github-pages 內原有的 .nojekyll 不影響根目錄設定。

## 未來更新

雙擊「打包GitHub網頁.cmd」，或執行 npm run package:pages，會重建網頁版、根目錄首頁、發佈設定與 ZIP。網頁版大小會隨新章節增加，可在 docs/github-pages-package-report.json 查看。圖片為品質 95／原尺寸 WebP，原 PNG/JPG 與原圖 dist 保留，音樂位元組不變。

舊的 .github/workflows/pages.yml 保留為手動執行選項，已取消 push 自動觸發，避免與根目錄的 Pages 自動發佈重複。現在建議使用上述 main／根目錄方式。

已在桌面、Android、iPhone 模擬確認根目錄首頁與 /lioness-empire/ 子路徑正常，封面、CG、音樂及舊存檔匯入皆可使用。尚未代你推送 GitHub 或更改線上設定。
