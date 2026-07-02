// 單車徑優先路線規劃：直接用運輸署官方 CYCTRACK 幾何建圖，
// 找出起訖點沿真實單車徑的最短路徑；連不上或路網不合理時回傳 null，
// 呼叫端（MapTab）原樣退回 Mapbox 道路路線或直線估算。
import { fetchCyclingLayer, CYCLING_LAYERS, BBox } from './opendata';
import { haversineKm } from './carbon';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackRoute {
  /** 完整拼接路線：起點 → 接入單車徑 → 沿單車徑 → 離開單車徑 → 終點 */
  points: LatLng[];
  /** 全程距離（公里，含頭尾兩段連接直線） */
  distanceKm: number;
  /** 其中真正沿官方單車徑的距離（公里） */
  trackDistanceKm: number;
  entryPoint: LatLng;
  exitPoint: LatLng;
}

// 超過此直線距離就不嘗試單車徑路線（意義不大，且建圖成本上升）
export const MAX_TRACK_ROUTE_DISTANCE_KM = 6;
// 起訖點距最近單車徑節點的容許誤差（米）
export const SNAP_TOLERANCE_M = 280;
// 建圖時合併相近端點的容許誤差（米），處理官方資料在路口的微小數位化落差
export const NODE_MERGE_TOLERANCE_M = 9;
// 路徑距離 / 直線距離 超過此倍數視為路網破碎或繞遠，拒絕採用
export const MAX_PATH_TO_HAVERSINE_RATIO = 2.75;
// 查詢單車徑資料時，在起訖點涵蓋範圍外加的邊界（米）
export const BBOX_PADDING_M = 400;

const METERS_PER_DEG_LAT = 111320;

function metersToDegLat(m: number): number {
  return m / METERS_PER_DEG_LAT;
}

function metersToDegLng(m: number, atLat: number): number {
  return m / (METERS_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180));
}

interface TrackGraph {
  nodes: LatLng[];
  adjacency: { to: number; distKm: number }[][];
}

/** 依 NODE_MERGE_TOLERANCE_M 換算的雜湊格大小，用於合併相近端點。 */
function cellKey(lat: number, lng: number, cellDegLat: number, cellDegLng: number): string {
  return `${Math.floor(lat / cellDegLat)},${Math.floor(lng / cellDegLng)}`;
}

/** 用 GeoJSON FeatureCollection（LineString / MultiLineString）建立路網圖。 */
function buildTrackGraph(featureCollection: any): TrackGraph {
  const nodes: LatLng[] = [];
  const adjacency: { to: number; distKm: number }[][] = [];
  const grid = new Map<string, number[]>();

  const cellDegLat = metersToDegLat(NODE_MERGE_TOLERANCE_M);
  // 香港緯度約 22.3°，用固定值換算即可，誤差可忽略
  const cellDegLng = metersToDegLng(NODE_MERGE_TOLERANCE_M, 22.3);

  function getOrCreateNode(lat: number, lng: number): number {
    const cLat = Math.floor(lat / cellDegLat);
    const cLng = Math.floor(lng / cellDegLng);
    let bestIdx = -1;
    let bestDistKm = Infinity;
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const key = `${cLat + dLat},${cLng + dLng}`;
        const candidates = grid.get(key);
        if (!candidates) continue;
        for (const idx of candidates) {
          const d = haversineKm(nodes[idx], { lat, lng });
          if (d < bestDistKm) {
            bestDistKm = d;
            bestIdx = idx;
          }
        }
      }
    }
    if (bestIdx !== -1 && bestDistKm * 1000 <= NODE_MERGE_TOLERANCE_M) {
      return bestIdx;
    }
    const idx = nodes.length;
    nodes.push({ lat, lng });
    adjacency.push([]);
    const key = cellKey(lat, lng, cellDegLat, cellDegLng);
    const list = grid.get(key);
    if (list) list.push(idx);
    else grid.set(key, [idx]);
    return idx;
  }

  function addEdge(a: number, b: number) {
    if (a === b) return;
    const distKm = haversineKm(nodes[a], nodes[b]);
    if (distKm <= 0) return;
    adjacency[a].push({ to: b, distKm });
    adjacency[b].push({ to: a, distKm });
  }

  function walkLine(coords: number[][]) {
    let prevIdx: number | null = null;
    for (const [lng, lat] of coords) {
      const idx = getOrCreateNode(lat, lng);
      if (prevIdx !== null) addEdge(prevIdx, idx);
      prevIdx = idx;
    }
  }

  for (const feature of featureCollection?.features ?? []) {
    const geom = feature?.geometry;
    if (!geom) continue;
    if (geom.type === 'LineString') {
      walkLine(geom.coordinates);
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) walkLine(line);
    }
  }

  return { nodes, adjacency };
}

/** 找出距 point 最近的圖節點，超過 maxDistanceM 視為連不上。 */
function findNearestNode(
  graph: TrackGraph,
  point: LatLng,
  maxDistanceM: number = SNAP_TOLERANCE_M
): { nodeIdx: number; distanceKm: number } | null {
  let bestIdx = -1;
  let bestDistKm = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = haversineKm(point, graph.nodes[i]);
    if (d < bestDistKm) {
      bestDistKm = d;
      bestIdx = i;
    }
  }
  if (bestIdx === -1 || bestDistKm * 1000 > maxDistanceM) return null;
  return { nodeIdx: bestIdx, distanceKm: bestDistKm };
}

/** 簡易二元最小堆，用於 Dijkstra。 */
class MinHeap {
  private items: { idx: number; dist: number }[] = [];

  push(item: { idx: number; dist: number }) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].dist <= this.items[i].dist) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): { idx: number; dist: number } | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        let smallest = i;
        if (l < n && this.items[l].dist < this.items[smallest].dist) smallest = l;
        if (r < n && this.items[r].dist < this.items[smallest].dist) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  get size(): number {
    return this.items.length;
  }
}

/** 標準 Dijkstra 最短路徑（權重 = 公里）。找不到路徑回傳 null。 */
function dijkstra(
  graph: TrackGraph,
  startIdx: number,
  endIdx: number
): { path: number[]; distanceKm: number } | null {
  const dist = new Array(graph.nodes.length).fill(Infinity);
  const prev = new Array(graph.nodes.length).fill(-1);
  const settled = new Array(graph.nodes.length).fill(false);

  dist[startIdx] = 0;
  const heap = new MinHeap();
  heap.push({ idx: startIdx, dist: 0 });

  while (heap.size > 0) {
    const cur = heap.pop()!;
    if (settled[cur.idx]) continue;
    settled[cur.idx] = true;
    if (cur.idx === endIdx) break;

    for (const edge of graph.adjacency[cur.idx]) {
      if (settled[edge.to]) continue;
      const nd = dist[cur.idx] + edge.distKm;
      if (nd < dist[edge.to]) {
        dist[edge.to] = nd;
        prev[edge.to] = cur.idx;
        heap.push({ idx: edge.to, dist: nd });
      }
    }
  }

  if (dist[endIdx] === Infinity) return null;

  const path: number[] = [];
  let cur = endIdx;
  while (cur !== -1) {
    path.push(cur);
    cur = prev[cur];
  }
  path.reverse();

  return { path, distanceKm: dist[endIdx] };
}

/** 算出涵蓋 a、b 兩點並加上 paddingM 邊界的 bbox。 */
function bboxCovering(a: LatLng, b: LatLng, paddingM: number): BBox {
  const midLat = (a.lat + b.lat) / 2;
  const padLat = metersToDegLat(paddingM);
  const padLng = metersToDegLng(paddingM, midLat);
  return {
    minLat: Math.min(a.lat, b.lat) - padLat,
    maxLat: Math.max(a.lat, b.lat) + padLat,
    minLng: Math.min(a.lng, b.lng) - padLng,
    maxLng: Math.max(a.lng, b.lng) + padLng,
  };
}

/**
 * 嘗試沿官方單車徑規劃 start → dest 的路線。
 * 起訖點連不上單車徑、路網不通、或路徑明顯繞遠時回傳 null，
 * 呼叫端應退回 Mapbox 道路路線或直線估算。
 */
export async function computeTrackRoute(
  start: LatLng,
  dest: LatLng,
  signal?: AbortSignal
): Promise<TrackRoute | null> {
  const straightKm = haversineKm(start, dest);
  if (straightKm < 0.05 || straightKm > MAX_TRACK_ROUTE_DISTANCE_KM) return null;

  let fc: any;
  try {
    fc = await fetchCyclingLayer(CYCLING_LAYERS.track, bboxCovering(start, dest, BBOX_PADDING_M), signal);
  } catch {
    return null;
  }

  const graph = buildTrackGraph(fc);
  if (graph.nodes.length === 0) return null;

  const startSnap = findNearestNode(graph, start);
  const destSnap = findNearestNode(graph, dest);
  if (!startSnap || !destSnap) return null;

  const result = dijkstra(graph, startSnap.nodeIdx, destSnap.nodeIdx);
  if (!result) return null;

  if (result.distanceKm > straightKm * MAX_PATH_TO_HAVERSINE_RATIO) return null;

  const trackPoints = result.path.map((idx) => graph.nodes[idx]);
  const points: LatLng[] = [start, ...trackPoints, dest];

  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(points[i - 1], points[i]);
  }

  return {
    points,
    distanceKm,
    trackDistanceKm: result.distanceKm,
    entryPoint: trackPoints[0],
    exitPoint: trackPoints[trackPoints.length - 1],
  };
}
