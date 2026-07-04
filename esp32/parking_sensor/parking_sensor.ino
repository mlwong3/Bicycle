/*
 * 騎跡 Bike Trace — ESP32 超聲波單車泊位感應器
 * ------------------------------------------------
 * 硬件：ESP32-WROOM-32 DevKit V1（38-pin）+ 最多 4 個 HC-SR04 超聲波模組
 * 功能：每個 HC-SR04 對應一格泊位，量測車架上方是否有單車遮擋 → 判斷該格「有車/空位」，
 *       彙總後把「總車位」與「空位數」寫入 Firebase Realtime Database，供網站即時顯示，
 *       並定時寫入歷史紀錄，供網站端的簡單泊位需求預測模型使用。
 *
 * 函式庫需求（Arduino IDE → 工具 → 管理程式庫，搜尋安裝）：
 *   - Firebase ESP Client (by mobizt)      // RTDB 讀寫
 *
 * 接線（每組 HC-SR04，5V 供電，Echo 必須分壓至 3.3V！）：
 *   VCC  → ESP32 VIN (5V)
 *   GND  → ESP32 GND
 *   Trig → ESP32 GPIO（見下方 TRIG_PINS）
 *   Echo → 1kΩ 電阻 → ESP32 GPIO（見下方 ECHO_PINS）；同一接點再接 2kΩ 電阻 → GND
 *          （分壓後 5V Echo 訊號降為約 3.3V，避免燒壞 ESP32 輸入腳）
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ===================== 使用者設定 =====================
#define WIFI_SSID       "你的WiFi名稱"
#define WIFI_PASSWORD   "你的WiFi密碼"

// Firebase 專案設定（與網站 src/firebase.ts 使用同一個 bicycle-ee76c 專案）
#define API_KEY         "AIzaSyD-OWygHwIvIss5UV11IxzzaslmTWt1Uik"
#define DATABASE_URL    "https://bicycle-ee76c-default-rtdb.asia-southeast1.firebasedatabase.app"

// 此裝置的識別碼與顯示名稱（多部裝置請分別改成不同值，例如 shatin-rack-02）
#define DEVICE_ID       "shatin-rack-01"
#define DEVICE_NAME     "沙田公園單車棚 A 排"
// 此裝置的地理座標（供網站地圖上顯示標記；可用手機 GPS 讀取後填入）
#define DEVICE_LAT      22.379224
#define DEVICE_LNG      114.190135

// 感應器數量與腳位（最多 4 組；只用 2 組時把後面的 -1 保留即可）
const int NUM_SENSORS = 3;
const int TRIG_PINS[4] = {5, 17, 16, -1};
const int ECHO_PINS[4] = {18, 19, 21, -1};

// 車架距感應器多少公分內視為「有單車佔用」（依實際泊位深度調整，建議先實測）
const float OCCUPIED_THRESHOLD_CM = 15.0;

// 每隔多久上報一次即時狀態（毫秒）
const unsigned long REPORT_INTERVAL_MS = 5000;
// 每隔多久寫一筆歷史紀錄（供預測模型使用；太頻繁會超出免費額度，5 分鐘一次足夠）
const unsigned long HISTORY_INTERVAL_MS = 5UL * 60UL * 1000UL;

// ===================== 以下不需修改 =====================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long lastReport = 0;
unsigned long lastHistory = 0;

/** 量測單一 HC-SR04 的距離（公分）。逾時或無效回傳 -1。 */
float readDistanceCm(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms 逾時（約 5 米內）
  if (duration == 0) return -1;
  return duration * 0.0343 / 2.0; // 聲速 343 m/s，來回除以 2
}

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(TRIG_PINS[i], OUTPUT);
    pinMode(ECHO_PINS[i], INPUT);
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("連接 WiFi 中");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi 已連接：" + WiFi.localIP().toString());

  // 對時：ESP32 開機時沒有真實時間，若不同步，寫入 Firebase 的 updatedAt/歷史時間戳
  // 會是接近 0 的假時間，導致網站誤判裝置「離線」、預測模型的時段分桶全部失真。
  configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com"); // 香港 UTC+8，無夏令時
  Serial.print("同步網絡時間中");
  while (time(nullptr) < 100000) {
    delay(200);
    Serial.print(".");
  }
  Serial.println("\n時間已同步：" + String(time(nullptr)));

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  // 使用 Firebase 匿名登入（與網站的匿名 Auth 對應，Realtime Database 規則需允許 auth != null）
  auth.user.email = "";
  auth.user.password = "";
  Firebase.reconnectWiFi(true);
  Firebase.begin(&config, &auth);
  Firebase.signUp(&config, &auth, "", "");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    return;
  }

  unsigned long now = millis();
  if (now - lastReport < REPORT_INTERVAL_MS) return;
  lastReport = now;

  int total = 0;
  int free = 0;

  for (int i = 0; i < NUM_SENSORS; i++) {
    float d = readDistanceCm(TRIG_PINS[i], ECHO_PINS[i]);
    total++;
    bool occupied = (d > 0 && d < OCCUPIED_THRESHOLD_CM);
    if (!occupied) free++;
    Serial.printf("泊位 %d：距離 %.1f cm → %s\n", i + 1, d, occupied ? "有車" : "空");
  }

  // 寫入即時狀態節點 /parking/{DEVICE_ID}
  String base = String("parking/") + DEVICE_ID;
  FirebaseJson json;
  json.set("name", DEVICE_NAME);
  json.set("total", total);
  json.set("free", free);
  json.set("lat", DEVICE_LAT);
  json.set("lng", DEVICE_LNG);
  json.set("updatedAt", (double)((unsigned long long)time(nullptr) * 1000ULL));

  if (Firebase.RTDB.setJSON(&fbdo, base, &json)) {
    Serial.println("已上傳即時狀態");
  } else {
    Serial.println("上傳失敗：" + fbdo.errorReason());
  }

  // 定時追加一筆歷史紀錄，供網站端泊位需求預測使用
  if (now - lastHistory >= HISTORY_INTERVAL_MS) {
    lastHistory = now;
    String historyPath = String("parkingHistory/") + DEVICE_ID;
    FirebaseJson point;
    point.set("t", (double)time(nullptr)); // epoch 秒
    point.set("free", free);
    if (Firebase.RTDB.pushJSON(&fbdo, historyPath, &point)) {
      Serial.println("已寫入歷史紀錄");
    }
  }
}
