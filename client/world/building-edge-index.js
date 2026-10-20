// Spatial index for the closest facade edge around a street-level POI.
// Entries are inserted in source order so equal-distance ties match the old
// full-scene scan exactly. A point within radius is guaranteed to be in the
// edge's expanded bounding-box cell.
export function createBuildingEdgeIndex(buildings, { cellSize = 32, radius = 8 } = {}) {
  if (!(cellSize > 0) || !(radius >= 0)) throw new RangeError('Invalid building edge grid dimensions');
  const buckets = new Map(), key = (x, y) => `${x},${y}`;
  for (const building of buildings || []) {
    const points = building?.p;
    if (!Array.isArray(points) || points.length < 2) continue;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], c = points[(i + 1) % points.length];
      const dx = c[0] - a[0], dy = c[1] - a[1], lenSq = dx * dx + dy * dy;
      if (lenSq < 1) continue;
      const edge = { ax: a[0], ay: a[1], dx, dy, lenSq, invLen: 1 / Math.sqrt(lenSq) };
      const minX = Math.floor((Math.min(a[0], c[0]) - radius) / cellSize);
      const maxX = Math.floor((Math.max(a[0], c[0]) + radius) / cellSize);
      const minY = Math.floor((Math.min(a[1], c[1]) - radius) / cellSize);
      const maxY = Math.floor((Math.max(a[1], c[1]) + radius) / cellSize);
      for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
        const k = key(gx, gy);
        let list = buckets.get(k);
        if (!list) buckets.set(k, list = []);
        list.push(edge);
      }
    }
  }

  return (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const edges = buckets.get(key(Math.floor(x / cellSize), Math.floor(y / cellSize)));
    if (!edges) return null;
    let best = null, bestSq = radius * radius;
    for (const edge of edges) {
      const { ax, ay, dx, dy, lenSq, invLen } = edge;
      const t = Math.max(.15, Math.min(.85, ((x - ax) * dx + (y - ay) * dy) / lenSq));
      const fx = ax + dx * t, fy = ay + dy * t, sq = (fx - x) ** 2 + (fy - y) ** 2;
      if (sq < bestSq) {
        bestSq = sq;
        let nx = -dy * invLen, ny = dx * invLen;
        if (nx * (x - fx) + ny * (y - fy) < 0) { nx = -nx; ny = -ny; }
        best = { x: fx, y: fy, nx, ny };
      }
    }
    return best;
  };
}
