// Mapbox 服務：單車路線規劃（Directions）與反向地理編碼（座標→地址）。
// Token 由建置環境 VITE_MAPBOX_TOKEN 注入（勿寫死在原始碼，避免被 GitHub 密鑰掃描攔截）。
// 未設定時，相關功能會優雅降級（導航退回直線、定位退回經緯度）。
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const isMapboxConfigured = MAPBOX_TOKEN.length > 0;

export interface LatLng {
  lat: number;
  lng: number;
}

/** 取得兩點間的真實單車路線（沿道路 / 單車徑）。失敗回傳 null，呼叫端可退回直線。 */
export async function getCyclingRoute(
  start: LatLng,
  end: LatLng,
  signal?: AbortSignal
): Promise<{ distanceKm: number; durationMin: number; geometry: any } | null> {
  if (!MAPBOX_TOKEN) return null;
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/cycling/${coords}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const route = (await res.json())?.routes?.[0];
    if (!route?.geometry) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry: route.geometry,
    };
  } catch {
    return null;
  }
}

/** 反向地理編碼：把座標轉成中文地址。失敗回傳 null。 */
export async function reverseGeocode(pos: LatLng, signal?: AbortSignal): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${pos.lng},${pos.lat}.json` +
    `?language=zh-Hant&limit=1&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const feature = (await res.json())?.features?.[0];
    return feature?.place_name ?? null;
  } catch {
    return null;
  }
}
