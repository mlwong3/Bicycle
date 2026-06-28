// 透過瀏覽器 Geolocation API 取得使用者目前位置。
// 需 HTTPS（或 localhost）且使用者授權；行動裝置上會跳出定位權限提示。

export interface LatLng {
  lat: number;
  lng: number;
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** 取得目前 GPS 位置（Promise 包裝）。 */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('NOT_SUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
