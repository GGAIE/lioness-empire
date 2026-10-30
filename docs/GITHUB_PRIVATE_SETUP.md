# 私有 GitHub 儲存庫準備紀錄

檢查日期：2026-10-30（台灣）。十二章完成後才考慮公開；本次不啟用 GitHub Pages。

## 正確專案位置與現況

GitHub Desktop 應加入 `C:\Users\45P\Downloads\母獅帝國新\lioness-empire`。
此目錄已有 Git，分支 main；既有初始提交為 4dc7b1eadbe0c11876c2bfe1b0ec205580be7628，已完整收錄目前遊戲進度，因此不重新初始化或重寫歷史。本次僅追加忽略規則與本說明並建立後續本地提交。

既有 origin 為 https://github.com/GGAIE/lioness-empire.git，本機還有 origin/main 紀錄。未連線查詢遠端、未變更網址、未 Push，無法由這些本機資訊確認遠端現在存在與否、內容或可見性。

## 檔案與安全檢查

- 原始追蹤檔案 241 個，共約 198.69 MiB；HTML、TypeScript/JavaScript、CSS、核心、測試、JSON 劇本與原文、CG、音效、套件鎖定檔均保留。
- 最大原始 CG 約 3.13 MiB；沒有追蹤檔案超過 50 MiB 或 100 MiB，目前不需要為上傳限制導入 Git LFS。
- GitHub 一般 Git 檔案超過 50 MiB 會警告，超過 100 MiB 會阻擋；網頁上傳單檔限制 25 MiB。未來新增大素材應先檢查，再決定使用 Git LFS，避免先提交超限檔案。
- 對原始追蹤文字檔檢查常見 GitHub／AWS／API token、私鑰及密碼賦值模式，未發現命中；此為模式掃描，並非所有敏感資訊的保證。
- node_modules、dist、測試報告不追蹤。public/content 與 public/assets 是 scripts/content.ts 從已追蹤 content、assets 複製產生，沿用原排除設定，保留來源全部素材，不依檔案大小任意忽略 CG。
- IndexedDB 存檔在瀏覽器中，Git 不包含它；保留 saves.ts、SaveSlots.tsx 及測試。排除 lioness-save-*.json 玩家匯出檔；重要個人存檔請另行備份。
- 外層原始劇本文件、舊內核、Unity、美術參考等都仍留在原位，但不在此 HTML Git 儲存庫範圍。既有 HTML 遊戲執行所需來源已在本儲存庫。外層 Unity Library 的 105.15 MiB 快取不會上傳。
- 本次不執行會複製或覆寫產物的 build／content:validate，不重新產生遊戲。

## GitHub Desktop 操作

1. 開啟已安裝的 GitHub Desktop，選 File → Add Local Repository，加入上方 lioness-empire 目錄；不要選外層交接資料夾，也不要使用 Create New Repository。
2. 確認分支 main、History 有既有 Initial commit 與本次準備提交、Changes 為空。
3. 此專案已有 origin，Desktop 可能顯示 Fetch origin／Push origin，而非 Publish repository。先登入 GitHub 並開啟既有儲存庫頁面，確認擁有者及 Private 標記；無法開啟不代表儲存庫一定不存在。如果已經是正確私有庫，就不必重新 Publish；本次請停在這裡，不按 Push。
4. 如果確認要另外建立全新私有庫：可在本目錄終端機執行 `git remote remove origin`，這只移除本機遠端連結，不刪遊戲、提交或 GitHub 儲存庫。這是由你日後選擇的操作，本次未執行；原網址已記錄於上方。
5. 在沒有 origin 的情況，於 Desktop 按 Publish repository，輸入尚未使用的名稱、確認自己的帳號／組織，**保持勾選 Keep this code private**。取消勾選會公開，請勿取消。
6. 只有你準備好實際上傳時，才按對話框最後的 Publish repository；此按鈕會建立遠端並上傳提交。完成後在 GitHub 頁面確認 Private。
7. 不設定 GitHub Pages、不切換 Public。十二章完成後再另外決定公開流程。

官方說明：
- https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
