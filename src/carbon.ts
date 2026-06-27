// 減碳計算（以實際騎乘距離 × 香港官方排放係數）
//
// 排放係數出處：香港《溫室氣體排放量計算工具》(2024 版, C02/24)
// 無鉛汽油 = 2.360 kg CO₂ / 公升
//
// 誠實註腳：
//  1. 本估算僅計 CO₂，未含微量 CH₄/N₂O，屬略保守估計。
//  2. 油耗 8 L/100km 為市區私家車假設值；正式版應引用來源或讓使用者自選車型。

export const PETROL_CO2_PER_LITRE = 2.360;        // kg/L（官方）
export const CAR_FUEL_ECONOMY_L_PER_100KM = 8;    // 假設值

/** 每公里汽車碳排 ≈ 0.19 kg */
export const CAR_CO2_PER_KM =
  (CAR_FUEL_ECONOMY_L_PER_100KM / 100) * PETROL_CO2_PER_LITRE;

/** 用單車取代同距離汽車行程所避免的碳排（kg） */
export function carbonSaved(distanceKm: number): number {
  return Math.max(0, distanceKm) * CAR_CO2_PER_KM;
}

/** 把多段行程距離累加後換算避免的碳排（kg） */
export function totalCarbonSaved(tripsKm: number[]): number {
  return tripsKm.reduce((sum, d) => sum + carbonSaved(d), 0);
}

/** 兩個 WGS84 座標間的大圓距離（公里），用於由實際路線估算騎乘距離 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // 地球半徑 km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
