// Firebase Realtime Database：接收 ESP32 超聲波感應器上傳的即時泊位數據。
// 資料結構（由 esp32/parking_sensor.ino 寫入）：
//   /parking/{deviceId} = { name, total, free, lat?, lng?, updatedAt }
//   /parkingHistory/{deviceId}/{pushId} = { t: epoch 秒, free }   ← 供泊位需求預測（predict.ts）
// 未建立 RTDB 或斷線時所有函式優雅降級（回傳空資料 / no-op），不影響 App 其他功能。
import { getFirebaseServices, realtimeDatabaseUrl } from './firebase';

export interface LiveParkingDevice {
  /** RTDB 節點鍵（裝置 ID，例如 shatin-rack-01） */
  id: string;
  /** 顯示名稱（例如「沙田第一城單車棚」） */
  name: string;
  /** 感應器覆蓋的泊位總數 */
  total: number;
  /** 目前空位數 */
  free: number;
  /** 裝置最後上報時間（epoch 毫秒） */
  updatedAt: number;
  /** 選填：裝置座標，供地圖飛至 */
  lat?: number;
  lng?: number;
}

export interface ParkingHistoryPoint {
  /** epoch 秒 */
  t: number;
  free: number;
}

/** 裝置超過此毫秒數未上報即視為離線（UI 標灰） */
export const DEVICE_STALE_MS = 3 * 60 * 1000;

export function isRealtimeConfigured(): boolean {
  return realtimeDatabaseUrl.length > 0;
}

async function getDb() {
  if (!isRealtimeConfigured()) return null;
  const services = await getFirebaseServices();
  if (!services) return null;
  try {
    const { getDatabase } = await import('firebase/database');
    return getDatabase(services.app, realtimeDatabaseUrl);
  } catch {
    return null;
  }
}

/**
 * 訂閱所有 IoT 泊位裝置的即時狀態。回傳取消訂閱函式。
 * RTDB 未建立 / 規則拒絕時，callback 收到空陣列且不再打擾。
 */
export function subscribeLiveParking(
  callback: (devices: LiveParkingDevice[]) => void
): () => void {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  (async () => {
    const db = await getDb();
    if (!db || cancelled) return;
    try {
      const { ref, onValue, off } = await import('firebase/database');
      const node = ref(db, 'parking');
      const handler = onValue(
        node,
        (snap) => {
          const val = snap.val() ?? {};
          const devices: LiveParkingDevice[] = Object.entries(val)
            .map(([id, d]: [string, any]) => ({
              id,
              name: String(d?.name ?? id),
              total: Number(d?.total ?? 0),
              free: Number(d?.free ?? 0),
              updatedAt: Number(d?.updatedAt ?? 0),
              lat: typeof d?.lat === 'number' ? d.lat : undefined,
              lng: typeof d?.lng === 'number' ? d.lng : undefined,
            }))
            .filter((d) => d.total > 0);
          if (!cancelled) callback(devices);
        },
        () => {
          if (!cancelled) callback([]);
        }
      );
      unsubscribe = () => off(node, 'value', handler);
    } catch {
      if (!cancelled) callback([]);
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/** 讀取某裝置最近 N 筆歷史空位紀錄（預測用），失敗回傳 []。 */
export async function fetchParkingHistory(
  deviceId: string,
  limit = 500
): Promise<ParkingHistoryPoint[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { ref, query, limitToLast, get } = await import('firebase/database');
    const snap = await get(query(ref(db, `parkingHistory/${deviceId}`), limitToLast(limit)));
    const val = snap.val() ?? {};
    return Object.values(val)
      .map((p: any) => ({ t: Number(p?.t ?? 0), free: Number(p?.free ?? 0) }))
      .filter((p) => p.t > 0)
      .sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}
