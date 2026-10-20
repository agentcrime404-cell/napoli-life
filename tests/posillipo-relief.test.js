import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PosillipoRelief, POSILLIPO_CHURCH_ELEVATION_M, POSILLIPO_ELEVATION_PROFILE_M, POSILLIPO_RELIEF_SOURCE, POSILLIPO_RELIEF_ATTRIBUTION } from '../client/world/posillipo-relief.js';

const map = JSON.parse(readFileSync(new URL('../client/assets/world/napoli/map/mergellina.json', import.meta.url), 'utf8'));

test('the Tredici Scese relief follows mapped access from Piazza Sannazaro to Sant’Antonio', () => {
  const relief = new PosillipoRelief(map);
  assert.ok(relief.route.length > 100, 'route should follow the imported OSM paths');
  assert.ok(relief.length > 800 && relief.length < 1100, `unexpected route length ${relief.length}`);
  assert.ok(Math.hypot(relief.route[0][0] - 249, relief.route[0][1] - 150) < 10);
  assert.ok(Math.hypot(relief.route.at(-1)[0] - relief.church[0], relief.route.at(-1)[1] - relief.church[1]) < 30);
  assert.equal(POSILLIPO_ELEVATION_PROFILE_M.length, 91);
  assert.ok(Math.abs(relief.heightAt(...relief.church) - POSILLIPO_CHURCH_ELEVATION_M) < 0.01, 'church terrace should match the sampled regional DTM height');
  assert.equal(relief.heightAt(-5000, -5000), 0, 'relief must not affect unrelated zones');
});

test('the DTM profile follows the measured uphill route without flattening real grade changes', () => {
  assert.ok(Math.abs(POSILLIPO_ELEVATION_PROFILE_M[0] - 2.06) < 0.1);
  assert.ok(Math.abs(POSILLIPO_ELEVATION_PROFILE_M.at(-1) - 80.23) < 0.1);
  assert.ok(POSILLIPO_ELEVATION_PROFILE_M.at(-1) - POSILLIPO_ELEVATION_PROFILE_M[0] > 75);
  assert.ok(POSILLIPO_ELEVATION_PROFILE_M.some((height, i) => i > 0 && height < POSILLIPO_ELEVATION_PROFILE_M[i - 1]), 'measured profile should retain local descents instead of forcing a false monotonic slope');
  assert.match(POSILLIPO_RELIEF_SOURCE, /2020.*5 m/);
  assert.match(POSILLIPO_RELIEF_ATTRIBUTION, /CC BY 4\.0/);
});

test('the interpolated hillside stays narrow instead of raising distant Mergellina blocks', () => {
  const relief = new PosillipoRelief(map);
  const end = relief.route.at(-1), before = relief.route.at(-2);
  const dx = end[0] - before[0], dz = end[1] - before[1], length = Math.hypot(dx, dz);
  const outsideHill = [end[0] - dz / length * 150, end[1] + dx / length * 150];
  assert.ok(Math.abs(relief.heightAt(...end) - POSILLIPO_CHURCH_ELEVATION_M) < .01, 'the mapped route endpoint retains its DTM height');
  assert.ok(relief.heightAt(...outsideHill) < 1, 'the height field should fade before it reaches distant city blocks');
});

test('terrain cells defer to mapped walkable ground and building footprints', () => {
  const relief = new PosillipoRelief(map);
  assert.equal(relief.terrainCellVisible(229, 398, 231, 400, [8, 8, 8, 8]), false, 'mapped street/sidewalk cells must not be covered by the terrain mesh');
  assert.equal(relief.terrainCellVisible(-50, 220, -40, 230, [80, 80, 80, 80]), false, 'the church footprint must remain above the terrain mesh');

  const grid = { x0: 0, y0: 0, w: 24, h: 24 }, bits = Buffer.alloc(Math.ceil(grid.w * grid.h / 8));
  for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) { const i = z * grid.w + x; bits[i >> 3] |= 1 << (i & 7); }
  const openHillside = new PosillipoRelief({ roads: [], buildings: [{ p: [[8, 8], [12, 8], [12, 12], [8, 12]] }], grid: { ...grid, bits: bits.toString('base64') } });
  assert.equal(openHillside.terrainCellVisible(0, 0, 6, 6, [10, 10, 10, 10]), false, 'mapped surface cells are masked');
  assert.equal(openHillside.terrainCellVisible(7, 7, 13, 13, [10, 10, 10, 10]), false, 'building footprints are masked');
  assert.equal(openHillside.terrainCellVisible(16, 16, 22, 22, [10, 10, 10, 10]), true, 'unmapped raised hillside remains visible');
});

test('OSM still contains the mapped stair sections and upper terrace', () => {
  assert.ok(map.roads.some(road => road.k === 'steps' && road.p.some(([x, z]) => x > -100 && x < 100 && z > 200 && z < 280)));
  assert.ok(map.squares.some(square => square.osm === 'way/122851273'));
  assert.ok(map.buildings.some(building => building.osm === 'way/1120756060'));
});
