// 真實 Web NFC（NDEFReader）讀寫，含「不支援即退回模擬」策略。
//
// 限制：Web NFC 僅 Android 版 Chrome 89+ 支援，需 HTTPS、需使用者手勢觸發；
// iOS Safari 與桌面瀏覽器不支援。故呼叫端應在 NOT_SUPPORTED 時退回模擬流程。
//
// 標籤資料採「私隱優先」設計：只寫入識別編號與 App 網址，
// 不寫入姓名、電話等個人資料（車主等資料只留在帳戶 / 雲端，以 bikeId 對應）。

declare global {
  interface Window {
    NDEFReader?: any;
  }
}

export interface BikeTagData {
  /** NFC 標籤編號（例如 QJ-NFC-001） */
  tagId: string;
  /** 單車識別碼（例如 bike-demo-001），對應帳戶 / 雲端的單車記錄 */
  bikeId: string;
  /** 車架編號（例如 HK-QJ-0001） */
  frameNo: string;
  /** App 網址，讓一般手機感應標籤即可開啟 App */
  appUrl: string;
}

/** 此瀏覽器是否支援 Web NFC */
export function isNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export type NfcErrorReason = 'not-supported' | 'permission-denied' | 'aborted' | 'unknown';

/**
 * 把 scan()/write() 拋出的錯誤分類，供呼叫端顯示對應的使用者提示。
 * Web NFC 本身沒有獨立的「請求權限」API——瀏覽器會在第一次呼叫 scan()/write()
 * 時自動彈出「允許使用 NFC？」的系統權限提示（需在使用者手勢內呼叫）；
 * 使用者若當時按「拒絕」，Chrome 會記住此選擇，之後同一網站呼叫會直接
 * 拋出 NotAllowedError 且不再彈窗，需到 Chrome 網站設定手動改回允許。
 */
export function classifyNfcError(err: unknown): NfcErrorReason {
  if (err instanceof Error && err.message === 'NOT_SUPPORTED') return 'not-supported';
  const name = (err as any)?.name;
  if (name === 'NotAllowedError') return 'permission-denied';
  if (name === 'AbortError') return 'aborted';
  if (name === 'NotSupportedError') return 'not-supported';
  return 'unknown';
}

/** 把單車識別資料寫入貼在單車上的 NFC 標籤（私隱優先：不含姓名等個資） */
export async function writeBikeTag(tag: BikeTagData): Promise<void> {
  if (!isNfcSupported()) {
    throw new Error('NOT_SUPPORTED'); // 交給呼叫端退回模擬流程
  }
  const ndef = new window.NDEFReader();
  await ndef.write({
    records: [
      // url 記錄：一般手機感應標籤（未安裝 App）也能直接開啟 App 網址
      { recordType: 'url', data: tag.appUrl },
      // json 記錄：App 感應時讀回完整識別資料
      {
        recordType: 'mime',
        mediaType: 'application/json',
        data: new TextEncoder().encode(JSON.stringify(tag)),
      },
    ],
  });
}

/**
 * 嘗試把單一 NDEF 記錄解析成 BikeTagData：不論它被寫入時宣告的
 * recordType/mediaType 是什麼（'mime'/'text'/'unknown' 等，取決於
 * 寫入工具的實作方式），只要能解碼出文字內容就接受——不強制要求
 * 內容一定是結構化 JSON。
 *
 * 讀取策略（由嚴謹到寬鬆）：
 * 1. 先嘗試 JSON.parse，若成功且含 tagId/frameNo 欄位 → 直接回傳完整資料。
 * 2. JSON.parse 失敗（例如純文字標籤、NFC Tools 寫入格式跟預期不同）
 *    → 退回「純文字」模式：把整段解碼出來的文字當作標籤編號本身，
 *    tagId/frameNo 都填這段文字，bikeId/appUrl 留空，一樣視為有效讀取，
 *    不再因為格式不是 JSON 而直接判定讀取失敗。
 */
function tryParseBikeTag(record: any): BikeTagData | null {
  let text: string;
  try {
    const decoder = new TextDecoder(record.encoding || 'utf-8');
    text = decoder.decode(record.data);
  } catch {
    return null; // 這筆記錄連文字都解不出來，換下一筆
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.tagId === 'string' && typeof parsed.frameNo === 'string') {
      return parsed as BikeTagData;
    }
  } catch {
    // 不是有效 JSON，繼續往下當純文字處理
  }

  const trimmed = text.trim();
  if (!trimmed) return null; // 空白內容，不算有效讀取
  return { tagId: trimmed, bikeId: '', frameNo: trimmed, appUrl: '' };
}

/** 防盜驗證：感應車上的標籤，讀回識別資料（需在使用者點擊後呼叫） */
export async function readBikeTag(signal?: AbortSignal): Promise<BikeTagData> {
  if (!isNfcSupported()) {
    throw new Error('NOT_SUPPORTED');
  }
  const ndef = new window.NDEFReader();
  return new Promise<BikeTagData>((resolve, reject) => {
    // 務必在呼叫 scan() 之前先掛上事件監聽：若呼叫時手機已貼著標籤，
    // reading 事件可能在 scan() 的 promise resolve 之前就先觸發，
    // 監聽器晚掛上就會直接錯過該次讀取（曾是舊版程式碼的 bug）。
    ndef.onreading = (event: any) => {
      const records = event.message.records;
      for (const r of records) {
        const parsed = tryParseBikeTag(r);
        if (parsed) {
          resolve(parsed);
          return;
        }
      }
      console.warn(
        '[NFC] 標籤內沒有可解碼出內容的記錄，實際記錄：',
        records.map((r: any) => ({ recordType: r.recordType, mediaType: r.mediaType, encoding: r.encoding }))
      );
      reject(
        new Error(
          `標籤無有效資料：讀到 ${records.length} 筆記錄，但都是空白或無法解碼成文字，請確認標籤內容`
        )
      );
    };
    ndef.onreadingerror = () => {
      console.error('[NFC] onreadingerror：偵測到標籤但讀取/解析失敗');
      reject(new Error('讀取失敗：偵測到標籤但無法解析內容，可能是移開太快、標籤資料不完整或已損壞'));
    };
    ndef.scan({ signal }).catch(reject);
  });
}
