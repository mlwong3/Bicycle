// 真實 Web NFC（NDEFReader）讀寫，含「不支援即退回模擬」策略。
//
// 限制：Web NFC 僅 Android 版 Chrome 89+ 支援，需 HTTPS、需使用者手勢觸發；
// iOS Safari 與桌面瀏覽器不支援。故呼叫端應在 NOT_SUPPORTED 時退回模擬流程。

declare global {
  interface Window {
    NDEFReader?: any;
  }
}

export interface BikeTagData {
  frameNo: string;
  ownerName: string;
  model: string;
}

/** 此瀏覽器是否支援 Web NFC */
export function isNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/** 把單車資料寫入貼在單車上的 NFC 標籤 */
export async function writeBikeTag(bike: BikeTagData): Promise<void> {
  if (!isNfcSupported()) {
    throw new Error('NOT_SUPPORTED'); // 交給呼叫端退回模擬流程
  }
  const ndef = new window.NDEFReader();
  await ndef.write({
    records: [
      { recordType: 'text', data: bike.frameNo },
      {
        recordType: 'mime',
        mediaType: 'application/json',
        data: new TextEncoder().encode(JSON.stringify(bike)),
      },
    ],
  });
}

/** 防盜驗證：感應車上的標籤，讀回車主資料（需在使用者點擊後呼叫） */
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
