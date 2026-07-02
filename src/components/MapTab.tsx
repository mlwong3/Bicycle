import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PARKING_SPOTS } from '../data';
import { ParkingSpot } from '../types';
import { fetchCyclingLayer, CYCLING_LAYERS } from '../opendata';
import { haversineKm } from '../carbon';
import { getCyclingRoute, searchPlaces, PlaceResult, RouteStep } from '../mapbox';
import { getCurrentPosition, watchPosition } from '../geolocation';
import { subscribeLiveParking, fetchParkingHistory, LiveParkingDevice, DEVICE_STALE_MS } from '../realtime';
import { predictFree, ParkingPrediction } from '../predict';
import { computeTrackRoute, LatLng as TrackLatLng } from '../trackRouting';
import ParkingInfoCard from './map/ParkingInfoCard';
import NavigationPanel from './map/NavigationPanel';
import { readStoredJson, readStoredString, STORAGE_KEYS, writeStoredJson, writeStoredString } from '../storage';
import { 
  Search, 
  SlidersHorizontal, 
  Locate, 
  Navigation, 
  Bookmark, 
  BookmarkCheck, 
  Check, 
  AlertTriangle, 
  Compass, 
  Key,
  Layers,
  MapPin,
  ExternalLink,
  Info,
  Plus,
  Minus,
  Bike,
  Loader2,
  X,
  Cpu
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Real-world coordinates of Sha Tin, Hong Kong bike parking spots for Google/CSDI Maps
const SPOT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'parking-1': { lat: 22.379224, lng: 114.190135 }, // 沙田公園
  'parking-2': { lat: 22.372512, lng: 114.178224 }, // 大圍港鐵站 B 出口
  'parking-3': { lat: 22.375215, lng: 114.183542 }, // 車公廟體育館
};

// Simulated current position of user (Sha Tin Centre)
const USER_COORDINATES = { lat: 22.3770, lng: 114.1870 };

interface MapTabProps {
  savedParkingIds: string[];
  toggleSaveParking: (id: string) => void;
  onNavigateStart?: (spotName: string) => void;
  onTripComplete?: (distanceKm: number) => void;
}

// 把運輸署開放數據的泊位要素轉成 App 內的 ParkingSpot 結構（含實際距離）
function featureToSpot(f: any, userPos: { lat: number; lng: number }): ParkingSpot | null {
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  const cap = Number(f?.properties?.PARKING_SPACE ?? 0);
  const owner = f?.properties?.OWNER ?? 'TD';
  const oid = f?.properties?.OBJECTID ?? Math.random().toString(36).slice(2, 8);
  const km = haversineKm(userPos, { lat, lng });
  const distance = km < 1 ? `距離 ${Math.round(km * 1000)} 米` : `距離 ${km.toFixed(1)} 公里`;
  return {
    id: `td-${oid}`,
    name: `公共單車泊位 #${oid}`,
    distance,
    availableSlots: cap, // 此數據集無即時空位，僅有登記車位數
    totalSlots: cap,
    type: `運輸署登記 · ${owner}`,
    lat,
    lng,
  };
}

// OGC WMS Map Layers provided by Lands Department
const WMS_SERVICES = [
  {
    id: 'buildings',
    name: '官方建築物 (Buildings)',
    url: 'https://api.hkmapservice.gov.hk/ogc/wms/ib1000/buildings',
    layers: 'Building,Site,SubSite',
    description: '政府地政總署 1:1000 細緻建築物、構築物與外構數據'
  },
  {
    id: 'transportation',
    name: '交通運輸網 (Transportation)',
    url: 'https://api.hkmapservice.gov.hk/ogc/wms/ib1000/transportation',
    layers: 'Highway,MainRoad,Tunnel,SecondaryRoad,RestrictedRoad,Track',
    description: '主要公用道路、高速公路、行車隧道及單車徑輔助道路'
  },
  {
    id: 'poi',
    name: '興趣點與標誌 (POI)',
    url: 'https://api.hkmapservice.gov.hk/ogc/wms/ib5000/POI',
    layers: 'PlacePoint,POIPoint',
    description: '公眾休閒設施、著名景點、商業機構及社區地標點'
  },
  {
    id: 'boundary',
    name: '法定地段界線 (Boundary)',
    url: 'https://api.hkmapservice.gov.hk/ogc/wms/ic1000',
    layers: 'Lot,GLA,DemarcationDistrict,LandsDepartmentDistrict',
    description: '特區政府法定註冊地段、編號與分區行政地理邊界'
  }
];

export default function MapTab({ savedParkingIds, toggleSaveParking, onNavigateStart, onTripComplete }: MapTabProps) {
  // Try retrieving the CSDI API key from the environment or LocalStorage (for dynamic user overrides)
  const [csdiKey, setCsdiKey] = useState<string>(() => {
    const saved = readStoredString(STORAGE_KEYS.csdiApiKey, '', ['HK_CSDI_API_KEY']);
    if (saved) return saved;
    return process.env.CSDI_API_KEY || (import.meta as any).env?.VITE_CSDI_API_KEY || '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  // 泊位來源：運輸署開放數據（載入後填入），API 失敗時退回種子資料
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [parkingStatus, setParkingStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationProgress, setNavigationProgress] = useState(0);
  const [navigationMessage, setNavigationMessage] = useState('');
  // gps = 真實 GPS 追蹤推進；demo = 拿不到定位時的示範播放
  const [navMode, setNavMode] = useState<'gps' | 'demo'>('demo');
  // ESP32 感應器上傳的即時泊位裝置與各裝置的「1 小時後空位」預測
  const [liveDevices, setLiveDevices] = useState<LiveParkingDevice[]>([]);
  const [livePredictions, setLivePredictions] = useState<Record<string, ParkingPrediction | null>>({});
  // Mapbox 規劃出的真實單車路線幾何（null 時嘗試單車徑路線或退回直線）
  const [routeGeometry, setRouteGeometry] = useState<any | null>(null);
  // 沿官方單車徑規劃出的路線座標點（routeGeometry 為 null 時才會使用）
  const [trackRoutePoints, setTrackRoutePoints] = useState<TrackLatLng[] | null>(null);
  // 目前導航路線的真實來源，供地圖線條顏色與面板徽章對應顯示
  const [routeSource, setRouteSource] = useState<'track' | 'mapbox' | 'straight'>('straight');
  // 導航行程的真實距離與以 10 km/h 估算的時間
  const [navDistanceKm, setNavDistanceKm] = useState(0);
  const [navEtaMin, setNavEtaMin] = useState(0);
  // 使用者真實位置（GPS）；取得前以沙田中心作預設
  const [userPos, setUserPos] = useState<{ lat: number; lng: number }>(USER_COORDINATES);
  const userPosRef = useRef(userPos);
  useEffect(() => {
    userPosRef.current = userPos;
  }, [userPos]);

  // 平均騎乘速度（km/h），用於估算行程時間
  const CYCLING_SPEED_KMH = 10;
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isKeyPanelOpen, setIsKeyPanelOpen] = useState(false);

  // Enabled OGC WMS overlays state
  const [enabledWmsLayers, setEnabledWmsLayers] = useState<string[]>(() => {
    return readStoredJson(STORAGE_KEYS.enabledWmsLayers, ['buildings', 'transportation'], ['HK_BIKE_ENABLED_WMS_LAYERS']);
  });

  // Persist WMS choices
  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.enabledWmsLayers, enabledWmsLayers);
  }, [enabledWmsLayers]);

  // 運輸署官方單車開放數據（CSDI ArcGIS REST）疊加開關
  const [showCyclingData, setShowCyclingData] = useState<boolean>(() => {
    return readStoredString(STORAGE_KEYS.showCyclingData, 'true', ['HK_BIKE_SHOW_CYCLING_DATA']) === 'true';
  });
  const [cyclingStatus, setCyclingStatus] = useState<'idle' | 'loading' | 'ok' | 'error' | 'zoomout'>('idle');

  useEffect(() => {
    writeStoredString(STORAGE_KEYS.showCyclingData, String(showCyclingData));
  }, [showCyclingData]);
  
  // Map themes supported:
  // - csdi-topographic: Official CSDI LandsD standard map (requires key)
  // - csdi-imagery: Official CSDI LandsD orthophoto satellite (requires key)
  // - osm: OpenStreetMap (free, keyless)
  // - cartodb: CartoDB Positron elegant light map (free, keyless)
  const [mapTheme, setMapTheme] = useState<'csdi-topographic' | 'csdi-satellite' | 'osm' | 'cartodb'>(() => {
    const hasValidKey = Boolean(csdiKey) && csdiKey.trim() !== '' && csdiKey !== 'YOUR_API_KEY';
    return hasValidKey ? 'csdi-topographic' : 'cartodb';
  });

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylineRef = useRef<L.Polyline | L.GeoJSON | null>(null);
  const wmsLayersRef = useRef<Record<string, L.TileLayer.WMS>>({});

  // ESP32 即時泊位裝置標記
  const deviceMarkersRef = useRef<Record<string, L.Marker>>({});

  // 官方單車數據圖層 refs
  const cyclingTrackLayerRef = useRef<L.GeoJSON | null>(null);
  const cyclingAbortRef = useRef<AbortController | null>(null);
  const parkingAbortRef = useRef<AbortController | null>(null);
  // 導航逐步轉向計時器（示範播放用）、真實 GPS 追蹤停止函式、地點搜尋結果標記
  const navTimersRef = useRef<number[]>([]);
  const navWatchStopRef = useRef<(() => void) | null>(null);
  // 單車徑優先路線規劃的請求中止控制器
  const trackRoutingAbortRef = useRef<AbortController | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const placeAbortRef = useRef<AbortController | null>(null);
  const placeTimerRef = useRef<number | undefined>(undefined);

  // Handle key persistence
  const saveCsdiKey = (key: string) => {
    const trimmed = key.trim();
    setCsdiKey(trimmed);
    writeStoredString(STORAGE_KEYS.csdiApiKey, trimmed);
    if (trimmed) {
      setMapTheme('csdi-topographic');
    } else {
      setMapTheme('cartodb');
    }
    setIsKeyPanelOpen(false);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    // Initialize map centering around user's location
    const map = L.map(mapContainerRef.current, {
      center: [USER_COORDINATES.lat, USER_COORDINATES.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      // 元件卸載時停止任何進行中的 GPS 追蹤與示範計時器，避免記憶體洩漏
      navTimersRef.current.forEach((t) => window.clearTimeout(t));
      navWatchStopRef.current?.();
    };
  }, []);

  // 取得使用者真實 GPS 位置，成功後更新位置並把地圖移到該處（失敗保留沙田預設）
  useEffect(() => {
    let cancelled = false;
    getCurrentPosition()
      .then((pos) => {
        if (cancelled) return;
        setUserPos(pos);
        if (mapRef.current) {
          mapRef.current.setView([pos.lat, pos.lng], 16, { animate: true });
        }
      })
      .catch(() => {
        /* 使用者拒絕或不支援 → 沿用預設沙田中心 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Update Map Tile Layers dynamically according to selected MapTheme and CSDI Key
  useEffect(() => {
    if (!mapRef.current) return;

    // Clean existing layers
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
      tileLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      labelLayerRef.current.remove();
      labelLayerRef.current = null;
    }

    // Clean existing WMS layers
    for (const key in wmsLayersRef.current) {
      if (wmsLayersRef.current[key]) {
        wmsLayersRef.current[key].remove();
      }
    }
    wmsLayersRef.current = {};

    let basemapUrl = '';
    let labelUrl = '';
    let attribution = '';
    
    const hasValidKey = Boolean(csdiKey) && csdiKey.trim() !== '' && csdiKey !== 'YOUR_API_KEY';

    if (hasValidKey && (mapTheme === 'csdi-topographic' || mapTheme === 'csdi-satellite')) {
      attribution = '&copy; 地政總署 Lands Department / 空間數據共享平台 CSDI';
      
      if (mapTheme === 'csdi-satellite') {
        // Lands Department Imagery Basemap (Web Mercator WGS84 format)
        basemapUrl = `https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/wgs84/{z}/{x}/{y}.png?key=${csdiKey}`;
        // Traditional Chinese Labels for Satellite Map
        labelUrl = `https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/tc/wgs84/{z}/{x}/{y}.png?key=${csdiKey}`;
      } else {
        // Lands Department Standard Color Topographic Map
        basemapUrl = `https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png?key=${csdiKey}`;
        // Transparent traditional Chinese text labels
        labelUrl = `https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/tc/wgs84/{z}/{x}/{y}.png?key=${csdiKey}`;
      }
    } else {
      // Fallback to high-quality, keyless open-source tile sets
      if (mapTheme === 'osm') {
        basemapUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      } else if (mapTheme === 'csdi-satellite') {
        // Free Esri World Imagery fallback for satellite imagery
        basemapUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution = '&copy; Esri &copy; Earthstar Geographics';
      } else {
        // CartoDB Positron: Extremely clean light theme map, excellent for highlighting bike paths
        basemapUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      }
    }

    // Add primary basemap layer
    tileLayerRef.current = L.tileLayer(basemapUrl, {
      maxZoom: 19,
      attribution: attribution
    }).addTo(mapRef.current);

    // Add labeling overlay layer if available
    if (labelUrl) {
      labelLayerRef.current = L.tileLayer(labelUrl, {
        maxZoom: 19
      }).addTo(mapRef.current);
    }

    // Add enabled official OGC WMS layers if key exists
    if (hasValidKey) {
      WMS_SERVICES.forEach((service) => {
        if (enabledWmsLayers.includes(service.id)) {
          wmsLayersRef.current[service.id] = L.tileLayer.wms(service.url + '?', {
            layers: service.layers,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            key: csdiKey, // Passes key to the query params for LandsD WMS Auth
            maxZoom: 20
          } as any).addTo(mapRef.current!);
        }
      });
    }
  }, [mapTheme, csdiKey, enabledWmsLayers]);

  // 使用者位置藍點：獨立 effect，導航期間 GPS 高頻更新時只移動藍點，不重建泊位標記
  useEffect(() => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userPos.lat, userPos.lng]);
      return;
    }

    const userIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute inline-flex h-8 w-8 rounded-full bg-sky-400 opacity-50 animate-ping"></span>
          <div class="w-4 h-4 bg-sky-500 border-2 border-white rounded-full shadow-lg"></div>
        </div>
      `,
      className: 'user-location-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon: userIcon })
      .addTo(mapRef.current)
      .bindPopup('<div class="font-bold text-xs">您的目前位置</div>');
  }, [userPos]);

  // Synchronize Parking Spots Markers
  useEffect(() => {
    if (!mapRef.current) return;
    // Clear old markers
    for (const key in markersRef.current) {
      if (markersRef.current[key]) {
        markersRef.current[key].remove();
      }
    }
    markersRef.current = {};

    spots.forEach((spot) => {
      const coords = { lat: spot.lat, lng: spot.lng };

      const isActive = selectedSpot?.id === spot.id;
      const isWarning = spot.availableSlots === 0;

      // Custom high-contrast HTML pin layout
      const spotIcon = L.divIcon({
        html: `
          <div class="flex flex-col items-center cursor-pointer transition-transform duration-200 ${isActive ? 'scale-110 z-50' : 'hover:scale-105'}">
            <!-- Pin Head -->
            <div class="p-2.5 rounded-full shadow-lg border-2 flex items-center justify-center transition-all ${
              isActive 
                ? 'bg-[#006b2c] border-white text-white scale-110 ring-4 ring-[#006b2c]/20' 
                : isWarning 
                  ? 'bg-rose-500 border-white text-white shadow-rose-300' 
                  : 'bg-white border-[#006b2c] text-[#006b2c]'
            }">
              ${isWarning ? `
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              ` : `
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <path d="M5 12h14"></path>
                  <circle cx="12" cy="12" r="4.5" fill="currentColor" fill-opacity="${isActive ? 0.25 : 0}"></circle>
                </svg>
              `}
            </div>
            <!-- Arrow Triangle Indicator -->
            <div class="w-2 h-2 rotate-45 -mt-1 border-r border-b shadow-sm ${
              isActive 
                ? 'bg-[#006b2c] border-white/20' 
                : isWarning 
                  ? 'bg-rose-500 border-white/20' 
                  : 'bg-white border-[#006b2c]'
            }"></div>
          </div>
        `,
        className: `spot-marker-${spot.id}`,
        iconSize: [38, 38],
        iconAnchor: [19, 38]
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: spotIcon })
        .addTo(mapRef.current!)
        .on('click', () => {
          setSelectedSpot(spot);
          if (isNavigating) {
            clearNavTracking();
            setIsNavigating(false);
            setRouteGeometry(null);
            setTrackRoutePoints(null);
          }
        });

      markersRef.current[spot.id] = marker;
    });

  }, [selectedSpot, mapTheme, spots, isNavigating]);

  // 顯示 ESP32 即時泊位感應器裝置（有座標的才上圖，橙色晶片圖示區分於一般泊位）
  useEffect(() => {
    if (!mapRef.current) return;
    for (const key in deviceMarkersRef.current) {
      deviceMarkersRef.current[key].remove();
    }
    deviceMarkersRef.current = {};

    liveDevices.forEach((d) => {
      if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
      const stale = Date.now() - d.updatedAt > DEVICE_STALE_MS;
      const pred = livePredictions[d.id];
      const icon = L.divIcon({
        html: `
          <div class="flex flex-col items-center">
            <div class="px-2 py-1 rounded-xl shadow-lg border-2 border-white flex items-center gap-1 text-[10px] font-black ${
              stale ? 'bg-zinc-400 text-white' : 'bg-amber-500 text-white'
            }">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>
              <span>${d.free}/${d.total}</span>
            </div>
            <div class="w-2 h-2 rotate-45 -mt-1 border-r border-b border-white/30 ${stale ? 'bg-zinc-400' : 'bg-amber-500'}"></div>
          </div>
        `,
        className: `device-marker-${d.id}`,
        iconSize: [50, 34],
        iconAnchor: [25, 34],
      });
      const popupHtml = `
        <div class="text-xs font-bold">${d.name}</div>
        <div class="text-[10px] text-zinc-500 mt-0.5">即時空位：${d.free} / ${d.total}${stale ? '（裝置離線）' : ''}</div>
        ${pred ? `<div class="text-[10px] text-amber-600 mt-0.5">預測 1 小時後：約 ${pred.free} 個空位</div>` : ''}
      `;
      deviceMarkersRef.current[d.id] = L.marker([d.lat, d.lng], { icon })
        .addTo(mapRef.current!)
        .bindPopup(popupHtml);
    });
  }, [liveDevices, livePredictions]);

  // Handle centering map on selected spot
  useEffect(() => {
    if (!mapRef.current || !selectedSpot) return;
    const coords = { lat: selectedSpot.lat, lng: selectedSpot.lng };

    // Zoom in on target spot smoothly
    mapRef.current.setView([coords.lat, coords.lng], 16, {
      animate: true,
      duration: 1
    });
  }, [selectedSpot]);

  // Handle route line drawing during Navigation
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old route
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (isNavigating && selectedSpot) {
      const destCoords = { lat: selectedSpot.lat, lng: selectedSpot.lng };

      if (routeGeometry) {
        // 有 Mapbox 真實單車路線：沿實際道路畫實線（藍色，與常駐單車徑疊加層的綠色區分）
        const layer = L.geoJSON(routeGeometry, {
          style: { color: '#0b6fd1', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round' },
        }).addTo(mapRef.current);
        polylineRef.current = layer;
        mapRef.current.fitBounds(layer.getBounds(), { padding: [50, 50], animate: true, duration: 1.2 });
      } else if (trackRoutePoints) {
        // 沿官方單車徑規劃的真實路線（同樣視為真實路線，藍色實線）
        polylineRef.current = L.polyline(
          trackRoutePoints.map((p) => [p.lat, p.lng] as [number, number]),
          { color: '#0b6fd1', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }
        ).addTo(mapRef.current);
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50], animate: true, duration: 1.2 });
      } else {
        // 退回直線（Mapbox 與單車徑規劃皆失敗或尚未回傳）：amber 虛線，明確標示為估算
        polylineRef.current = L.polyline(
          [
            [userPosRef.current.lat, userPosRef.current.lng],
            [destCoords.lat, destCoords.lng]
          ],
          {
            color: '#f59e0b',
            weight: 5,
            opacity: 0.85,
            dashArray: '10, 8',
            lineCap: 'round',
            lineJoin: 'round'
          }
        ).addTo(mapRef.current);

        const group = L.featureGroup([userMarkerRef.current!, markersRef.current[selectedSpot.id]].filter(Boolean));
        mapRef.current.fitBounds(group.getBounds(), { padding: [50, 50], animate: true, duration: 1.2 });
      }
    }
  }, [isNavigating, selectedSpot, routeGeometry, trackRoutePoints]);

  // A. 載入並渲染運輸署「單車徑」圖層（綠線疊加，由開關控制）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearLayer = () => {
      if (cyclingTrackLayerRef.current) {
        cyclingTrackLayerRef.current.remove();
        cyclingTrackLayerRef.current = null;
      }
    };

    if (!showCyclingData) {
      clearLayer();
      cyclingAbortRef.current?.abort();
      setCyclingStatus('idle');
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (map.getZoom() < 13) {
        clearLayer();
        if (!cancelled) setCyclingStatus('zoomout');
        return;
      }
      cyclingAbortRef.current?.abort();
      const controller = new AbortController();
      cyclingAbortRef.current = controller;

      const b = map.getBounds();
      const bbox = { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() };

      if (!cancelled) setCyclingStatus('loading');
      try {
        const tracks = await fetchCyclingLayer(CYCLING_LAYERS.track, bbox, controller.signal);
        if (cancelled) return;
        clearLayer();
        cyclingTrackLayerRef.current = L.geoJSON(tracks, {
          style: { color: '#006b2c', weight: 3, opacity: 0.55, lineCap: 'round' },
          onEachFeature: (_f, layer) => layer.bindPopup('<div class="font-bold text-xs">運輸署單車徑</div>'),
        }).addTo(map);
        if (!cancelled) setCyclingStatus('ok');
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (!cancelled) setCyclingStatus('error');
      }
    };

    let loadTimer: number | undefined;
    const scheduleLoad = () => {
      window.clearTimeout(loadTimer);
      loadTimer = window.setTimeout(load, 350);
    };

    load();
    map.on('moveend', scheduleLoad);
    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
      map.off('moveend', scheduleLoad);
      cyclingAbortRef.current?.abort();
    };
  }, [showCyclingData]);

  // B. 載入運輸署「單車泊位」開放數據，作為地圖上的主要泊位標記（取代原本的捏造資料）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    const loadParking = async () => {
      if (map.getZoom() < 13) return; // 太遠不載入，避免大量標記
      parkingAbortRef.current?.abort();
      const controller = new AbortController();
      parkingAbortRef.current = controller;

      const b = map.getBounds();
      const bbox = { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() };

      setParkingStatus('loading');
      try {
        const fc = await fetchCyclingLayer(CYCLING_LAYERS.parking, bbox, controller.signal);
        if (cancelled) return;
        const here = userPosRef.current;
        const list = (fc?.features ?? [])
          .map((f: any) => featureToSpot(f, here))
          .filter((s: ParkingSpot | null): s is ParkingSpot => s !== null);
        setSpots(list);
        setParkingStatus('ok');
        // 預設選取最近一個泊位，讓資訊卡有內容
        setSelectedSpot((prev) => {
          if (prev && list.some((s: ParkingSpot) => s.id === prev.id)) return prev;
          return list.length
            ? list.reduce((a: ParkingSpot, c: ParkingSpot) =>
                haversineKm(here, c) < haversineKm(here, a) ? c : a)
            : null;
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (cancelled) return;
        // API 失敗 → 退回種子資料，避免地圖完全空白
        setParkingStatus('error');
        setSpots((prev) => (prev.length ? prev : PARKING_SPOTS));
        setSelectedSpot((prev) => prev ?? PARKING_SPOTS[0]);
      }
    };

    let loadTimer: number | undefined;
    const scheduleParkingLoad = () => {
      window.clearTimeout(loadTimer);
      loadTimer = window.setTimeout(loadParking, 350);
    };

    loadParking();
    map.on('moveend', scheduleParkingLoad);
    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
      map.off('moveend', scheduleParkingLoad);
      parkingAbortRef.current?.abort();
    };
  }, []);

  // C. 訂閱 ESP32 超聲波感應器上傳到 Realtime Database 的即時泊位數據（RTDB 未設定時 devices 恆為 []）
  useEffect(() => {
    const unsubscribe = subscribeLiveParking((devices) => setLiveDevices(devices));
    return unsubscribe;
  }, []);

  // 每部裝置每 60 秒重新拉一次歷史紀錄，計算「1 小時後預測空位」（簡單可解釋的統計模型，見 predict.ts）
  useEffect(() => {
    if (liveDevices.length === 0) return;
    let cancelled = false;

    const refresh = async () => {
      const entries = await Promise.all(
        liveDevices.map(async (d) => {
          const history = await fetchParkingHistory(d.id);
          return [d.id, predictFree(history, d.total, 60)] as const;
        })
      );
      if (!cancelled) setLivePredictions(Object.fromEntries(entries));
    };

    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveDevices]);

  // 清掉導航用的計時器與 GPS 追蹤（停止 / 重新導航 / 點其他泊位時呼叫）
  const clearNavTracking = () => {
    navTimersRef.current.forEach((t) => window.clearTimeout(t));
    navTimersRef.current = [];
    navWatchStopRef.current?.();
    navWatchStopRef.current = null;
    trackRoutingAbortRef.current?.abort();
    trackRoutingAbortRef.current = null;
  };

  // 到達判定閾值（公尺）：GPS 精度約 5-20 米，抵達目的地半徑內即視為完成
  const ARRIVAL_RADIUS_M = 25;
  // 視為「已通過」某轉向點的距離閾值（公尺）
  const STEP_PASS_RADIUS_M = 20;

  /** GPS 不可用時的示範播放：定時器模擬逐步轉向，僅作展示用途，不代表真實移動。 */
  function playDemoNavigation(tripKm: number, etaMin: number, steps: RouteStep[]) {
    if (steps.length > 0) {
      const stepMs = 1400;
      setNavigationMessage(
        `規劃完成：全長約 ${tripKm.toFixed(1)} 公里，以 ${CYCLING_SPEED_KMH} km/h 估算約 ${Math.round(etaMin)} 分鐘。（未取得 GPS，以下為示範播放）`
      );
      steps.forEach((s, i) => {
        const last = i === steps.length - 1;
        const t = window.setTimeout(() => {
          setNavigationProgress(Math.round(((i + 1) / steps.length) * 100));
          setNavigationMessage(s.text + (!last && s.distance > 0 ? `（約 ${s.distance} 米）` : ''));
          if (last && onTripComplete) onTripComplete(tripKm);
        }, 900 + i * stepMs);
        navTimersRef.current.push(t);
      });
    } else {
      const push = (ms: number, fn: () => void) => navTimersRef.current.push(window.setTimeout(fn, ms));
      push(1000, () => {
        setNavigationProgress(30);
        setNavigationMessage(
          `全長約 ${tripKm.toFixed(1)} 公里，以 ${CYCLING_SPEED_KMH} km/h 估算約 ${Math.round(etaMin)} 分鐘（示範播放，未取得 GPS）。`
        );
      });
      push(2800, () => {
        setNavigationProgress(70);
        setNavigationMessage('導航中：沿單車徑前進，注意行人與路口。');
      });
      push(4600, () => {
        setNavigationProgress(100);
        setNavigationMessage('已安全抵達！祝您單車停泊與出行愉快。');
        if (onTripComplete) onTripComplete(tripKm);
      });
    }
  }

  // Navigation：用 Mapbox 規劃真實單車路線 + 逐步轉向；有 GPS 時以真實位置推進進度，
  // 拿不到定位（桌面瀏覽器 / 拒絕授權）才退回示範播放。以真實距離計算減碳。
  const startNavigation = async () => {
    if (!selectedSpot) return;
    const dest = selectedSpot;
    const destPos = { lat: dest.lat, lng: dest.lng };
    clearNavTracking();
    setIsNavigating(true);
    setRouteGeometry(null);
    setTrackRoutePoints(null);
    setNavigationProgress(0);
    setNavigationMessage('正在規劃路線...');

    if (onNavigateStart) {
      onNavigateStart(dest.name);
    }

    const here = userPosRef.current;

    // 優先嘗試沿官方單車徑（CYCTRACK）規劃路線；起訖點連不上真實單車徑、
    // 路網不通、或路徑明顯繞遠時回傳 null，退回 Mapbox 道路路線。
    const trackAbort = new AbortController();
    trackRoutingAbortRef.current = trackAbort;
    const trackRoute = await computeTrackRoute(here, destPos, trackAbort.signal);
    if (trackAbort.signal.aborted) return; // 使用者已停止導航或重新導航

    let tripKm: number;
    let steps: RouteStep[] = [];
    let entryPoint: TrackLatLng | null = null;
    let exitPoint: TrackLatLng | null = null;

    if (trackRoute) {
      setRouteSource('track');
      setTrackRoutePoints(trackRoute.points);
      tripKm = trackRoute.distanceKm;
      entryPoint = trackRoute.entryPoint;
      exitPoint = trackRoute.exitPoint;
      setNavigationMessage(`已找到沿官方單車徑的路線，全長約 ${tripKm.toFixed(1)} 公里。`);
    } else {
      setNavigationMessage('正在規劃單車路線（Mapbox Directions）...');
      const route = await getCyclingRoute(here, destPos);
      setRouteGeometry(route?.geometry ?? null);
      if (route) {
        setRouteSource('mapbox');
        tripKm = route.distanceKm;
        steps = route.steps;
      } else {
        setRouteSource('straight');
        tripKm = haversineKm(here, destPos);
        setNavigationMessage('未取得真實路線，將以估算直線導航...');
      }
    }

    const etaMin = (tripKm / CYCLING_SPEED_KMH) * 60;
    setNavDistanceKm(tripKm);
    setNavEtaMin(etaMin);

    let nextStepIdx = 0;
    let trackPhase: 'toEntry' | 'onTrack' | 'toDest' = 'toEntry';
    let arrived = false;
    let gotFirstFix = false;

    // 單一連續 GPS 追蹤：每次定位更新後，用真實座標計算距下一個轉向點/終點的距離，
    // 據此推進進度與提示；首次定位失敗（例如拒絕授權）才退回示範播放。
    const stop = watchPosition(
      (pos) => {
        gotFirstFix = true;
        setNavMode('gps');
        setUserPos(pos);
        if (arrived) return;

        const distToDestM = haversineKm(pos, destPos) * 1000;

        if (distToDestM <= ARRIVAL_RADIUS_M) {
          arrived = true;
          setNavigationProgress(100);
          setNavigationMessage('已安全抵達！祝您單車停泊與出行愉快。 🎉');
          if (onTripComplete) onTripComplete(tripKm);
          clearNavTracking();
          return;
        }

        const totalM = tripKm * 1000;
        const progress = totalM > 0 ? Math.min(99, Math.round(((totalM - distToDestM) / totalM) * 100)) : 0;
        setNavigationProgress(Math.max(0, progress));

        if (entryPoint && exitPoint) {
          // 沿單車徑路線：三階段訊息（前往入口 → 沿單車徑前進 → 前往終點）
          if (trackPhase === 'toEntry') {
            const distToEntryM = haversineKm(pos, entryPoint) * 1000;
            if (distToEntryM <= STEP_PASS_RADIUS_M) {
              trackPhase = 'onTrack';
            } else {
              setNavigationMessage(`前往最近單車徑入口，約 ${Math.round(distToEntryM)} 米`);
              return;
            }
          }
          if (trackPhase === 'onTrack') {
            const distToExitM = haversineKm(pos, exitPoint) * 1000;
            if (distToExitM <= STEP_PASS_RADIUS_M) {
              trackPhase = 'toDest';
            } else {
              setNavigationMessage(`沿官方單車徑前進，距離出口約 ${Math.round(distToExitM)} 米`);
              return;
            }
          }
          setNavigationMessage(`即將抵達，距終點約 ${Math.round(distToDestM)} 米。`);
          return;
        }

        // Mapbox 逐步轉向（或無步驟時的直線退回）：沿現有步驟清單找出已通過的最後一步
        while (
          nextStepIdx < steps.length &&
          steps[nextStepIdx].location &&
          haversineKm(pos, steps[nextStepIdx].location as { lat: number; lng: number }) * 1000 < STEP_PASS_RADIUS_M
        ) {
          nextStepIdx += 1;
        }

        const upcoming = steps[nextStepIdx];
        if (upcoming) {
          const distToStepM = upcoming.location
            ? haversineKm(pos, upcoming.location as { lat: number; lng: number }) * 1000
            : 0;
          const near = distToStepM > 40 ? `前方約 ${Math.round(distToStepM)} 米，` : '';
          setNavigationMessage(`${near}${upcoming.action}`);
        } else {
          setNavigationMessage(`繼續前進，距目的地約 ${Math.round(distToDestM)} 米。`);
        }
      },
      () => {
        if (!gotFirstFix) {
          setNavMode('demo');
          playDemoNavigation(tripKm, etaMin, steps);
        }
      }
    );

    if (stop) {
      navWatchStopRef.current = stop;
    } else {
      // 瀏覽器不支援 Geolocation → 直接示範播放
      setNavMode('demo');
      playDemoNavigation(tripKm, etaMin, steps);
    }
  };

  const stopNavigation = () => {
    clearNavTracking();
    setIsNavigating(false);
    setNavigationProgress(0);
    setRouteGeometry(null);
    setTrackRoutePoints(null);
  };

  const handleMyLocation = () => {
    if (!mapRef.current) return;
    if (isNavigating) stopNavigation();
    // 先移到已知位置，再嘗試重新取得最新 GPS
    mapRef.current.setView([userPosRef.current.lat, userPosRef.current.lng], 16, { animate: true, duration: 1 });
    getCurrentPosition()
      .then((pos) => {
        setUserPos(pos);
        mapRef.current?.setView([pos.lat, pos.lng], 16, { animate: true, duration: 1 });
      })
      .catch(() => {
        /* 拒絕或不支援 → 維持目前已知位置 */
      });
  };

  // 地點搜尋（學校 / 公園 / 地標）：輸入時去抖動查詢
  const handlePlaceInput = (q: string) => {
    setSearchQuery(q);
    window.clearTimeout(placeTimerRef.current);
    placeAbortRef.current?.abort();
    if (!q.trim()) {
      setPlaceResults([]);
      setPlaceSearching(false);
      return;
    }
    setPlaceSearching(true);
    placeTimerRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      placeAbortRef.current = controller;
      const results = await searchPlaces(q, userPosRef.current, controller.signal);
      setPlaceResults(results);
      setPlaceSearching(false);
    }, 350);
  };

  // 選取搜尋結果：飛到該點並放上標記
  const selectPlace = (p: PlaceResult) => {
    setSearchQuery(p.name);
    setPlaceResults([]);
    if (!mapRef.current) return;
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
    const icon = L.divIcon({
      html: `<div class="flex flex-col items-center">
        <div class="p-2 rounded-full bg-amber-500 border-2 border-white text-white shadow-lg flex items-center justify-center">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <div class="w-2 h-2 rotate-45 -mt-1 bg-amber-500 border-r border-b border-white/30"></div>
      </div>`,
      className: 'place-search-marker',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
    searchMarkerRef.current = L.marker([p.lat, p.lng], { icon })
      .addTo(mapRef.current)
      .bindPopup(`<div class="text-xs font-bold">${p.name}</div>`)
      .openPopup();
    mapRef.current.flyTo([p.lat, p.lng], 16, { duration: 1 });
  };

  const isSaved = selectedSpot ? savedParkingIds.includes(selectedSpot.id) : false;
  const isKeyRegistered = Boolean(csdiKey) && csdiKey.trim() !== '' && csdiKey !== 'YOUR_API_KEY';

  return (
    <div id="maptab-root" className="relative flex-1 w-full h-full flex flex-col font-sans overflow-hidden">
      
      {/* Floating Controls Overlay Group (Search & Map Switchers) */}
      <div id="map-search-bar" className="absolute top-4 left-4 right-4 z-1000 max-w-sm mx-auto pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl flex items-center px-4 py-3 border border-zinc-200/80 focus-within:border-[#006b2c] transition-all">
          <Search id="map-search-icon" className="text-zinc-400 w-4.5 h-4.5 mr-2.5 shrink-0" />
          <input
            id="map-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => handlePlaceInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && placeResults.length > 0) selectPlace(placeResults[0]);
            }}
            placeholder="搜尋學校、公園、地點…"
            className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-xs font-bold text-zinc-800 placeholder:text-zinc-400 outline-none"
          />

          {placeSearching && <Loader2 className="w-4 h-4 mr-1.5 text-zinc-400 animate-spin shrink-0" />}
          {searchQuery && !placeSearching && (
            <button
              onClick={() => { setSearchQuery(''); setPlaceResults([]); }}
              className="mr-1.5 text-zinc-400 hover:text-zinc-600 shrink-0"
              title="清除"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            id="map-tune-btn"
            onClick={() => setIsLayersOpen(!isLayersOpen)}
            className="text-[#006b2c] hover:text-[#005320] transition-colors p-1.5 hover:bg-zinc-100 rounded-full shrink-0"
            title="地圖樣式"
          >
            <SlidersHorizontal id="map-tune-icon" className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* 地點搜尋結果下拉 */}
        <AnimatePresence>
          {placeResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-2 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden divide-y divide-zinc-50"
            >
              {placeResults.map((p, i) => (
                <button
                  key={i}
                  onClick={() => selectPlace(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#006b2c]/5 transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-[#006b2c] shrink-0" />
                  <span className="text-xs font-bold text-zinc-700 leading-tight line-clamp-2">{p.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic CSDI API Key Panel */}
        <AnimatePresence>
          {isKeyPanelOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="mt-2 bg-zinc-900 text-white rounded-2xl shadow-2xl border border-zinc-800 p-4 font-sans text-xs"
            >
              <div className="flex items-center gap-2 mb-2">
                <Compass className="w-4 h-4 text-[#006b2c] animate-spin-slow" />
                <h4 className="font-extrabold tracking-tight">香港政府 CSDI 地圖設定</h4>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed mb-3">
                此功能採用香港地政總署 Map Tile API。您可於 Geodata Store 免費申請專屬密鑰以啟用細緻的香港政府標準地圖。
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-zinc-500 block mb-1">CSDI / 地政總署 API KEY</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="請輸入 API 密鑰..."
                      defaultValue={csdiKey}
                      id="csdi-key-input"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#006b2c]"
                    />
                    <button
                      onClick={() => {
                        const val = (document.getElementById('csdi-key-input') as HTMLInputElement)?.value || '';
                        saveCsdiKey(val);
                      }}
                      className="bg-[#006b2c] hover:bg-[#005320] text-white px-3 py-1.5 rounded-xl font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      儲存
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px]">
                  <a 
                    href="https://geodata.gov.hk/" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-sky-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    前往 Geodata Store 官網 <ExternalLink className="w-3 h-3" />
                  </a>
                  {isKeyRegistered && (
                    <button
                      onClick={() => saveCsdiKey('')}
                      className="text-rose-400 hover:underline font-bold cursor-pointer"
                    >
                      清除密鑰
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map Styles Selector Menu */}
        <AnimatePresence>
          {isLayersOpen && (
            <motion.div
              id="map-layers-popup"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-3.5 w-64 pointer-events-auto z-50 max-h-[75vh] overflow-y-auto"
            >
              <h4 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-2 px-1">地圖底圖選擇</h4>
              <div className="flex flex-col gap-1">
                
                {/* CSDI layers (Only shown or styled as available if key exists) */}
                <button
                  onClick={() => {
                    if (!isKeyRegistered) {
                      setIsKeyPanelOpen(true);
                      setIsLayersOpen(false);
                      return;
                    }
                    setMapTheme('csdi-topographic');
                    setIsLayersOpen(false);
                  }}
                  className={`text-left px-2.5 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-bold ${
                    mapTheme === 'csdi-topographic' ? 'bg-[#006b2c]/10 text-[#006b2c]' : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>CSDI 政府標準地圖</span>
                    {!isKeyRegistered && <span className="text-[9px] text-amber-500 font-medium">需免費 API 金鑰</span>}
                  </div>
                  {mapTheme === 'csdi-topographic' && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                </button>

                <button
                  onClick={() => {
                    setMapTheme('csdi-satellite');
                    setIsLayersOpen(false);
                  }}
                  className={`text-left px-2.5 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-bold ${
                    mapTheme === 'csdi-satellite' ? 'bg-[#006b2c]/10 text-[#006b2c]' : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>政府航空相片 / 衛星圖</span>
                  </div>
                  {mapTheme === 'csdi-satellite' && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                </button>

                <div className="h-px bg-zinc-100 my-1.5" />

                {/* Standard Free Layers */}
                <button
                  onClick={() => {
                    setMapTheme('cartodb');
                    setIsLayersOpen(false);
                  }}
                  className={`text-left px-2.5 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-bold ${
                    mapTheme === 'cartodb' ? 'bg-[#006b2c]/10 text-[#006b2c]' : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>極簡淺色地圖 (推薦)</span>
                  </div>
                  {mapTheme === 'cartodb' && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                </button>

                <button
                  onClick={() => {
                    setMapTheme('osm');
                    setIsLayersOpen(false);
                  }}
                  className={`text-left px-2.5 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-bold ${
                    mapTheme === 'osm' ? 'bg-[#006b2c]/10 text-[#006b2c]' : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>OpenStreetMap 開源地圖</span>
                  </div>
                  {mapTheme === 'osm' && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                </button>

              </div>

              <div className="h-px bg-zinc-100 my-3" />

              {/* 運輸署官方單車數據疊加（公開 API，免密鑰） */}
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">運輸署單車數據</h4>
                <span className="text-[9px] font-black bg-green-50 text-[#006b2c] border border-green-100 px-1.5 py-0.5 rounded leading-none">即時 API</span>
              </div>
              <button
                onClick={() => setShowCyclingData((v) => !v)}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
                  showCyclingData
                    ? 'bg-[#006b2c]/5 border-[#006b2c]/30 text-[#006b2c]'
                    : 'bg-zinc-50 border-zinc-100 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Bike className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                <div className="flex flex-col flex-1">
                  <span className="font-bold text-[11px]">官方單車徑路線（綠線疊加）</span>
                  <span className="text-[9px] text-zinc-400 font-bold leading-tight">
                    {cyclingStatus === 'loading'
                      ? '載入中…'
                      : cyclingStatus === 'error'
                        ? '載入失敗，可重試'
                        : cyclingStatus === 'zoomout'
                          ? '請放大地圖以顯示'
                          : showCyclingData
                            ? '泊位已直接顯示；此開關控制單車徑路線'
                            : '已關閉'}
                  </span>
                </div>
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                  showCyclingData ? 'bg-[#006b2c] border-[#006b2c] text-white' : 'border-zinc-300 bg-white'
                }`}>
                  {showCyclingData && (cyclingStatus === 'loading'
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    : <Check className="w-2.5 h-2.5 stroke-[3.5px]" />)}
                </div>
              </button>

              <div className="h-px bg-zinc-100 my-3" />

              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">OGC WMS 官方圖層疊加</h4>
                <span className="text-[9px] font-black bg-green-50 text-[#006b2c] border border-green-100 px-1.5 py-0.5 rounded leading-none">WMS 格式</span>
              </div>
              
              {!isKeyRegistered ? (
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-bold leading-normal">
                  ⚠️ 請先設定政府 CSDI API 密鑰以開啟官方 OGC WMS 細緻圖層。
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {WMS_SERVICES.map((service) => {
                    const isEnabled = enabledWmsLayers.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        onClick={() => {
                          setEnabledWmsLayers((prev) => 
                            prev.includes(service.id) 
                              ? prev.filter(id => id !== service.id) 
                              : [...prev, service.id]
                          );
                        }}
                        className={`text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5 cursor-pointer ${
                          isEnabled 
                            ? 'bg-[#006b2c]/5 border-[#006b2c]/30 text-[#006b2c]' 
                            : 'bg-zinc-50 border-zinc-100 text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full font-bold text-[11px]">
                          <span>{service.name}</span>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                            isEnabled 
                              ? 'bg-[#006b2c] border-[#006b2c] text-white' 
                              : 'border-zinc-300 bg-white'
                          }`}>
                            {isEnabled && <Check className="w-2.5 h-2.5 stroke-[3.5px]" />}
                          </div>
                        </div>
                        <span className="text-[9px] text-zinc-400 font-bold leading-tight">
                          {service.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Leaflet Dynamic Canvas Frame Container */}
      <div
        ref={mapContainerRef}
        id="map-leaflet-canvas"
        className="w-full h-full bg-zinc-100 relative z-0"
      />

      {/* 官方單車數據載入狀態浮動提示 */}
      {showCyclingData && (cyclingStatus === 'loading' || cyclingStatus === 'error') && (
        <div className="absolute top-20 right-4 z-1000 pointer-events-none">
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shadow-md text-[10px] font-black backdrop-blur-md border ${
            cyclingStatus === 'error'
              ? 'bg-rose-50/95 text-rose-500 border-rose-100'
              : 'bg-white/95 text-[#006b2c] border-zinc-200/80'
          }`}>
            {cyclingStatus === 'loading' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>載入運輸署單車數據…</span>
              </>
            ) : (
              <>
                <Info className="w-3 h-3" />
                <span>官方數據載入失敗</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ESP32 即時泊位感應器狀態徽章（RTDB 未設定或無裝置上線時不顯示） */}
      {liveDevices.length > 0 && (
        <div className="absolute top-20 right-4 z-1000 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shadow-md text-[10px] font-black backdrop-blur-md border bg-amber-50/95 text-amber-600 border-amber-100">
            <Cpu className="w-3 h-3" />
            <span>{liveDevices.length} 個 IoT 感應器即時上線</span>
          </div>
        </div>
      )}

      {/* Missing CSDI API Key Dynamic Warning Prompt Card */}
      {!isKeyRegistered && (mapTheme === 'csdi-topographic' || mapTheme === 'csdi-satellite') && (
        <div className="absolute top-24 left-4 right-4 max-w-sm mx-auto bg-zinc-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-zinc-800 z-1000">
          <div className="flex items-start gap-2.5">
            <div className="p-1 px-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-bold leading-none shrink-0 mt-0.5 flex items-center justify-center gap-1">
              <Key className="w-3 h-3" />
              <span>NATIVE</span>
            </div>
            <div className="flex-1">
              <h5 className="text-xs font-bold tracking-tight">未啟用 CSDI / 地政總署 API Key</h5>
              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                地圖已自動切換為高解析度開源地圖。若想使用特區政府的官方高品質香港地理空間資訊圖，請按上方金鑰按鈕，貼上您的 Geodata Store 免費密鑰。
              </p>
              <button
                onClick={() => setIsKeyPanelOpen(true)}
                className="mt-2 text-[10px] bg-[#006b2c] hover:bg-[#005320] text-white px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
              >
                立即設定密鑰
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Slate-up Card View */}
      <div id="map-info-card-container" className="absolute bottom-20 md:bottom-8 left-4 right-4 z-1000 max-w-sm mx-auto md:ml-4 md:mr-0 pointer-events-auto">
        <AnimatePresence mode="wait">
          {!isNavigating ? (
            selectedSpot && (
              <motion.div
                key="spot-info"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <ParkingInfoCard
                  spot={selectedSpot}
                  isSaved={isSaved}
                  onStartNavigation={startNavigation}
                  onToggleSave={() => toggleSaveParking(selectedSpot.id)}
                />
              </motion.div>
            )
          ) : (
            selectedSpot && (
              <motion.div
                key="navigating-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <NavigationPanel
                  spotName={selectedSpot.name}
                  progress={navigationProgress}
                  message={navigationMessage}
                  distanceKm={navDistanceKm}
                  etaMin={navEtaMin}
                  mode={navMode}
                  routeSource={routeSource}
                  onStop={stopNavigation}
                />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Lands Department Official Data Attribution Tag */}
      <div className="absolute bottom-[84px] md:bottom-4 left-4 z-999 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-zinc-200/80 shadow-md text-[9px] font-black text-zinc-600 flex items-center gap-1.5 pointer-events-auto select-none max-w-[240px] md:max-w-none">
        <div className="w-1.5 h-1.5 rounded-full bg-[#006b2c] shrink-0" />
        <span className="leading-tight">
          地圖與空間數據來源：香港地政總署 (LandsD)
        </span>
      </div>

      {/* Side Map Controls Group (Zoom In, Zoom Out, Locate) - Elevated to prevent obstruction */}
      <div id="map-controls-group" className="absolute right-4 bottom-44 md:bottom-20 z-1000 flex flex-col gap-2 pointer-events-auto">
        {/* Zoom In */}
        <button
          onClick={() => {
            if (mapRef.current) mapRef.current.zoomIn();
          }}
          className="w-10 h-10 bg-white hover:bg-zinc-50 rounded-xl shadow-lg flex items-center justify-center text-[#006b2c] border border-zinc-100 transition-colors cursor-pointer"
          title="放大"
        >
          <Plus className="w-4.5 h-4.5 stroke-[2.5px]" />
        </button>
        {/* Zoom Out */}
        <button
          onClick={() => {
            if (mapRef.current) mapRef.current.zoomOut();
          }}
          className="w-10 h-10 bg-white hover:bg-zinc-50 rounded-xl shadow-lg flex items-center justify-center text-[#006b2c] border border-zinc-100 transition-colors cursor-pointer"
          title="縮小"
        >
          <Minus className="w-4.5 h-4.5 stroke-[2.5px]" />
        </button>
        {/* Locate */}
        <button
          id="map-fab-location"
          onClick={handleMyLocation}
          className="w-10 h-10 bg-white hover:bg-zinc-50 rounded-xl shadow-lg flex items-center justify-center text-[#006b2c] border border-zinc-100 transition-colors cursor-pointer mt-1"
          title="我的位置"
          aria-label="My Location"
        >
          <Locate className="w-4.5 h-4.5 stroke-[2.5px]" />
        </button>
      </div>

    </div>
  );
}
