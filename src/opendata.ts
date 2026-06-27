// 運輸署「單車資訊」開放數據存取模組
//
// 資料集：https://data.gov.hk/tc-data/dataset/hk-td-tis_20-cycling-information
// 透過 CSDI 空間數據共享平台的 ArcGIS REST FeatureServer 取得，
// 直接以 outSR=4326 回傳 WGS84 經緯度、f=geojson 回傳 GeoJSON，
// 無需自行做 EPSG:2326 座標轉換，且已驗證允許瀏覽器跨域 (CORS)。

const FEATURE_SERVER =
  'https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1629267205229_68005/FeatureServer';

// FeatureServer 圖層對應
export const CYCLING_LAYERS = {
  parking: 0, // CYCPARKSPACE - 單車泊位 (Point)
  ramp: 1,    // CYCRAMP      - 單車斜道/隧道/橋 (Polyline)
  track: 2,   // CYCTRACK     - 單車徑 (Polyline)
} as const;

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * 查詢指定圖層並回傳 GeoJSON（WGS84）。
 * 傳入 bbox 時只取與該範圍相交的要素，大幅減少傳輸量。
 */
export async function fetchCyclingLayer(
  layerId: number,
  bbox?: BBox,
  signal?: AbortSignal
): Promise<any> {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    outSR: '4326',
    f: 'geojson',
  });

  if (bbox) {
    // ArcGIS envelope: minX,minY,maxX,maxY（經度在前）
    params.set('geometry', `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`);
    params.set('geometryType', 'esriGeometryEnvelope');
    params.set('inSR', '4326');
    params.set('spatialRel', 'esriSpatialRelIntersects');
  }

  const url = `${FEATURE_SERVER}/${layerId}/query?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`運輸署開放數據請求失敗 (HTTP ${res.status})`);
  }
  return res.json();
}
