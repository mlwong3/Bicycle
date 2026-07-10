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
 * 寫入工具的實作方式），只要內容解碼後是符合形狀的 JSON 就接受。
 * 這樣才能相容第三方 App（如 NFC Tools）寫入的標籤，不必要求它們
 * 產生跟 writeBikeTag() 完全一致的底層記錄格式。
 */
function tryParseBikeTag(record: any): BikeTagData | null {
  try {
    const decoder = new TextDecoder(record.encoding || 'utf-8');
    const text = decoder.decode(record.data);
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.tagId === 'string' && typeof parsed.frameNo === 'string') {
      return parsed as BikeTagData;
    }
  } catch {
    // 不是有效 JSON 或形狀不符，略過此記錄，繼續看標籤內的下一筆
  }
  return null;
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
        '[NFC] 標籤內沒有符合格式的 JSON 記錄，實際記錄：',
        records.map((r: any) => ({ recordType: r.recordType, mediaType: r.mediaType, encoding: r.encoding }))
      );
      reject(
        new Error(
          `標籤無有效資料：讀到 ${records.length} 筆記錄，但沒有一筆是符合格式的單車識別 JSON（需含 tagId 與 frameNo 欄位），請確認標籤內容`
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
