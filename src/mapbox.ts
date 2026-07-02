// Mapbox 服務：單車路線規劃（Directions）與反向地理編碼（座標→地址）。
// Token 由建置環境 VITE_MAPBOX_TOKEN 注入（勿寫死在原始碼，避免被 GitHub 密鑰掃描攔截）。
// 未設定時，相關功能會優雅降級（導航退回直線、定位退回經緯度）。
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const isMapboxConfigured = MAPBOX_TOKEN.length > 0;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteStep {
  /** 已轉成繁體中文的轉向提示文字（含「前方 X 米」前綴，示範播放用） */
  text: string;
  /** 純動作文字（不含距離前綴），真實 GPS 導航時搭配即時距離顯示 */
  action: string;
  /** 此步距離（公尺） */
  distance: number;
  /** 此轉向發生的位置（maneuver point），真實導航據此判斷是否已通過 */
  location: LatLng | null;
}

/** 把 Mapbox maneuver 轉成純動作繁中文字（內建中文為簡體，故自行轉換）。 */
export function maneuverToAction(step: any): string {
  const m = step?.maneuver ?? {};
  const turn: Record<string, string> = {
    left: '左轉',
    right: '右轉',
    'slight left': '靠左前行',
    'slight right': '靠右前行',
    'sharp left': '向左急轉',
    'sharp right': '向右急轉',
    straight: '直行',
    uturn: '迴轉',
  };
  switch (m.type) {
    case 'depart':
      return '出發，開始騎行';
    case 'arrive':
      return '已到達目的地 🎉';
    case 'roundabout':
    case 'rotary':
      return '進入迴旋處';
    case 'fork':
      return turn[m.modifier] ?? '靠路口前行';
    default:
      return turn[m.modifier] ?? '繼續前進';
  }
}

/** 動作文字加上「前方 X 米」前綴（示範播放模式用）。 */
export function maneuverToText(step: any): string {
  const m = step?.maneuver ?? {};
  const action = maneuverToAction(step);
  const dist = Math.round(step?.distance ?? 0);
  const near = dist > 60 && m.type !== 'depart' && m.type !== 'arrive' ? `前方 ${dist} 米，` : '';
  return `${near}${action}`;
}

/** 取得兩點間的真實單車路線（沿道路 / 單車徑）與逐步轉向。失敗回傳 null，呼叫端可退回直線。 */
export async function getCyclingRoute(
  start: LatLng,
  end: LatLng,
  signal?: AbortSignal
): Promise<{ distanceKm: number; durationMin: number; geometry: any; steps: RouteStep[] } | null> {
  if (!MAPBOX_TOKEN) return null;
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/cycling/${coords}` +
    `?geometries=geojson&overview=full&steps=true&language=zh-Hant&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const route = (await res.json())?.routes?.[0];
    if (!route?.geometry) return null;
    const rawSteps = route?.legs?.[0]?.steps ?? [];
    const steps: RouteStep[] = rawSteps.map((s: any) => {
      const loc = s?.maneuver?.location;
      return {
        text: maneuverToText(s),
        action: maneuverToAction(s),
        distance: Math.round(s?.distance ?? 0),
        location:
          Array.isArray(loc) && loc.length === 2 ? { lng: loc[0], lat: loc[1] } : null,
      };
    });
    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry: route.geometry,
      steps,
    };
  } catch {
    return null;
  }
}

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

/** 地點搜尋（學校 / 公園 / 地標等）。回傳前幾個結果；無 token 或失敗回 []。 */
export async function searchPlaces(
  query: string,
  proximity?: LatLng,
  signal?: AbortSignal
): Promise<PlaceResult[]> {
  if (!MAPBOX_TOKEN || !query.trim()) return [];
  const params = new URLSearchParams({
    language: 'zh-Hant',
    country: 'hk',
    limit: '5',
    types: 'poi,place,address,locality,neighborhood',
    access_token: MAPBOX_TOKEN,
  });
  if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const features = (await res.json())?.features ?? [];
    return features
      .filter((f: any) => Array.isArray(f.center) && f.center.length === 2)
      .map((f: any) => ({ name: f.place_name as string, lng: f.center[0], lat: f.center[1] }));
  } catch {
    return [];
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
