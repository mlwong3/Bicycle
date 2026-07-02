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

## 三、Firebase 端設定

1. Firebase Console → 你的專案 `bicycle-ee76c` → **Realtime Database** → 建立資料庫
   （地區建議選 `asia-southeast1`，取得的網址填入 `src/firebase.ts` 的
   `VITE_FIREBASE_DATABASE_URL` 或直接改 `FALLBACK_DATABASE_URL`）。
2. 規則（Realtime Database → 規則）先用最簡單版本讓感應器與網站都能讀寫：

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

## 四、燒錄程式

1. Arduino IDE → 檔案 → 開啟 → `esp32/parking_sensor/parking_sensor.ino`
2. 工具 → 開發板 → 安裝並選擇 **ESP32 Dev Module**
3. 程式庫管理員安裝：**Firebase ESP Client**（作者 mobizt）
4. 修改檔案開頭的 `WIFI_SSID`、`WIFI_PASSWORD`、`DEVICE_ID`、`DEVICE_NAME`、
   `DEVICE_LAT`/`DEVICE_LNG`（每部裝置的 ID 要不同）
5. 上傳，開啟序列埠監控視窗（115200 baud）確認顯示「已上傳即時狀態」

## 五、資料結構

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

## 六、比賽展示建議

- 用紙箱／薄板做 2–3 格迷你泊位模型，貼上「泊位 1/2/3」標籤，放一個小單車模型示範遮擋。
- 現場把模型單車拿走/放回，網站地圖上的「即時空位」數字會同步變化——這是最有說服力的
  「軟硬結合」demo。
- 若比賽場地沒有穩定 WiFi，可用手機熱點；請提前在比賽場地測試 WiFi 連線。
