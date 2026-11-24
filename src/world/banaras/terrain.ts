import * as THREE from 'three';
import { GRID, WIDTH, HEIGHT, TILE_METRES as TS, floorHeight, tileAt } from '../banarasMap';
import { Builder } from './geo';

/** Extra tiles drawn around the playable map so the ghats, river and city don't just stop. */
export const PAD = { west: 10, east: 10, north: 8 };

const inside = (x: number, y: number) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Tile for drawing: the real grid, continued beyond its edges (ghats and river carry on, city fills in). */
export function visTile(x: number, y: number): string {
  if (inside(x, y)) return GRID[y][x];
  if (y >= 39) return '~';
  if (y === 38) return '_';
  if (y >= 29) return '=';
  return '#';
}

export const isIsland = (x: number, y: number) => tileAt(x, y) === 'S' && N4.some(([dx, dy]) => tileAt(x + dx, y + dy) === 'o');

/** Ground (or water-bed) height of a tile in metres, or null for buildings. */
export function groundHeight(x: number, y: number): number | null {
  const t = visTile(x, y);
  if (t === '#' || t === 'w') return null;
  if (t === '~') return -1.2;
  if (t === 'o') return 2.8;
  if (!inside(x, y)) return y >= 38 ? 0.3 : 0.3 + (38 - y) * 0.65;
  if (isIsland(x, y)) return 4.6;
  return floorHeight(x, y);
}

const isWater = (x: number, y: number) => '~o'.includes(visTile(x, y));
const STAIRISH = new Set(['^', 'u', 'A', '_', 'm']);

/** Whether two neighbouring tiles share a continuous floor (their corners get blended). */
function joins(ax: number, ay: number, bx: number, by: number) {
  const ha = groundHeight(ax, ay);
  const hb = groundHeight(bx, by);
  if (ha === null || hb === null || isWater(ax, ay) || isWater(bx, by) || isIsland(ax, ay) || isIsland(bx, by)) return false;
  if (visTile(ax, ay) === 'P' || visTile(bx, by) === 'P') return false; // platforms and landings stay flat
  const limit = STAIRISH.has(visTile(ax, ay)) || STAIRISH.has(visTile(bx, by)) ? 2.5 : 1.6;
  return Math.abs(ha - hb) <= limit;
}

const cornerCache = new Map<number, [number, number, number, number]>();
const key = (x: number, y: number) => (y + 64) * 1024 + (x + 64);

/** Heights at a tile's NW, NE, SW, SE corners, blended with joined neighbours so slopes are continuous. */
function corners(x: number, y: number): [number, number, number, number] {
  const k = key(x, y);
  const hit = cornerCache.get(k);
  if (hit) return hit;
  const h = groundHeight(x, y) ?? 0;
  const at = (sx: number, sy: number) => {
    if (isWater(x, y) || isIsland(x, y)) return h;
    let sum = h;
    let n = 1;
    for (const [dx, dy] of [[sx, 0], [0, sy], [sx, sy]]) {
      if (joins(x, y, x + dx, y + dy)) {
        sum += groundHeight(x + dx, y + dy)!;
        n++;
      }
    }
    return sum / n;
  };
  const c: [number, number, number, number] = [at(-1, -1), at(1, -1), at(-1, 1), at(1, 1)];
  cornerCache.set(k, c);
  return c;
}

/** Number of steps a tile is split into along each axis (1 = flat). */
function stepsFor(x: number, y: number) {
  const c = corners(x, y);
  const drop = Math.max(...c) - Math.min(...c);
  return drop < 0.12 ? 1 : Math.min(8, Math.max(2, Math.ceil(drop / 0.24)));
}

/** Stepped (visual) height at fractional position (u, v) inside a tile. */
function stepHeight(x: number, y: number, u: number, v: number) {
  const k = stepsFor(x, y);
  const cu = (Math.min(k - 1, Math.floor(u * k)) + 0.5) / k;
  const cv = (Math.min(k - 1, Math.floor(v * k)) + 0.5) / k;
  const [a, b, c, d] = corners(x, y);
  return (a * (1 - cu) + b * cu) * (1 - cv) + (c * (1 - cu) + d * cu) * cv;
}

/** Smooth walking height at a world position. */
export function surfaceHeight(wx: number, wz: number) {
  const x = Math.floor(wx / TS);
  const y = Math.floor(wz / TS);
  if (groundHeight(x, y) === null) return 10;
  const u = wx / TS - x;
  const v = wz / TS - y;
  const [a, b, c, d] = corners(x, y);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Material key for a tile's walking surface. */
function surfaceKey(t: string) {
  if (t === '_') return 'wet';
  if (t === 'g' || t === 'u' || '123'.includes(t)) return 'courtStone';
  if (t === '=' || t === '^' || t === 'P') return 'ghat';
  return 'paving';
}

export type ArcadeEdge = { x: number; y: number; dx: number; dy: number };

export function buildTerrain(materials: Record<string, THREE.Material>) {
  const b = new Builder();
  const arcade: ArcadeEdge[] = [];
  const SEG = 8;

  for (let y = -PAD.north; y < HEIGHT; y++) {
    for (let x = -PAD.west; x < WIDTH + PAD.east; x++) {
      const h = groundHeight(x, y);
      const t = visTile(x, y);
      if (h === null || isWater(x, y)) continue;
      const x0 = x * TS;
      const z0 = y * TS;
      const k = stepsFor(x, y);
      const top = b.set(surfaceKey(t));
      const riser = b.set(t === '_' ? 'wetRiser' : 'riser');

      // Treads.
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < k; i++) {
          const hy = stepHeight(x, y, (i + 0.5) / k, (j + 0.5) / k);
          top.top(x0 + (i * TS) / k, z0 + (j * TS) / k, x0 + ((i + 1) * TS) / k, z0 + ((j + 1) * TS) / k, hy);
        }
      }
      // Risers between steps inside the tile.
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < k; i++) {
          const here = stepHeight(x, y, (i + 0.5) / k, (j + 0.5) / k);
          if (i + 1 < k) {
            const right = stepHeight(x, y, (i + 1.5) / k, (j + 0.5) / k);
            const xs = x0 + ((i + 1) * TS) / k;
            const za = z0 + (j * TS) / k;
            const zb = z0 + ((j + 1) * TS) / k;
            if (here > right) riser.wall(xs, za, xs, zb, right, here, 1, 0);
            else if (right > here) riser.wall(xs, za, xs, zb, here, right, -1, 0);
          }
          if (j + 1 < k) {
            const below = stepHeight(x, y, (i + 0.5) / k, (j + 1.5) / k);
            const zs = z0 + ((j + 1) * TS) / k;
            const xa = x0 + (i * TS) / k;
            const xb = x0 + ((i + 1) * TS) / k;
            if (here > below) riser.wall(xa, zs, xb, zs, below, here, 0, 1);
            else if (below > here) riser.wall(xa, zs, xb, zs, here, below, 0, -1);
          }
        }
      }
      // Risers along the tile's edges, down to lower neighbours or water.
      for (const [dx, dy] of N4) {
        const nh = groundHeight(x + dx, y + dy);
        if (nh === null) continue; // a building wall covers this edge
        const galleryEdge = t === 'g' && !'gu'.includes(visTile(x + dx, y + dy)) && !isWater(x + dx, y + dy);
        if (galleryEdge) arcade.push({ x, y, dx, dy });
        for (let s = 0; s < SEG; s++) {
          const f = (s + 0.5) / SEG;
          const [u, v] = dx ? [dx > 0 ? 0.999 : 0.001, f] : [f, dy > 0 ? 0.999 : 0.001];
          const hereH = stepHeight(x, y, u, v);
          const thereH = isWater(x + dx, y + dy) ? nh : stepHeight(x + dx, y + dy, dx ? (dx > 0 ? 0.001 : 0.999) : f, dy ? (dy > 0 ? 0.001 : 0.999) : f);
          if (hereH <= thereH + 0.01) continue;
          const low = galleryEdge ? hereH - 0.45 : thereH; // gallery: only the slab lip; arches fill below
          if (dx) {
            const xs = x0 + (dx > 0 ? TS : 0);
            riser.wall(xs, z0 + (s * TS) / SEG, xs, z0 + ((s + 1) * TS) / SEG, low, hereH, dx, 0);
          } else {
            const zs = z0 + (dy > 0 ? TS : 0);
            riser.wall(x0 + (s * TS) / SEG, zs, x0 + ((s + 1) * TS) / SEG, zs, low, hereH, 0, dy);
          }
        }
      }
      // The arcade floor under the gallery.
      if (t === 'g') b.set('arcadeFloor').top(x0, z0, x0 + TS, z0 + TS, 10);
    }
  }

  const meshes = b.meshes(materials, { paving: 3, ghat: 3, wet: 3, courtStone: 3, riser: 2.5, wetRiser: 2.5, arcadeFloor: 3 });
  return { meshes, arcade };
}

/** River (y = 0) and the stepwell pool (y = 4). */
export function buildWater(river: THREE.Material, pool: THREE.Material) {
  const g = new THREE.PlaneGeometry(600, 300);
  g.rotateX(-Math.PI / 2);
  g.translate(WIDTH, 0, 39 * TS + 150);
  const riverMesh = new THREE.Mesh(g, river);
  riverMesh.receiveShadow = true;
  const b = new Builder();
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (GRID[y][x] === 'o') b.set('pool').top(x * TS, y * TS, x * TS + TS, y * TS + TS, 4);
  const poolMeshes = b.meshes({ pool }, {}, { cast: false });
  return [riverMesh, ...poolMeshes];
}
