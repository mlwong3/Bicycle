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

/** 防盜驗證：感應車上的標籤，讀回識別資料（需在使用者點擊後呼叫） */
export async function readBikeTag(signal?: AbortSignal): Promise<BikeTagData> {
  if (!isNfcSupported()) {
    throw new Error('NOT_SUPPORTED');
  }
  const ndef = new window.NDEFReader();
  await ndef.scan({ signal });
  return new Promise<BikeTagData>((resolve, reject) => {
    ndef.onreading = (event: any) => {
      const dec = new TextDecoder();
      for (const r of event.message.records) {
        if (r.mediaType === 'application/json') {
          try {
            resolve(JSON.parse(dec.decode(r.data)));
            return;
          } catch {
            reject(new Error('標籤資料解析失敗'));
            return;
          }
        }
      }
      reject(new Error('標籤無有效資料'));
    };
    ndef.onreadingerror = () => reject(new Error('讀取失敗'));
  });
}
