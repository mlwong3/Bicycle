import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PARKING_SPOTS } from '../data';
import { ParkingSpot } from '../types';
import { fetchCyclingLayer, CYCLING_LAYERS } from '../opendata';
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
  Loader2
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

export default function MapTab({ savedParkingIds, toggleSaveParking, onNavigateStart }: MapTabProps) {
  // Try retrieving the CSDI API key from the environment or LocalStorage (for dynamic user overrides)
  const [csdiKey, setCsdiKey] = useState<string>(() => {
    const saved = localStorage.getItem('HK_CSDI_API_KEY');
    if (saved) return saved;
    return process.env.CSDI_API_KEY || (import.meta as any).env?.VITE_CSDI_API_KEY || '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot>(PARKING_SPOTS[0]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationProgress, setNavigationProgress] = useState(0);
  const [navigationMessage, setNavigationMessage] = useState('');
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isKeyPanelOpen, setIsKeyPanelOpen] = useState(false);

  // Enabled OGC WMS overlays state
  const [enabledWmsLayers, setEnabledWmsLayers] = useState<string[]>(() => {
    const saved = localStorage.getItem('HK_BIKE_ENABLED_WMS_LAYERS');
    return saved ? JSON.parse(saved) : ['buildings', 'transportation']; // Default enable buildings and transport
  });

  // Persist WMS choices
  useEffect(() => {
    localStorage.setItem('HK_BIKE_ENABLED_WMS_LAYERS', JSON.stringify(enabledWmsLayers));
  }, [enabledWmsLayers]);

  // 運輸署官方單車開放數據（CSDI ArcGIS REST）疊加開關
  const [showCyclingData, setShowCyclingData] = useState<boolean>(() => {
    const saved = localStorage.getItem('HK_BIKE_SHOW_CYCLING_DATA');
    return saved ? saved === 'true' : true; // 預設開啟
  });
  const [cyclingStatus, setCyclingStatus] = useState<'idle' | 'loading' | 'ok' | 'error' | 'zoomout'>('idle');

  useEffect(() => {
    localStorage.setItem('HK_BIKE_SHOW_CYCLING_DATA', String(showCyclingData));
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
  const polylineRef = useRef<L.Polyline | null>(null);
  const wmsLayersRef = useRef<Record<string, L.TileLayer.WMS>>({});

  // 官方單車數據圖層 refs
  const cyclingTrackLayerRef = useRef<L.GeoJSON | null>(null);
  const cyclingParkingLayerRef = useRef<L.GeoJSON | null>(null);
  const cyclingAbortRef = useRef<AbortController | null>(null);

  // Handle key persistence
  const saveCsdiKey = (key: string) => {
    const trimmed = key.trim();
    setCsdiKey(trimmed);
    localStorage.setItem('HK_CSDI_API_KEY', trimmed);
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

  // Synchronize Markers (User position & Parking spot pins)
  useEffect(() => {
    if (!mapRef.current) return;

    // 1. Manage User Location Marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
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

    userMarkerRef.current = L.marker([USER_COORDINATES.lat, USER_COORDINATES.lng], { icon: userIcon })
      .addTo(mapRef.current)
      .bindPopup('<div class="font-bold text-xs">您的目前位置 (沙田中心)</div>');

    // 2. Manage Parking Spots Markers
    // Clear old markers
    for (const key in markersRef.current) {
      if (markersRef.current[key]) {
        markersRef.current[key].remove();
      }
    }
    markersRef.current = {};

    const filteredSpots = PARKING_SPOTS.filter(spot => 
      spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filteredSpots.forEach((spot) => {
      const coords = SPOT_COORDINATES[spot.id] || { lat: spot.lat, lng: spot.lng };
      if (!coords) return;

      const isActive = selectedSpot.id === spot.id;
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
            setIsNavigating(false);
          }
        });

      markersRef.current[spot.id] = marker;
    });

  }, [searchQuery, selectedSpot, mapTheme]);

  // Handle centering map on selected spot
  useEffect(() => {
    if (!mapRef.current || !selectedSpot) return;
    const coords = SPOT_COORDINATES[selectedSpot.id] || { lat: selectedSpot.lat, lng: selectedSpot.lng } || USER_COORDINATES;
    
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
      const destCoords = SPOT_COORDINATES[selectedSpot.id] || { lat: selectedSpot.lat, lng: selectedSpot.lng };
      if (destCoords) {
        // Draw standard ecological green dashed line
        polylineRef.current = L.polyline(
          [
            [USER_COORDINATES.lat, USER_COORDINATES.lng],
            [destCoords.lat, destCoords.lng]
          ],
          {
            color: '#006b2c',
            weight: 6,
            opacity: 0.85,
            dashArray: '10, 8',
            lineCap: 'round',
            lineJoin: 'round'
          }
        ).addTo(mapRef.current);

        // Zoom fit to cover both points
        const group = L.featureGroup([userMarkerRef.current!, markersRef.current[selectedSpot.id]].filter(Boolean));
        mapRef.current.fitBounds(group.getBounds(), {
          padding: [50, 50],
          animate: true,
          duration: 1.2
        });
      }
    }
  }, [isNavigating, selectedSpot]);

  // 載入並渲染運輸署官方單車開放數據（單車徑 + 泊位），依可視範圍 bbox 查詢
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearLayers = () => {
      if (cyclingTrackLayerRef.current) {
        cyclingTrackLayerRef.current.remove();
        cyclingTrackLayerRef.current = null;
      }
      if (cyclingParkingLayerRef.current) {
        cyclingParkingLayerRef.current.remove();
        cyclingParkingLayerRef.current = null;
      }
    };

    if (!showCyclingData) {
      clearLayers();
      cyclingAbortRef.current?.abort();
      setCyclingStatus('idle');
      return;
    }

    let cancelled = false;

    const load = async () => {
      // 縮得太遠時範圍過大、要素過多，先不載入以保效能
      if (map.getZoom() < 13) {
        clearLayers();
        if (!cancelled) setCyclingStatus('zoomout');
        return;
      }

      cyclingAbortRef.current?.abort();
      const controller = new AbortController();
      cyclingAbortRef.current = controller;

      const b = map.getBounds();
      const bbox = {
        minLng: b.getWest(),
        minLat: b.getSouth(),
        maxLng: b.getEast(),
        maxLat: b.getNorth(),
      };

      if (!cancelled) setCyclingStatus('loading');
      try {
        const [tracks, parking] = await Promise.all([
          fetchCyclingLayer(CYCLING_LAYERS.track, bbox, controller.signal),
          fetchCyclingLayer(CYCLING_LAYERS.parking, bbox, controller.signal),
        ]);
        if (cancelled) return;
        clearLayers();

        // 單車徑：綠色實線
        cyclingTrackLayerRef.current = L.geoJSON(tracks, {
          style: { color: '#006b2c', weight: 3, opacity: 0.6, lineCap: 'round' },
          onEachFeature: (_f, layer) => layer.bindPopup('<div class="font-bold text-xs">運輸署單車徑</div>'),
        }).addTo(map);

        // 官方泊位：小綠圈，附車位數
        cyclingParkingLayerRef.current = L.geoJSON(parking, {
          pointToLayer: (feature: any, latlng) =>
            L.circleMarker(latlng, {
              radius: 4,
              color: '#ffffff',
              weight: 1.5,
              fillColor: '#006b2c',
              fillOpacity: 0.75,
            }).bindPopup(
              `<div class="text-xs"><div class="font-bold">官方單車泊位</div>車位數：${
                feature?.properties?.PARKING_SPACE ?? '—'
              }（${feature?.properties?.OWNER ?? 'TD'}）</div>`
            ),
        }).addTo(map);

        if (!cancelled) setCyclingStatus('ok');
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (!cancelled) setCyclingStatus('error');
      }
    };

    load();
    map.on('moveend', load);
    return () => {
      cancelled = true;
      map.off('moveend', load);
      cyclingAbortRef.current?.abort();
    };
  }, [showCyclingData]);

  // Simulation engine for Navigation progression
  const startNavigation = () => {
    setIsNavigating(true);
    setNavigationProgress(0);
    setNavigationMessage('正在透過政府空間數據(CSDI)優化路網規劃...');
    
    if (onNavigateStart) {
      onNavigateStart(selectedSpot.name);
    }

    setTimeout(() => {
      setNavigationProgress(25);
      setNavigationMessage('導航中：直行 100 米，進入城門河單車徑。');
    }, 1200);

    setTimeout(() => {
      setNavigationProgress(60);
      setNavigationMessage('導航中：向右急轉彎，沿單車徑旁繼續前進。');
    }, 2800);

    setTimeout(() => {
      setNavigationProgress(90);
      setNavigationMessage('接近目的地：前方 20 米右側為 ' + selectedSpot.name);
    }, 4500);

    setTimeout(() => {
      setNavigationProgress(100);
      setNavigationMessage('已安全抵達！祝您單車停泊與出行愉快。');
    }, 6000);
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setNavigationProgress(0);
  };

  const handleMyLocation = () => {
    if (!mapRef.current) return;
    setIsNavigating(false);
    mapRef.current.setView([USER_COORDINATES.lat, USER_COORDINATES.lng], 16, {
      animate: true,
      duration: 1
    });
  };

  const isSaved = savedParkingIds.includes(selectedSpot.id);
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋單車徑或泊位..."
            className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-xs font-bold text-zinc-800 placeholder:text-zinc-400 outline-none"
          />
          
          {/* CSDI Badge / Key Status Trigger */}
          <button
            onClick={() => setIsKeyPanelOpen(!isKeyPanelOpen)}
            className={`mr-2.5 px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              isKeyRegistered 
                ? 'bg-[#006b2c]/10 text-[#006b2c] hover:bg-[#006b2c]/20' 
                : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
            }`}
            title="空間數據 API 密鑰"
          >
            <Key className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>{isKeyRegistered ? 'CSDI 已啟用' : '免密鑰模式'}</span>
          </button>

          <button 
            id="map-tune-btn"
            onClick={() => setIsLayersOpen(!isLayersOpen)} 
            className="text-[#006b2c] hover:text-[#005320] transition-colors p-1.5 hover:bg-zinc-100 rounded-full"
            title="地圖樣式"
          >
            <SlidersHorizontal id="map-tune-icon" className="w-4.5 h-4.5" />
          </button>
        </div>

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
                  <span className="font-bold text-[11px]">官方單車徑與泊位</span>
                  <span className="text-[9px] text-zinc-400 font-bold leading-tight">
                    {cyclingStatus === 'loading'
                      ? '載入中…'
                      : cyclingStatus === 'error'
                        ? '載入失敗，可重試'
                        : cyclingStatus === 'zoomout'
                          ? '請放大地圖以顯示'
                          : showCyclingData
                            ? '資料來源：運輸署 (TD) / CSDI'
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
            <motion.div
              key="spot-info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl border border-zinc-100 p-4 font-sans"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] bg-green-50 text-[#006b2c] border border-green-100 px-2 py-0.5 rounded font-black tracking-wider block w-max uppercase mb-1">
                    {selectedSpot.id === 'parking-1' ? '推薦泊區' : '政府認可'}
                  </span>
                  <h3 className="text-sm font-black text-zinc-900 tracking-tight leading-tight">{selectedSpot.name}</h3>
                  <p className="text-[10px] text-zinc-400 mt-1 flex items-center font-bold">
                    <Compass className="w-3.5 h-3.5 mr-1 text-[#006b2c] shrink-0" />
                    {selectedSpot.distance} • {selectedSpot.type}
                  </p>
                  <p className="text-[8px] text-zinc-400 font-bold mt-0.5 tracking-tight">
                    © 香港地政總署授權空間數據
                  </p>
                </div>
                <div className={`px-2.5 py-1 rounded-full flex items-center gap-1 border text-[10px] font-black ${
                  selectedSpot.availableSlots === 0
                    ? 'bg-rose-50 border-rose-100 text-rose-500 animate-pulse'
                    : 'bg-green-50 border-green-100 text-[#006b2c]'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>空位: {selectedSpot.availableSlots} / {selectedSpot.totalSlots}</span>
                </div>
              </div>

              <div className="flex gap-2.5 mt-3 pt-2.5 border-t border-zinc-50">
                <button
                  onClick={startNavigation}
                  disabled={selectedSpot.availableSlots === 0}
                  className={`flex-1 font-bold py-2.5 px-4 rounded-xl flex justify-center items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                    selectedSpot.availableSlots === 0 
                      ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                      : 'bg-[#006b2c] hover:bg-[#005320] text-white shadow-md shadow-[#006b2c]/10'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  開始路線導航
                </button>
                
                <button
                  onClick={() => toggleSaveParking(selectedSpot.id)}
                  className="p-2.5 border border-zinc-200 text-zinc-500 hover:text-[#006b2c] hover:border-[#006b2c]/30 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                  title={isSaved ? "取消收藏" : "收藏泊車區"}
                >
                  {isSaved ? (
                    <BookmarkCheck className="w-4 h-4 text-[#006b2c] fill-current" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="navigating-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 text-white rounded-3xl shadow-2xl p-4 font-sans"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-[9px] font-black text-[#006b2c] uppercase tracking-wider">正在進行智能導航</h4>
                  <p className="text-xs font-bold text-white mt-0.5 leading-tight">{selectedSpot.name}</p>
                </div>
                <button
                  onClick={stopNavigation}
                  className="text-[10px] text-zinc-400 hover:text-white font-black px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  結束導航
                </button>
              </div>

              <div className="space-y-2.5 my-3">
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <motion.div
                    className="bg-[#006b2c] h-full"
                    style={{ width: `${navigationProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[11px] text-zinc-300 min-h-[30px] leading-relaxed font-semibold">
                  {navigationMessage}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-bold border-t border-zinc-800/60 pt-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 block animate-pulse" />
                <span>GPS 與 CSDI 空間路網串接成功</span>
              </div>
            </motion.div>
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
