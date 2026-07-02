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

/**
 * 持續追蹤 GPS 位置（導航用）。回傳停止函式；不支援時回傳 null。
 * onError 只在「一開始就拿不到定位」時觸發（例如使用者拒絕授權），
 * 追蹤途中的暫時性訊號不良會被忽略，等待下一次更新。
 */
export function watchPosition(
  onUpdate: (pos: LatLng, accuracyM: number) => void,
  onError: (err: GeolocationPositionError) => void
): (() => void) | null {
  if (!isGeolocationSupported()) return null;
  let gotFirstFix = false;
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      gotFirstFix = true;
      onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }, pos.coords.accuracy);
    },
    (err) => {
      if (!gotFirstFix) onError(err);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}
