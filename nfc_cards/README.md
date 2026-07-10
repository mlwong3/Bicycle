# NFC 卡片登記表

10 張示範 NFC 卡片的資料檔（`STFA-BIKE-001.json` ～ `STFA-BIKE-010.json`），用於寫入實體 NFC 標籤。
所有卡片只儲存識別編號與 App 網址，**不含姓名、電話等個人資料**（私隱優先設計）。
格式與 [`src/nfc.ts`](../src/nfc.ts) 的 `BikeTagData` 完全一致（`tagId`/`bikeId`/`frameNo`/`appUrl`），
App「感應標籤・驗證單車身分」功能可直接讀取這些卡片。

| tagId | bikeId | frameNo | 寫入日期 | 測試狀態 | 貼在哪 | 備註 |
|---|---|---|---|---|---|---|
| STFA-BIKE-001 | bike-a1b2c3 | HK-MD24-0158 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-002 | bike-d4e5f6 | HK-GT23-0392 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-003 | bike-g7h8i9 | HK-TK22-0741 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-004 | bike-j1k2l3 | HK-SP24-0026 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-005 | bike-m4n5o6 | HK-BT23-0913 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-006 | bike-p7q8r9 | HK-MD24-0159 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-007 | bike-s1t2u3 | HK-GT22-0208 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-008 | bike-v4w5x6 | HK-TK24-0067 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-009 | bike-y7z8a9 | HK-SP23-0450 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |
| STFA-BIKE-010 | bike-b1c2d3 | HK-BT24-0011 |  | ☐未寫 ☐已寫 ☐已驗證 |  |  |

## 如何寫入 NFC 標籤（用手機）

1. Android 手機安裝 **NFC Tools** App（免費）。
2. 開 App → Write（寫入）→ Add a record（新增記錄）→ 選 **Data（資料）** 類型的
   **JSON** 或 **Text/Custom (MIME)**，MIME 類型填 `application/json`。
3. 把對應 `.json` 檔的內容整段貼進去。
4. 按「Write / OK」，把手機背面靠近空白 NFC 標籤，聽到提示即寫入成功。
5. 用 App 的 Read（讀取）功能靠近同一張標籤，確認讀回的內容正確。
6. 回來這張表更新「測試狀態」。

> 建議 NFC 標籤買 **NTAG213 / NTAG215**（13.56MHz、支援 NDEF），先買 10-20 張備用。
