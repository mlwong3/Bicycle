# AI 圖片分析獨立試運行規格

> 用途：只作一次可行性驗證；不接入前端、不寫入 Firestore、不改變任何案件狀態。

## 輸入要求

- 一張已獲授權使用的單車相片；避免包括可辨識的路人、車牌或私人住址。
- 以環境變數提供 Gemini API 金鑰；執行時不可把金鑰寫入程式碼、版本控制或日誌。

## 指令內容

請分析這張相片中是否存在單車，以及可見的視覺訊號。你只能評估「疑似棄置風險」，不可推斷停泊時長、不可判定物主身分、不可建議直接清理或充公。若相片不足以判斷，應降低信心度並說明需要人員現場覆核。

請只輸出以下 JSON：

```json
{
  "isBicycle": true,
  "indicators": {
    "rust": 0,
    "tire": 0,
    "dust": 0,
    "attachment": 0,
    "missing": 0,
    "lock": 0
  },
  "riskScore": 0,
  "riskLevel": "low",
  "confidence": "low",
  "reasons": ["只描述相片中可見的事實"],
  "suggestedAction": "建議人員現場覆核"
}
```

欄位限制：`indicators` 每項為 0–3；`riskScore` 為 0–100；`riskLevel` 只可為 `low`、`medium`、`high`、`very_high`；`confidence` 只可為 `low`、`medium`、`high`。

## 判讀準則

- 只把輸出視為「現場覆核優先度」的輔助訊號。
- 若模型把新車、正常停泊或畫面不足的個案評成高風險，則不建議納入正式方案。
- 即使結果合理，正式系統也必須由後端代理呼叫並保留人員覆核。
