// Elevation and pedestrian connection for the Rampe di Sant'Antonio ("Tredici Scese").
// The path follows OpenStreetMap pedestrian geometry. Elevations are 91 bilinear
// samples, ~10 m apart, from the Regione Campania 2020 DTM service (5 m cells).
export const POSILLIPO_RELIEF_SOURCE = 'Regione Campania DTM 2020, 5 m, via CTR2020_DTM5K_tif';
export const POSILLIPO_RELIEF_ATTRIBUTION = 'DTM: Regione Campania, Cartografia/DTM 2020, CC BY 4.0 — https://sit.regione.campania.it/ufficio-sit/news/cartografie-digitali-della-regione-campania';
export const POSILLIPO_CHURCH_ELEVATION_M = 81.352;

// Heights in metres, sampled at equal route distances from Piazza Sannazaro
// toward Sant'Antonio. The source DTM has a 5 m pixel size; the route samples
// are spaced ~10 m apart to keep interpolation smooth while retaining detail.
export const POSILLIPO_ELEVATION_PROFILE_M = [
  2.06, 2.07, 2.03, 1.98, 1.96, 2, 2.16, 2.36, 2.43, 2.31,
  2.15, 2.03, 2.34, 2.99, 3.82, 5.15, 7.16, 7.22, 6.68, 7.15,
  7.22, 8.02, 8.47, 9.14, 9.33, 8.4, 9.68, 7.77, 13.98, 11.49,
  13.8, 18.76, 17.77, 16.25, 18.88, 21.92, 22.25, 26.36, 28.75, 28.65,
  28.91, 27.96, 29.57, 30.95, 32.9, 33.61, 37.6, 38.35, 37.97, 39.99,
  41.27, 45.28, 42.46, 43.46, 42.73, 40.8, 45.69, 46.76, 48.32, 48.64,
  50.82, 52.29, 52.93, 53.03, 53.08, 53.68, 52.52, 56.39, 55.79, 58.66,
  59.14, 60.78, 60.59, 60.33, 61.87, 63.71, 63.06, 63.38, 64.98, 68.48,
  66.75, 76.57, 78.49, 76.66, 73.02, 75.33, 75.06, 77.27, 78.1, 78.87,
  80.23,
];
const WALKABLE = new Set(['primary', 'secondary', 'tertiary', 'residential', 'service', 'footway', 'steps', 'path', 'pedestrian']);
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

class MinHeap {
  constructor() { this.items = []; }
  push(value) {
    const a = this.items;
    let i = a.length;
    a.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].d <= value.d) break;
      a[i] = a[p]; i = p;
    }
    a[i] = value;
  }
  pop() {
    const a = this.items;
    if (!a.length) return null;
    const first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        if (l >= a.length) break;
        const c = r < a.length && a[r].d < a[l].d ? r : l;
        if (a[c].d >= last.d) break;
        a[i] = a[c]; i = c;
      }
      a[i] = last;
    }
    return first;
  }
  get length() { return this.items.length; }
}

const pointKey = p => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
const distance2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const MAP_BUILDING_CELL = 32;
const decodeGrid = bits => {
  if (!bits) return null;
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(bits, 'base64'));
  return Uint8Array.from(atob(bits), char => char.charCodeAt(0));
};

export function routeBetween(map, start, end) {
  const points = new Map(), graph = new Map();
  const inSearchArea = p => p[0] >= -380 && p[0] <= 520 && p[1] >= -250 && p[1] <= 520;
  for (const road of map.roads || []) {
    if (!WALKABLE.has(road.k)) continue;
    for (let i = 1; i < road.p.length; i++) {
      const a = road.p[i - 1], b = road.p[i];
      if (!inSearchArea(a) || !inSearchArea(b)) continue;
      const ka = pointKey(a), kb = pointKey(b), length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < .05) continue;
      points.set(ka, a); points.set(kb, b);
      if (!graph.has(ka)) graph.set(ka, []);
      if (!graph.has(kb)) graph.set(kb, []);
      graph.get(ka).push([kb, length]); graph.get(kb).push([ka, length]);
    }
  }
  if (!points.size) return [];
  const nearest = target => {
    let key = null, best = Infinity;
    for (const [id, p] of points) { const d = distance2(target, p); if (d < best) { best = d; key = id; } }
    return key;
  };
  const source = nearest(start), target = nearest(end);
  if (!source || !target) return [];
  const dist = new Map([[source, 0]]), parent = new Map(), heap = new MinHeap();
  heap.push({ k: source, d: 0 });
  while (heap.length) {
    const current = heap.pop();
    if (current.d !== dist.get(current.k)) continue;
    if (current.k === target) break;
    for (const [next, cost] of graph.get(current.k) || []) {
      const d = current.d + cost;
      if (d >= (dist.get(next) ?? Infinity)) continue;
      dist.set(next, d); parent.set(next, current.k); heap.push({ k: next, d });
    }
  }
  if (!dist.has(target)) return [];
  const route = [];
  for (let at = target; at !== undefined; at = parent.get(at)) {
    route.push(points.get(at));
    if (at === source) break;
  }
  route.reverse();
  return route;
}

function centroid(polygon) {
  if (!polygon?.length) return [0, 0];
  const sum = polygon.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

export class PosillipoRelief {
  constructor(map, { walkableGrid = null, lateralFadeStart = 32, lateralFadeEnd = 120 } = {}) {
    this.lateralFadeStart = lateralFadeStart;
    this.lateralFadeEnd = Math.max(lateralFadeStart + 1, lateralFadeEnd);
    this.walkableBounds = map.grid || null;
    this.walkableGrid = walkableGrid || decodeGrid(map.grid?.bits);
    this.buildingCells = new Map();
    for (const building of map.buildings || []) {
      const polygon = building.p;
      if (!Array.isArray(polygon) || polygon.length < 3) continue;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const [x, z] of polygon) { minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z); }
      const item = { polygon, minX, minZ, maxX, maxZ };
      for (let cx = Math.floor((minX - 1) / MAP_BUILDING_CELL); cx <= Math.floor((maxX + 1) / MAP_BUILDING_CELL); cx++) {
        for (let cz = Math.floor((minZ - 1) / MAP_BUILDING_CELL); cz <= Math.floor((maxZ + 1) / MAP_BUILDING_CELL); cz++) {
          const key = `${cx},${cz}`;
          let list = this.buildingCells.get(key);
          if (!list) this.buildingCells.set(key, list = []);
          list.push(item);
        }
      }
    }
    this.church = centroid((map.buildings || []).find(b => b.osm === 'way/1120756060')?.p || [[-45.8, 225.9]]);
    this.route = routeBetween(map, [249, 150], this.church);
    this.cumulative = [0];
    for (let i = 1; i < this.route.length; i++) {
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(this.route[i][0] - this.route[i - 1][0], this.route[i][1] - this.route[i - 1][1]));
    }
    this.length = this.cumulative.at(-1) || 0;
    this.cellSize = 64;
    this.segmentGrid = new Map();
    this.segmentVisits = new Uint32Array(Math.max(0, this.route.length - 1));
    this.queryStamp = 0;
    const cellKey = (x, z) => `${x},${z}`;
    for (let i = 1; i < this.route.length; i++) {
      const a = this.route[i - 1], b = this.route[i], minX = Math.floor(Math.min(a[0], b[0]) / this.cellSize), maxX = Math.floor(Math.max(a[0], b[0]) / this.cellSize), minZ = Math.floor(Math.min(a[1], b[1]) / this.cellSize), maxZ = Math.floor(Math.max(a[1], b[1]) / this.cellSize);
      for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
        const key = cellKey(x, z);
        if (!this.segmentGrid.has(key)) this.segmentGrid.set(key, []);
        this.segmentGrid.get(key).push(i - 1);
      }
    }
    this.bounds = this.route.length ? {
      minX: Math.min(...this.route.map(p => p[0])) - 250,
      maxX: Math.max(...this.route.map(p => p[0])) + 250,
      minZ: Math.min(...this.route.map(p => p[1])) - 250,
      maxZ: Math.max(...this.route.map(p => p[1])) + 250,
    } : null;
  }

  heightAt(x, z) {
    const bounds = this.bounds;
    if (!bounds || x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return 0;
    let bestSq = Infinity, distance = 0;
    const stamp = ++this.queryStamp, cellX = Math.floor(x / this.cellSize), cellZ = Math.floor(z / this.cellSize);
    const search = radius => { for (let gx = cellX - radius; gx <= cellX + radius; gx++) for (let gz = cellZ - radius; gz <= cellZ + radius; gz++) {
      const list = this.segmentGrid.get(`${gx},${gz}`); if (!list) continue;
      for (const index of list) {
        if (this.segmentVisits[index] === stamp) continue;
        this.segmentVisits[index] = stamp;
        const a = this.route[index], b = this.route[index + 1], dx = b[0] - a[0], dz = b[1] - a[1], lenSq = dx * dx + dz * dz;
        if (lenSq < .0025) continue;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lenSq));
        const px = a[0] + dx * t, pz = a[1] + dz * t, sq = (x - px) ** 2 + (z - pz) ** 2;
        if (sq < bestSq) { bestSq = sq; distance = this.cumulative[index] + Math.sqrt(lenSq) * t; }
      }
    }};
    search(2);
    if (bestSq > 90 ** 2) search(4);
    if (!Number.isFinite(bestSq)) return 0;
    const along = this.length > 0 ? Math.max(0, Math.min(POSILLIPO_ELEVATION_PROFILE_M.length - 1, distance / this.length * (POSILLIPO_ELEVATION_PROFILE_M.length - 1))) : 0;
    const index = Math.min(POSILLIPO_ELEVATION_PROFILE_M.length - 2, Math.floor(along)), mix = along - index;
    let height = POSILLIPO_ELEVATION_PROFILE_M[index] + (POSILLIPO_ELEVATION_PROFILE_M[index + 1] - POSILLIPO_ELEVATION_PROFILE_M[index]) * mix;
    const lateral = Math.sqrt(bestSq);
    height *= 1 - smoothstep(this.lateralFadeStart, this.lateralFadeEnd, lateral);

    // Keep the church footprint aligned with the regional DTM sample at its OSM centroid.
    const churchDistance = Math.hypot(x - this.church[0], z - this.church[1]);
    const churchWeight = 1 - smoothstep(12, 92, churchDistance);
    height += (POSILLIPO_CHURCH_ELEVATION_M - height) * churchWeight;
    return Math.max(0, height);
  }

  mappedSurfaceOverlaps(minX, minZ, maxX, maxZ) {
    const grid = this.walkableBounds, bits = this.walkableGrid;
    if (grid && bits) {
      const x0 = Math.max(grid.x0, Math.floor(minX)), x1 = Math.min(grid.x0 + grid.w - 1, Math.ceil(maxX) - 1);
      const z0 = Math.max(grid.y0, Math.floor(minZ)), z1 = Math.min(grid.y0 + grid.h - 1, Math.ceil(maxZ) - 1);
      let mapped = 0;
      for (let z = z0; z <= z1; z++) {
        let i = (z - grid.y0) * grid.w + x0 - grid.x0;
        for (let x = x0; x <= x1; x++, i++) if (bits[i >> 3] & (1 << (i & 7))) mapped++;
      }
      const samples = Math.max(1, (Math.ceil(maxX) - Math.floor(minX)) * (Math.ceil(maxZ) - Math.floor(minZ)));
      // A few mapped cells can sit beside a natural slope. Mask a terrain patch when
      // mapped ground occupies a meaningful part of it, so narrow alleys survive.
      if (mapped / samples >= .12) return true;
    }

    const padding = 1;
    const x0 = Math.floor((minX - padding) / MAP_BUILDING_CELL), x1 = Math.floor((maxX + padding) / MAP_BUILDING_CELL);
    const z0 = Math.floor((minZ - padding) / MAP_BUILDING_CELL), z1 = Math.floor((maxZ + padding) / MAP_BUILDING_CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      for (const building of this.buildingCells.get(`${cx},${cz}`) || []) {
        if (building.minX > maxX + padding || building.maxX < minX - padding || building.minZ > maxZ + padding || building.maxZ < minZ - padding) continue;
        // The footprint bbox is used as a conservative mask so terrain cannot cut through a facade.
        return true;
      }
    }
    return false;
  }

  terrainCellVisible(minX, minZ, maxX, maxZ, cornerHeights) {
    if (this.mappedSurfaceOverlaps(minX, minZ, maxX, maxZ)) return false;
    const heights = cornerHeights || [
      this.heightAt(minX, minZ), this.heightAt(maxX, minZ),
      this.heightAt(minX, maxZ), this.heightAt(maxX, maxZ),
    ];
    // Omit the zero-height skirt and low shoreline cells; the existing city ground and sea own those surfaces.
    return heights.every(height => height >= 1.5);
  }
}

