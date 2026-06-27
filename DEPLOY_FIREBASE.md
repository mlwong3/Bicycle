# Firebase Hosting 部署指引（GitHub Actions 自動部署）

> 目標：把編譯後的網站部署到 Google Cloud 旗下的 Firebase Hosting，
> 並設定每次 `git push` 自動 build + 部署。
>
> 我已幫你準備好設定檔，你只需要照下面步驟操作（建立專案、設密鑰這幾步必須你自己做）。

已備好的檔案：
- `firebase.json` — Hosting 設定（發佈 `dist` 資料夾）
- `.firebaserc` — 專案 ID（待你填入）
- `.github/workflows/firebase-deploy.yml` — 自動部署流程（待你填入專案 ID）

---

## 步驟 1：建立 Firebase 專案（瀏覽器，免費）

1. 開 https://console.firebase.google.com/
2. 點 **「新增專案 / Add project」**，取個名字（例如 `bicycle-hk`）。
3. 詢問 Google Analytics 時可以**關閉**（不需要）。
4. 建立完成後，記下你的 **專案 ID（Project ID）**——
   在「專案設定（齒輪圖示）→ 一般」可看到，通常長得像 `bicycle-hk` 或 `bicycle-hk-1a2b3`。

## 步驟 2：啟用 Hosting

1. 左側選單點 **Build → Hosting**。
2. 點 **「開始使用 / Get started」**，後面安裝 CLI 的步驟可以**直接跳過**（我們用 GitHub Actions，不在本機部署）。
   只要 Hosting 在 console 裡被初始化即可。

## 步驟 3：建立服務帳戶密鑰（給 GitHub 用）

1. Firebase Console → **專案設定（齒輪）→ 服務帳戶 / Service accounts**。
2. 點 **「產生新的私密金鑰 / Generate new private key」** → 確認 → 會下載一個 **JSON 檔**。
3. 這個 JSON 等一下要整個貼到 GitHub。**請妥善保管、不要 commit 進 repo。**

## 步驟 4：把密鑰存進 GitHub Secret

1. 到 GitHub repo：`https://github.com/mlwong3/Bicycle`
2. **Settings → Secrets and variables → Actions → New repository secret**
3. 填：
   - **Name**：`FIREBASE_SERVICE_ACCOUNT`
   - **Secret**：用文字編輯器打開步驟 3 下載的 JSON，**整個內容**複製貼上。
4. 按 **Add secret**。

## 步驟 5：填入你的專案 ID

把以下兩個檔案裡的 `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` 換成步驟 1 的專案 ID：

- `.firebaserc`
- `.github/workflows/firebase-deploy.yml`（`projectId:` 那行）

> 可以直接在 GitHub 網頁上編輯這兩個檔案，或在本機改好再 push。

## 步驟 6：推送，觸發自動部署

把改動 push 到 `main` 分支後：
1. 到 GitHub **Actions** 分頁，看 **Deploy to Firebase Hosting** 跑完（綠勾）。
2. 成功後，你的網站網址會是：
   ```
   https://你的專案ID.web.app
   ```
   （也可在 Firebase Console → Hosting 看到網址。）

---

## 常見問題

- **Q：這會影響我原本的 GitHub Pages 嗎？**
  不會。GitHub Pages（`deploy.yml`）和 Firebase（`firebase-deploy.yml`）是兩個獨立目標，
  兩邊都會各自部署，網站會同時上線在兩個網址。

- **Q：Actions 失敗顯示權限錯誤？**
  多半是 `FIREBASE_SERVICE_ACCOUNT` 密鑰沒貼對（要貼整個 JSON），或 `projectId` 沒填對。

- **Q：主分支不是 main？**
  把 `firebase-deploy.yml` 裡的 `branches: [main]` 改成你的分支名（例如 `master`）。

- **Q：之後想用本機手動部署？**
  安裝一次 `npm install -g firebase-tools`，`firebase login`，
  然後 `npm run build && firebase deploy`（設定檔已備好，不必再 init）。

---

## 你需要做的，濃縮成一句

建專案 → 啟用 Hosting → 下載服務帳戶 JSON → 貼成 GitHub Secret `FIREBASE_SERVICE_ACCOUNT`
→ 把兩個檔的 `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` 換成專案 ID → push。
