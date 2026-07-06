# ESP32 即時單車泊位感應器

用 ESP32 + 超聲波感應器量測每個泊位是否有單車佔用，即時上傳到 Firebase Realtime
Database，網站地圖會顯示「即時空位 X/Y」，並用簡單統計模型預測 1 小時後的空位數。

## 一、購買清單

| 項目 | 建議規格 | 參考關鍵字 |
|---|---|---|
| 開發板 | **ESP32-WROOM-32 DevKit V1**（38-pin，Type-C 接口） | 「ESP32 開發板 WROOM-32 38pin」 |
| 感應器 | HC-SR04 超聲波模組 ×（泊位數量，最多 4 個） | 「HC-SR04 超聲波感應器」 |
| 電阻 | 1kΩ、2kΩ 各數個（分壓用） | 電子零件套裝 |
| 麵包板 + 杜邦線 | 麵包板 1 塊、公對公/公對母杜邦線一排 | — |

**避免**：ESP8266（GPIO 少、5V 處理麻煩）；裸 ESP32 模組（無 USB，需另接燒錄器）。

## 二、接線（每組 HC-SR04）

HC-SR04 是 5V 元件，Echo 輸出電壓 5V，但 ESP32 的 GPIO 只能承受 3.3V，**Echo 一定要分壓**：

```
HC-SR04          ESP32 DevKit V1
─────────────────────────────────
 VCC  ─────────  VIN (5V)
 GND  ─────────  GND
 Trig ─────────  GPIO（見下表）
 Echo ──┬──[1kΩ]──  GPIO（見下表）
        │
       [2kΩ]
        │
       GND
```

分壓後：5V × 2/(1+2) ≈ 3.3V，安全接入 ESP32。Trig 可直接接（ESP32 輸出 3.3V 已足夠觸發）。

| 泊位編號 | Trig 接 | Echo 接（經分壓） |
|---|---|---|
| 1 | GPIO 5  | GPIO 18 |
| 2 | GPIO 17 | GPIO 19 |
| 3 | GPIO 16 | GPIO 21 |
| 4（選用） | 自訂 | 自訂（記得改程式碼 `TRIG_PINS`/`ECHO_PINS`） |

所有模組的 GND 需與 ESP32 共地。

## 三、Firebase 端設定（詳細逐步）

### 3.1 建立 Realtime Database

1. 開啟 [console.firebase.google.com](https://console.firebase.google.com/)，選擇專案 `bicycle-ee76c`（與網站 Hosting、Firestore 同一個專案）。
2. 左側選單 **Build → Realtime Database** → 按「建立資料庫」。
3. 地區選 **asia-southeast1 (Singapore)**（離香港最近，延遲最低）。
4. 安全規則先選「**以鎖定模式啟動**」（預設拒絕所有讀寫，稍後手動貼規則）。
5. 建立完成後，畫面頂部會顯示資料庫網址，核對是否等於程式碼裡已經寫死的預設值：
   ```
   https://bicycle-ee76c-default-rtdb.asia-southeast1.firebasedatabase.app
   ```
   （對應 [`src/firebase.ts`](../src/firebase.ts) 的 `FALLBACK_DATABASE_URL`）。
   - **若網址一致**：不用改任何程式碼，直接進行下一步。
   - **若網址不一致**（例如地區代碼不同）：需要同步更新 3 個地方，缺一個都會導致「網站/韌體各自連到不同資料庫」：
     1. `src/firebase.ts` 的 `FALLBACK_DATABASE_URL`
     2. 本機開發用的 `.env.local`（新增一行 `VITE_FIREBASE_DATABASE_URL=<你的網址>`）
     3. GitHub repo 的 Secret `VITE_FIREBASE_DATABASE_URL`（Settings → Secrets and variables → Actions，正式站部署要用）
     4. `esp32/parking_sensor/parking_sensor.ino` 的 `DATABASE_URL` 巨集

### 3.2 設定安全規則

到 Realtime Database → **規則** 分頁，整段貼上並按「發布」：

```json
{
  "rules": {
    "parking": {
      ".read": true,
      ".write": "auth != null"
    },
    "parkingHistory": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

說明：泊位狀態是公開資訊，任何人都可以讀取（`.read: true`）；只有已登入（含匿名登入）
的用戶端可以寫入，避免任意訪客竄改數據。

### 3.3 啟用匿名登入

左側選單 **Build → Authentication → Sign-in method**，確認 **Anonymous（匿名）** 已啟用
（若未啟用需按「新增登入提供者」開啟）。韌體用 `Firebase.signUp(&config, &auth, "", "")`
觸發匿名登入以取得寫入權限——**這一步沒做，韌體會連線成功但寫入被規則拒絕**。

### 3.4 不用硬件也能先驗證規則設定對不對

在電腦終端機（或瀏覽器網址列）打 REST 端點：

```bash
curl "https://bicycle-ee76c-default-rtdb.asia-southeast1.firebasedatabase.app/parking.json"
```

- 回傳 `null` → 規則設定正確（代表允許讀取，只是還沒有資料）。
- 回傳 `{"error":"Permission denied"}` → 規則沒發布成功，回頭檢查 3.2。

## 四、燒錄程式

1. Arduino IDE → 偏好設定 → 額外開發板管理員網址，加入
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`（若之前沒裝過 ESP32 核心）。
2. 工具 → 開發板 → 開發板管理員，搜尋安裝 **esp32 by Espressif Systems**。
3. 工具 → 開發板，選擇你的板子（一般 ESP32 DevKit V1 選 **ESP32 Dev Module**）。
4. 程式庫管理員（工具 → 管理程式庫）安裝 Firebase 函式庫。**注意**：這個函式庫在 Library
   Manager 裡的正式登記名稱是「**Firebase Arduino Client Library for ESP8266 and ESP32**」
   （作者 **Mobizt**），不是字面上的「Firebase ESP Client」——搜尋欄只打 `Firebase` 就好，
   不要打整串名字，否則常常搜不到。
   - 若搜尋還是找不到：到
     [github.com/mobizt/Firebase-ESP-Client/releases/latest](https://github.com/mobizt/Firebase-ESP-Client/releases/latest)
     下載 Source code (zip)，改用「草稿碼 → 匯入程式庫 → 加入 .ZIP 程式庫」手動安裝。
5. 開啟 `esp32/parking_sensor/parking_sensor.ino`，修改檔案開頭的 `WIFI_SSID`、
   `WIFI_PASSWORD`（**必須是 2.4GHz 網路，ESP32 不支援 5GHz WiFi**）、`DEVICE_ID`、
   `DEVICE_NAME`、`DEVICE_LAT`/`DEVICE_LNG`（每部裝置的 ID 要不同）。
6. 工具 → 連接埠，選擇 ESP32 接上電腦後出現的序列埠。
7. 按上傳。完成後開啟序列埠監控視窗（右上角放大鏡圖示，設定 115200 baud），
   應依序看到：
   ```
   連接 WiFi 中....
   WiFi 已連接：192.168.x.x
   同步網絡時間中....
   時間已同步：1735...
   已上傳即時狀態
   ```

### 4.1 常見錯誤對照表

| 序列埠訊息 / 現象 | 原因 | 解法 |
|---|---|---|
| WiFi 一直連不上（持續印 `.`） | 接了 5GHz 網路，或 SSID/密碼打錯 | 改連 2.4GHz 頻段的 WiFi；用手機熱點務必開「2.4GHz」選項 |
| 卡在「同步網絡時間中」不動 | 網路能連但無法連到 NTP 伺服器（部分公司/學校網路封鎖 NTP） | 換手機熱點測試；或改用 `"time.windows.com"` 等備援 NTP |
| `token error` 或 signUp 沒有印出成功 | Firebase 匿名登入未啟用 | 回到 3.3 啟用 Anonymous |
| `上傳失敗：PERMISSION_DENIED` | 規則未發布或路徑打錯 | 回到 3.2 重新貼規則並按發布 |
| 距離讀數一直是 `-1.0` | Echo 接錯腳、或分壓電阻接反、或該腳被其他功能占用 | 核對第二節接線圖，確認 Trig/Echo 沒接反 |
| 網站地圖右上角「IoT 感應器」徽章一直不出現 | RTDB 網址不一致（見 3.1）或韌體還沒上傳成功 | 核對 3 個網址是否一致；檢查序列埠有無錯誤 |
| 徽章出現但顯示裝置離線（灰色） | 韌體版本較舊、沒有 NTP 對時（本次已修） | 確認 `.ino` 已包含 `configTime()` 那段程式碼並重新上傳 |

## 五、網站端確認

打開網站的地圖頁：
- 右上角應出現「**3 個 IoT 感應器即時上線**」橙色徽章（`liveDevices.length > 0` 才會顯示）。
- 地圖上應出現一個新的橙色晶片圖示標記（裝置座標，即 `.ino` 裡的 `DEVICE_LAT`/`DEVICE_LNG`）。
- 點該標記，彈窗應顯示「即時空位：X / 3」，累積約 1 小時歷史數據後會多顯示「預測 1 小時後：約 X 個空位」。

## 六、資料結構

```
/parking/{deviceId}
  ├─ name: "沙田公園單車棚 A 排"
  ├─ total: 3
  ├─ free: 2
  ├─ lat, lng
  └─ updatedAt: epoch 毫秒

/parkingHistory/{deviceId}/{自動 ID}
  ├─ t: epoch 秒
  └─ free: 2
```

網站端 `src/realtime.ts` 訂閱 `/parking` 顯示即時狀態；`src/predict.ts` 讀取
`/parkingHistory/{deviceId}` 做泊位需求預測（見 `README.md` 同目錄下的預測方法說明）。

## 七、比賽展示建議

- 用紙箱／薄板做 2–3 格迷你泊位模型，貼上「泊位 1/2/3」標籤，放一個小單車模型示範遮擋。
- 現場把模型單車拿走/放回，網站地圖上的「即時空位」數字會同步變化——這是最有說服力的
  「軟硬結合」demo。
- 若比賽場地沒有穩定 WiFi，可用手機熱點；請提前在比賽場地測試 WiFi 連線。
