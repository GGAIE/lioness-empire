@echo off
chcp 65001 >nul
cd /d "%~dp0"
call npm run package:pages
if errorlevel 1 (
  echo 網頁打包失敗，請查看上方訊息。
  pause
  exit /b 1
)
echo 完成：請將 github-pages 資料夾內的所有檔案上傳，讓 index.html 位於網站最外層。
pause
