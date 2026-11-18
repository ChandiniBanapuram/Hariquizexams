@echo off
set PATH=C:\Program Files\Git\cmd;%PATH%
echo ===================================================
echo   Deploying Backend to Hugging Face Space
echo ===================================================

:: 1. Define temporary folder name
set TEMP_DIR=hf_deploy_temp

:: 2. Remove existing temp folder if present
if exist %TEMP_DIR% (
    echo Cleaning old temporary files...
    rmdir /s /q %TEMP_DIR%
)

:: 3. Create fresh temp folder structure
echo Creating clean deployment structure...
mkdir %TEMP_DIR%
mkdir %TEMP_DIR%\backend

:: 4. Copy required files (selective to avoid node_modules and ml-venv)
echo Copying backend files...
copy backend\* %TEMP_DIR%\backend\ >nul
mkdir %TEMP_DIR%\backend\config && xcopy /s /e /y backend\config %TEMP_DIR%\backend\config\ >nul
mkdir %TEMP_DIR%\backend\middleware && xcopy /s /e /y backend\middleware %TEMP_DIR%\backend\middleware\ >nul
mkdir %TEMP_DIR%\backend\routes && xcopy /s /e /y backend\routes %TEMP_DIR%\backend\routes\ >nul
mkdir %TEMP_DIR%\backend\services && xcopy /s /e /y backend\services %TEMP_DIR%\backend\services\ >nul
mkdir %TEMP_DIR%\backend\utils && xcopy /s /e /y backend\utils %TEMP_DIR%\backend\utils\ >nul
if exist backend\mysql (mkdir %TEMP_DIR%\backend\mysql && xcopy /s /e /y backend\mysql %TEMP_DIR%\backend\mysql\ >nul)
if exist backend\scripts (mkdir %TEMP_DIR%\backend\scripts && xcopy /s /e /y backend\scripts %TEMP_DIR%\backend\scripts\ >nul)
copy Dockerfile %TEMP_DIR% >nul
copy .gitignore %TEMP_DIR% >nul

:: 5. Create README.md with Hugging Face Space metadata
echo Creating README.md...
(
echo ---
echo title: Examination Backend
echo emoji: 📝
echo colorFrom: blue
echo colorTo: indigo
echo sdk: docker
echo pinned: false
echo ---
) > %TEMP_DIR%\README.md

:: 6. Initialize git and commit files in temp directory
cd %TEMP_DIR%
echo Initializing local deployment repository...
git init -b main >nul
git config user.name "sairohit45"
git config user.email "sairohit4531@gmail.com"
git add .
git commit -m "Deploy latest changes" >nul

:: 7. Add Hugging Face remote and push
echo ===================================================
echo   AUTHENTICATION PROMPT WILL APPEAR NEXT:
echo   Please sign in via browser when prompted.
echo ===================================================
git remote add space https://huggingface.co/spaces/sairohit45/examination-backend
git push -f space main

:: 8. Clean up
cd ..
echo Cleaning up temporary deployment files...
rmdir /s /q %TEMP_DIR%

echo Done! Check your Hugging Face Space page for build progress.
pause
