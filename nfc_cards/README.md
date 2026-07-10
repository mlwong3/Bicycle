# NFC 卡片登記表

10 張示範 NFC 卡片的資料檔（`QJ-NFC-001.json` ～ `QJ-NFC-010.json`），用於寫入實體 NFC 標籤。
所有卡片只儲存識別編號與 App 網址，**不含姓名、電話等個人資料**（私隱優先設計）。

| tagId | bikeId | frameNo | 寫入日期 | 測試狀態 | 貼在哪 | 備註 |
|---|---|---|---|---|---|---|
| QJ-NFC-001 | bike-demo-001 | HK-QJ-0001 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-002 | bike-demo-002 | HK-QJ-0002 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-003 | bike-demo-003 | HK-QJ-0003 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-004 | bike-demo-004 | HK-QJ-0004 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-005 | bike-demo-005 | HK-QJ-0005 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-006 | bike-demo-006 | HK-QJ-0006 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-007 | bike-demo-007 | HK-QJ-0007 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-008 | bike-demo-008 | HK-QJ-0008 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-009 | bike-demo-009 | HK-QJ-0009 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| QJ-NFC-010 | bike-demo-010 | HK-QJ-0010 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |

## 如何寫入 NFC 標籤（用手機）

1. Android 手機安裝 **NFC Tools** App（免費）。
2. 開 App → Write（寫入）→ Add a record（新增記錄）→ 選 **Data（資料）** 類型的
   **JSON** 或 **Text/Custom (MIME)**，MIME 類型填 `application/json`。
3. 把對應 `.json` 檔的內容整段貼進去。
4. 按「Write / OK」，把手機背面靠近空白 NFC 標籤，聽到提示即寫入成功。
5. 用 App 的 Read（讀取）功能靠近同一張標籤，確認讀回的內容正確。
6. 回來這張表更新「測試狀態」。

> 建議 NFC 標籤買 **NTAG213 / NTAG215**（13.56MHz、支援 NDEF），先買 10-20 張備用。
