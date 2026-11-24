import * as THREE from 'three';
import { GRID, WIDTH, HEIGHT, TILE_METRES as TS, ZONES, generateHouses, type HouseStyle } from '../banarasMap';
import { Builder, hash, ownCell, type QuadSet } from './geo';
import { BM, cellCut, CELL_SHADOW, type BMKey } from './materials';
import { groundHeight, visTile, PAD } from './terrain';
import { chhatri } from './landmarks';
import { onionDome } from '../kit';

/** A building that can dissolve when it hides the player. */
export type Occluder = { object: THREE.Object3D; fades: { value: number }[]; fade: number; cells?: boolean };

/** Highest point of the building on each map cell (for the per-cell cutaway's sight-line test). */
export const CELL_TOPS = new Float32Array(WIDTH * HEIGHT);
const raiseTop = (x: number, y: number, top: number) => {
  if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) CELL_TOPS[y * WIDTH + x] = Math.max(CELL_TOPS[y * WIDTH + x], top);
};

const STOREY = 3;
const BOTTOM = -1.4; // walls reach below the river bed so no gaps show
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const STYLE_WALL: Record<HouseStyle, BMKey> = { blue: 'blue', ochre: 'ochre', sandstone: 'sandstone', pink: 'pink', white: 'white' };
const STYLE_TRIM: Record<HouseStyle, BMKey> = { blue: 'trimWhite', ochre: 'trim', sandstone: 'trim', pink: 'trimWhite', white: 'trim' };
const ROOF_MATS: BMKey[] = ['roof', 'roofLime', 'roofGrey', 'roofRose', 'roofLime'];

type Block = {
  inBlock: (x: number, y: number) => boolean;
  tiles: [number, number][];
  roof: number;
  wall: BMKey;
  door?: { x: number; y: number; dx: number; dy: number };
  stoop?: boolean;
  jharokha?: boolean;
  terrace?: boolean;
  /** Plain carved faces instead of windows (temple-like enclosures). */
  carved?: boolean;
  jali?: BMKey;
  seed: number;
  /** Trim colour (cornices, frames, parapet coping). */
  trim?: BMKey;
  /** Roof surface. */
  roofMat?: BMKey;
  /** Parapet style: 0 plain, 1 merlons, 2 jali screen, 3 terracotta eave. */
  parapet?: number;
  /** Rooftop rooms: walls start here (the parent roof) and every face looks onto a roof. */
  base?: number;
  /** Interior floor level, shown when the front cut opens the house up. */
  floor?: number;
};

/** Roof height of every building tile in the city, filled before any geometry is built. */
const ROOFS = new Map<number, number>();
const roofKey = (x: number, y: number) => (y + 64) * 1024 + (x + 64);

/** Geometry helpers for one face of a tile: u runs 0..TS along the face, o is the outward offset. */
class Face {
  constructor(private x: number, private y: number, private dx: number, private dy: number) {}
  private get plane() {
    return this.dx > 0 ? (this.x + 1) * TS : this.dx < 0 ? this.x * TS : this.dy > 0 ? (this.y + 1) * TS : this.y * TS;
  }
  private get start() {
    return this.dx ? this.y * TS : this.x * TS;
  }
  private get sign() {
    return this.dx || this.dy;
  }
  /** World (x, z) of a point u along the face, o in front of it. */
  private at(u: number, o: number): [number, number] {
    const p = this.plane + this.sign * o;
    return this.dx ? [p, this.start + u] : [this.start + u, p];
  }
  /** Flat panel parallel to the face. */
  rect(set: QuadSet, u0: number, u1: number, y0: number, y1: number, off = 0.03, decal = false) {
    const [ax, az] = this.at(u0, off);
    const [bx, bz] = this.at(u1, off);
    set.wall(ax, az, bx, bz, y0, y1, this.dx, this.dy, decal);
  }
  decal(set: QuadSet, u0: number, u1: number, y0: number, y1: number, off = 0.03) {
    this.rect(set, u0, u1, y0, y1, off, true);
  }
  /** Panel perpendicular to the face at position u, from offset o0 to o1, facing +u (dir 1) or −u (dir −1). */
  side(set: QuadSet, u: number, y0: number, y1: number, o0: number, o1: number, dir: number) {
    const [ax, az] = this.at(u, o0);
    const [bx, bz] = this.at(u, o1);
    set.wall(ax, az, bx, bz, y0, y1, this.dx ? 0 : dir, this.dx ? dir : 0);
  }
  /** Horizontal panel spanning u0..u1 and o0..o1 at height y. */
  flat(set: QuadSet, u0: number, u1: number, y: number, o0: number, o1: number, down = false) {
    const [ax, az] = this.at(u0, o0);
    const [bx, bz] = this.at(u1, o1);
    set.top(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), y, down);
  }
  /** Box sticking out of the face by `depth` (starting `from` in front of it). */
  box(set: QuadSet, u0: number, u1: number, y0: number, y1: number, depth: number, from = 0) {
    const [ax, az] = this.at(u0, from);
    const [bx, bz] = this.at(u1, from + depth);
    set.box(Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz));
  }
}

/** A hole cut into a wall and recessed: the back panel sits `depth` behind the face. */
type Opening = { u0: number; u1: number; y0: number; y1: number; depth: number; back: BMKey; decal: boolean };

/** Decide what goes on one street-facing face of a tile, storey by storey. */
function planFace(blk: Block, x: number, y: number, dx: number, dy: number, lane: number, onRoof: boolean) {
  const openings: Opening[] = [];
  const extras: ((b: Builder, f: Face) => void)[] = [];
  const isDoor = !!blk.door && blk.door.x === x && blk.door.y === y && blk.door.dx === dx && blk.door.dy === dy;
  if (blk.carved) return { openings, extras, isDoor };

  for (let s = 0; lane + (s + 1) * STOREY <= blk.roof + 0.01; s++) {
    const yb = lane + s * STOREY;
    const r = hash(x, y, dx, dy, s, blk.seed);
    if (s === 0 && (!onRoof || isDoor)) {
      if (isDoor) {
        const door = (['door', 'decDoorBlue', 'decDoorGreen'] as const)[Math.floor(hash(blk.seed, 5) * 3)];
        openings.push({ u0: 0.45, u1: 1.55, y0: yb + 0.35, y1: yb + 2.55, depth: 0.45, back: door, decal: true });
        extras.push((b, f) => {
          const trim = b.set(blk.trim ?? 'trim');
          f.box(trim, 0.25, 0.45, yb + 0.35, yb + 2.75, 0.16); // jambs
          f.box(trim, 1.55, 1.75, yb + 0.35, yb + 2.75, 0.16);
          f.box(trim, 0.15, 1.85, yb + 2.75, yb + 3.0, 0.22); // lintel
          f.box(trim, 0.35, 1.65, yb + 0.2, yb + 0.35, 0.35); // threshold step
          if (blk.stoop && !onRoof) f.box(trim, 0.05, 1.95, yb - 0.2, yb + 0.5, 0.9);
        });
      } else if (r < 0.24) {
        openings.push({ u0: 0.2, u1: 1.8, y0: yb + 0.45, y1: yb + 2.4, depth: 1.1, back: 'decShop', decal: true });
        const cloth = (['clothSaffron', 'clothMagenta', 'clothTeal', 'clothIndigo', 'bandhani'] as const)[Math.floor(r * 50) % 5];
        extras.push((b, f) => {
          f.box(b.set('wood'), 0.2, 1.8, yb + 0.35, yb + 0.95, 0.55, -0.2); // counter
          f.box(b.set(cloth), 0.05, 1.95, yb + 2.5, yb + 2.58, 0.95); // awning
        });
      } else if (r < 0.32) {
        extras.push((b, f) => f.decal(b.set('decMural'), 0.25, 1.75, yb + 0.7, yb + 2.2, 0.02));
      } else if (r < 0.4) {
        openings.push({ u0: 0.7, u1: 1.3, y0: yb + 0.8, y1: yb + 1.8, depth: 0.3, back: 'decNiche', decal: true });
      }
      continue;
    }
    if (isDoor && blk.jharokha && s === 1) continue;
    if (r < (onRoof ? 0.62 : 0.46)) {
      const arched = r < 0.2;
      const [y0, y1] = [yb + 0.65, yb + (arched ? 2.35 : 2.2)];
      openings.push({ u0: 0.55, u1: 1.45, y0, y1, depth: 0.3, back: arched ? 'decWinArch' : 'decWinShutters', decal: true });
      extras.push((b, f) => {
        const trim = b.set(blk.trim ?? 'trim');
        f.box(trim, 0.42, 1.58, y0 - 0.14, y0, 0.2); // sill
        f.box(trim, 0.42, 0.55, y0, y1, 0.1); // frame
        f.box(trim, 1.45, 1.58, y0, y1, 0.1);
        f.box(b.set(hash(x, y, s) < 0.5 ? 'terracotta' : 'trim'), 0.3, 1.7, y1 + 0.1, y1 + 0.2, 0.5); // chhajja hood
      });
    } else if (r < 0.54) {
      extras.push((b, f) => {
        const trim = b.set(blk.trim ?? 'trim');
        f.box(trim, 0.15, 1.85, yb + 0.45, yb + 0.6, 0.65);
        f.decal(b.set('decJharokha'), 0.2, 1.8, yb + 0.6, yb + 2.3, 0.62);
        f.side(trim, 0.2, yb + 0.6, yb + 2.3, 0, 0.62, -1);
        f.side(trim, 1.8, yb + 0.6, yb + 2.3, 0, 0.62, 1);
        f.box(b.set('terracotta'), 0.05, 1.95, yb + 2.3, yb + 2.5, 0.85, -0.1);
        f.box(trim, 0.4, 0.55, yb + 0.05, yb + 0.45, 0.5);
        f.box(trim, 1.45, 1.6, yb + 0.05, yb + 0.45, 0.5);
      });
    }
  }

  // The house's own jharokha, projecting over its door.
  if (isDoor && blk.jharokha && lane + 2 * STOREY <= blk.roof) {
    const yb = lane + STOREY;
    extras.push((b, f) => {
      const trim = b.set(blk.trim ?? 'trim');
      f.box(trim, 0.1, 1.9, yb + 0.3, yb + 0.55, 0.85);
      f.box(trim, 0.1, 0.25, yb + 0.55, yb + 2.15, 0.85);
      f.box(trim, 1.75, 1.9, yb + 0.55, yb + 2.15, 0.85);
      f.decal(b.set('decJharokha'), 0.25, 1.75, yb + 0.55, yb + 2.15, 0.8);
      f.box(b.set('terracotta'), 0.0, 2.0, yb + 2.15, yb + 2.45, 1.05, -0.1);
      f.box(trim, 0.35, 0.5, yb - 0.3, yb + 0.3, 0.6);
      f.box(trim, 1.5, 1.65, yb - 0.3, yb + 0.3, 0.6);
    });
  }
  return { openings, extras, isDoor };
}

/** One street-facing face: wall with holes, recessed openings, pilasters, cornices, details. */
function streetFace(b: Builder, blk: Block, wall: QuadSet, x: number, y: number, dx: number, dy: number, lane: number, onRoof = false) {
  const f = new Face(x, y, dx, dy);
  const trim = b.set(blk.trim ?? 'trim');
  if (GRID[y]?.[x] === 'w') {
    // A great carved screen glowing with the lamps behind it.
    f.rect(wall, 0, TS, BOTTOM, lane + 0.35, 0);
    f.rect(wall, 0, TS, lane + 3.4, blk.roof, 0);
    f.rect(b.set(blk.jali ?? 'jaliBright'), 0.15, TS - 0.15, lane + 0.35, lane + 3.4, -0.15);
    f.rect(wall, 0, 0.15, lane + 0.35, lane + 3.4, 0);
    f.rect(wall, TS - 0.15, TS, lane + 0.35, lane + 3.4, 0);
    f.box(trim, 0, TS, lane + 3.4, lane + 3.75, 0.2);
    return;
  }
  const { openings, extras } = planFace(blk, x, y, dx, dy, lane, onRoof);
  openings.sort((a, c) => a.y0 - c.y0);
  // Wall with holes: full-width bands between openings, side strips beside them.
  let yCur = blk.base ?? BOTTOM;
  for (const o of openings) {
    f.rect(wall, 0, TS, yCur, o.y0, 0);
    f.rect(wall, 0, o.u0, o.y0, o.y1, 0);
    f.rect(wall, o.u1, TS, o.y0, o.y1, 0);
    yCur = o.y1;
    // Recess: back panel and reveals.
    f.rect(b.set(o.back), o.u0, o.u1, o.y0, o.y1, -o.depth, o.decal);
    f.side(wall, o.u0, o.y0, o.y1, -o.depth, 0, 1);
    f.side(wall, o.u1, o.y0, o.y1, -o.depth, 0, -1);
    f.flat(trim, o.u0, o.u1, o.y1, -o.depth, 0, true);
    f.flat(trim, o.u0, o.u1, o.y0, -o.depth, 0);
  }
  f.rect(wall, 0, TS, yCur, blk.roof, 0);

  // Plinth, pilasters and storey cornices give every facade relief.
  if (!onRoof) f.box(trim, 0, TS, lane - 0.2, lane + 0.35, 0.1);
  if (!blk.carved) {
    // Pilasters only at the house's own corners, where this frontage ends.
    const [ax, ay, bx, by] = dx ? [x, y - 1, x, y + 1] : [x - 1, y, x + 1, y];
    if (!blk.inBlock(ax, ay)) f.box(trim, 0, 0.22, lane, blk.roof, 0.14);
    if (!blk.inBlock(bx, by)) f.box(trim, TS - 0.22, TS, lane, blk.roof, 0.14);
  }
  for (let yb = lane + STOREY; yb < blk.roof - 0.4; yb += STOREY) f.box(trim, 0, TS, yb - 0.16, yb + 0.06, 0.24);
  for (const e of extras) e(b, f);
}

function parapet(b: Builder, blk: Block, f: Face, wall: QuadSet) {
  const trim = b.set(blk.trim ?? 'trim');
  const r = blk.roof;
  switch (blk.parapet ?? Math.floor(hash(blk.seed, 41) * 4)) {
    case 1: // kangura merlons
      f.box(trim, 0, TS, r, r + 0.35, 0.3, -0.3);
      for (let u = 0.35; u < TS - 0.3; u += 1.0) f.box(trim, u, u + 0.32, r + 0.35, r + 0.8, 0.3, -0.3);
      break;
    case 2: // pierced jali screen between stone posts
      f.box(trim, 0, TS, r, r + 0.15, 0.28, -0.28);
      f.rect(b.set('jaliStone'), 0.15, TS - 0.15, r + 0.15, r + 0.75, -0.14, true);
      f.box(trim, 0, 0.15, r, r + 0.85, 0.28, -0.28);
      f.box(trim, 0, TS, r + 0.75, r + 0.88, 0.32, -0.3);
      break;
    case 3: // terracotta eave with a low lip
      f.box(b.set('terracotta'), 0, TS, r - 0.4, r - 0.18, 0.7);
      f.box(wall, 0, TS, r, r + 0.3, 0.22, -0.22);
      break;
    default: // plain parapet with coping
      f.box(wall, 0, TS, r, r + 0.6, 0.24, -0.24);
      f.box(trim, 0, TS, r + 0.6, r + 0.7, 0.32, -0.28);
  }
}

function buildBlock(blk: Block, b: Builder, extraObjects?: THREE.Object3D[]) {
  const wall = b.set(blk.wall);
  const outer = blk.carved ? b.set('carved') : wall;
  const bottom = blk.base ?? BOTTOM;
  for (const [x, y] of blk.tiles) {
    const x0 = x * TS;
    const z0 = y * TS;
    b.owner = [x, y];
    raiseTop(x, y, blk.roof + 0.9);
    b.set(blk.roofMat ?? 'roof').top(x0, z0, x0 + TS, z0 + TS, blk.roof);
    if (blk.floor !== undefined) b.set('arcadeFloor').top(x0, z0, x0 + TS, z0 + TS, blk.floor + 0.05); // seen when cut away
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (blk.inBlock(nx, ny)) {
        // Inside wall towards the neighbouring cell: hidden until that cell is cut away.
        new Face(x, y, dx, dy).rect(b.set('interior'), 0, TS, blk.base ?? BOTTOM, blk.roof, -0.01);
        continue;
      }
      const f = new Face(x, y, dx, dy);
      // What does this wall look out over? A lane, a neighbour's lower roof, or nothing worth windows.
      const ground = groundHeight(nx, ny);
      const below = ROOFS.get(roofKey(nx, ny));
      let lane: number | null = null;
      let onRoof = false;
      if (blk.base !== undefined) [lane, onRoof] = [blk.base, true];
      else if (ground !== null && visTile(nx, ny) !== '~') lane = Math.max(ground, BOTTOM);
      else if (below !== undefined && blk.roof - below >= 2.6) [lane, onRoof] = [below, true];
      if (lane !== null) streetFace(b, blk, outer, x, y, dx, dy, lane, onRoof);
      else f.rect(wall, 0, TS, bottom, blk.roof, 0);
      parapet(b, blk, f, wall);
    }
  }
  const pick = (k: number) => blk.tiles[Math.floor(hash(blk.seed, k) * blk.tiles.length)];
  if (blk.base !== undefined) return; // rooftop rooms stop here
  // Rooftop room (barsati) at the back of bigger houses: its own windows, door and roof.
  let room: [number, number][] = [];
  if (extraObjects && blk.base === undefined && blk.door && blk.tiles.length >= 4 && hash(blk.seed, 51) < 0.6) {
    const d = blk.door;
    const far = [...blk.tiles].sort((p, q) => Math.hypot(q[0] - d.x, q[1] - d.y) - Math.hypot(p[0] - d.x, p[1] - d.y));
    room = [far[0]];
    const next = far.slice(1).find(([a, c]) => Math.abs(a - far[0][0]) + Math.abs(c - far[0][1]) === 1);
    if (next && hash(blk.seed, 52) < 0.6) room.push(next);
    const inRoom = (a: number, c: number) => room.some(([p, q]) => p === a && q === c);
    const doorTile = room.map(([p, q]) => {
      const dir = N4.find(([ddx, ddy]) => blk.inBlock(p + ddx, q + ddy) && !inRoom(p + ddx, q + ddy));
      return dir ? { x: p, y: q, dx: dir[0], dy: dir[1] } : undefined;
    }).find(Boolean);
    const roomRoof = blk.roof + STOREY;
    const curved = hash(blk.seed, 53) < 0.35;
    for (const [p, q] of room) raiseTop(p, q, roomRoof + 2.2);
    buildBlock({
      inBlock: inRoom,
      tiles: room,
      roof: roomRoof,
      base: blk.roof,
      wall: blk.wall,
      trim: blk.trim,
      roofMat: curved ? 'roofTile' : (['roofLime', 'roofRose', 'roof'] as const)[Math.floor(hash(blk.seed, 54) * 3)],
      parapet: curved ? 3 : hash(blk.seed, 55) < 0.5 ? 2 : 0,
      door: doorTile,
      seed: blk.seed * 7 + 1,
    }, b, extraObjects);
    if (curved) {
      // Bangaldar roof: a curved terracotta vault over the room.
      const [p, q] = room[0];
      const along = room.length > 1 && room[1][1] === q;
      const len = room.length * TS;
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, len, 10, 1, false, 0, Math.PI), BM.roofTile);
      vault.rotation.set(0, along ? 0 : Math.PI / 2, Math.PI / 2);
      vault.scale.set(0.55, 1, 1);
      const cx = (along ? Math.min(p, room[1][0]) * TS + len / 2 : p * TS + 1);
      const cz = (!along && room.length > 1 ? Math.min(q, room[1][1]) * TS + len / 2 : q * TS + 1);
      vault.position.set(cx, roomRoof, cz);
      vault.castShadow = vault.receiveShadow = true;
      extraObjects.push(ownCell(vault, p, q));
    } else if (hash(blk.seed, 56) < 0.4) {
      const [p, q] = room[0];
      const dome = onionDome(0.75, 1.3, BM.whitewash);
      dome.position.set(p * TS + 1, roomRoof + 0.05, q * TS + 1);
      extraObjects.push(ownCell(dome, p, q));
    }
  }
  const openRoof = blk.tiles.filter(([a, c]) => !room.some(([p, q]) => p === a && q === c));
  const spot = (k: number) => openRoof[Math.floor(hash(blk.seed, k) * openRoof.length)];
  // Life on the roof: water tank, potted plants, a charpai.
  if (openRoof.length && blk.base === undefined) {
    if (hash(blk.seed, 61) < 0.35) {
      const [p, q] = spot(62);
      b.owner = [p, q];
      const cx = p * TS + 1;
      const cz = q * TS + 1;
      b.set(hash(blk.seed, 63) < 0.5 ? 'white' : 'blue').box(cx - 0.45, blk.roof, cz - 0.45, cx + 0.45, blk.roof + 1.05, cz + 0.45);
      b.set('trimWhite').box(cx - 0.5, blk.roof + 1.05, cz - 0.5, cx + 0.5, blk.roof + 1.15, cz + 0.5);
    }
    if (hash(blk.seed, 64) < 0.5) {
      const [p, q] = spot(65);
      b.owner = [p, q];
      for (let i = 0; i < 3; i++) {
        const cx = p * TS + 0.45 + i * 0.55;
        const cz = q * TS + 0.4;
        b.set('clay').box(cx - 0.17, blk.roof, cz - 0.17, cx + 0.17, blk.roof + 0.35, cz + 0.17);
        b.set('foliage').box(cx - 0.24, blk.roof + 0.35, cz - 0.24, cx + 0.24, blk.roof + 0.75 + hash(blk.seed, i) * 0.3, cz + 0.24);
      }
    }
    if (hash(blk.seed, 66) < 0.22) {
      const [p, q] = spot(67);
      b.owner = [p, q];
      const cx = p * TS + 1;
      const cz = q * TS + 1;
      const wood = b.set('wood');
      for (const [ox, oz] of [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]]) wood.box(cx + ox - 0.05, blk.roof, cz + oz - 0.05, cx + ox + 0.05, blk.roof + 0.45, cz + oz + 0.05);
      b.set('clothWhite').box(cx - 0.9, blk.roof + 0.42, cz - 0.45, cx + 0.9, blk.roof + 0.5, cz + 0.45);
    }
  }
  // Rooftop stair hut (mumty) on bigger houses.
  if (!room.length && blk.base === undefined && blk.tiles.length >= 6 && hash(blk.seed, 11) < 0.3) {
    const [x, y] = pick(12);
    b.owner = [x, y];
    raiseTop(x, y, blk.roof + 2.5);
    const cx = x * TS + 1;
    const cz = y * TS + 1;
    wall.box(cx - 0.8, blk.roof, cz - 0.8, cx + 0.8, blk.roof + 2.3, cz + 0.8);
    b.set(blk.trim ?? 'trim').box(cx - 0.95, blk.roof + 2.3, cz - 0.95, cx + 0.95, blk.roof + 2.45, cz + 0.95);
    b.set('dark').wall(cx - 0.4, cz + 0.81, cx + 0.4, cz + 0.81, blk.roof, blk.roof + 1.9, 0, 1);
  }
  // Chhatri crowning some of the taller havelis.
  if (extraObjects && blk.roof >= 19 && hash(blk.seed, 21) < 0.18) {
    const [x, y] = pick(22);
    const c = chhatri(1.7);
    c.position.set(x * TS + 1, blk.roof, y * TS + 1);
    raiseTop(x, y, blk.roof + 3.2);
    extraObjects.push(ownCell(c, x, y));
  }
  if (blk.terrace && blk.tiles.length && hash(blk.seed, 31) < 0.55) {
    // Laundry strung across the roof.
    const [x, y] = pick(3);
    b.owner = [x, y];
    const cx = x * TS + 1;
    const cz = y * TS + 1;
    const wood = b.set('wood');
    wood.box(cx - 0.9, blk.roof, cz - 0.05, cx - 0.8, blk.roof + 1.7, cz + 0.05);
    wood.box(cx + 0.8, blk.roof, cz - 0.05, cx + 0.9, blk.roof + 1.7, cz + 0.05);
    const cloths = ['clothSaffron', 'clothMagenta', 'clothTeal', 'clothWhite', 'clothIndigo', 'bandhani'];
    for (let i = 0; i < 3; i++) {
      const c = b.set(cloths[Math.floor(hash(blk.seed, i) * cloths.length)]);
      const u = cx - 0.75 + i * 0.52;
      c.wall(u, cz, u + 0.45, cz, blk.roof + 0.7 + hash(blk.seed, i, 9) * 0.3, blk.roof + 1.65, 0, 1);
    }
  }
}

const TILE_SIZES = { interior: 2, roof: 3, roofLime: 3, roofGrey: 3, roofRose: 3, roofTile: 1.5, trim: 1.5, trimWhite: 1.5, carved: 3, jali: 1.6, jaliBright: 2.6, terracotta: 1.5 };

function occluderFrom(blk: Block): Occluder {
  const b = new Builder();
  const extra: THREE.Object3D[] = [];
  buildBlock(blk, b, extra);
  const group = new THREE.Group();
  group.add(...b.meshes((key) => BM[key as BMKey], TILE_SIZES), ...extra);
  // Per-cell cutaway: one stub line for the building, cut values per map cell (see materials.ts).
  const stub = { value: (blk.floor ?? 10) + 0.9 };
  const cache = new Map<THREE.Material, THREE.Material>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    let c = cache.get(mat);
    if (!c) cache.set(mat, (c = cellCut(mat, stub)));
    m.material = c;
    m.customDepthMaterial = CELL_SHADOW;
  });
  return { object: group, fades: [], fade: 0, cells: true };
}

export function buildCity() {
  const { houses, owner } = generateHouses();
  const zoneTiles = (id: string) => {
    const z = ZONES.find((q) => q.id === id)!;
    return (x: number, y: number) => x >= z.rect[0] && x <= z.rect[2] && y >= z.rect[1] && y <= z.rect[3] && '#w'.includes(GRID[y]?.[x] ?? '');
  };
  // Phase 1: decide every block (and its roof height) before building anything, so each wall
  // knows whether it rises above its neighbour's roof and should get windows there.
  const fading: Block[] = [];
  const background: Block[] = [];

  for (const h of houses) {
    const lane = groundHeight(h.door.x + h.door.dx, h.door.y + h.door.dy) ?? 10;
    fading.push({
      inBlock: (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && owner[y * WIDTH + x] === h.id,
      tiles: h.tiles,
      roof: lane + h.storeys * STOREY,
      floor: lane,
      wall: STYLE_WALL[h.style],
      trim: STYLE_TRIM[h.style],
      roofMat: ROOF_MATS[Math.floor(hash(h.id, 71) * ROOF_MATS.length)],
      parapet: hash(h.id, 41) < 0.22 ? 1 : Math.floor(hash(h.id, 42) * 3) === 0 ? 3 : hash(h.id, 43) < 0.5 ? 2 : 0,
      door: h.door,
      stoop: h.stoop,
      jharokha: h.jharokha,
      terrace: h.terrace,
      seed: h.id,
    });
  }

  // Walled landmarks built as blocks. The stepwell enclosure is split so its south wall can
  // dissolve without taking the backdrop with it.
  const enclosure = zoneTiles('lampsEnclosure');
  const natya = zoneTiles('natyaHaveli');
  const parts: [string, (x: number, y: number) => boolean, number, BMKey, boolean][] = [
    ['lampsSouth', (x, y) => enclosure(x, y) && y >= 11, 16, 'sandstone', true],
    ['lampsRest', (x, y) => enclosure(x, y) && y < 11, 16, 'sandstone', true],
    ['natyaSouth', (x, y) => natya(x, y) && y >= 12, 17, 'sandstone', false],
    ['natyaRest', (x, y) => natya(x, y) && y < 12, 17, 'sandstone', false],
  ];
  for (const [id, inBlock, roof, wall, carved] of parts) {
    const tiles: [number, number][] = [];
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (inBlock(x, y)) tiles.push([x, y]);
    fading.push({ inBlock, tiles, roof, floor: 10, wall, carved, jharokha: false, parapet: carved ? 1 : 2, seed: id.length * 97 });
  }

  // Leftover building tiles deep inside blocks: plain fill, grouped into connected clusters.
  const landmark = ['palace', 'ghatTemple', 'oldTemple', 'natyaHaveli', 'lampsEnclosure'].map(zoneTiles);
  const seen = new Set<number>();
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const k = y * WIDTH + x;
      if (GRID[y][x] !== '#' || owner[k] >= 0 || seen.has(k) || landmark.some((f) => f(x, y))) continue;
      const tiles: [number, number][] = [];
      const queue: [number, number][] = [[x, y]];
      seen.add(k);
      while (queue.length) {
        const [cx, cy] = queue.pop()!;
        tiles.push([cx, cy]);
        for (const [dx, dy] of N4) {
          const nx = cx + dx;
          const ny = cy + dy;
          const nk = ny * WIDTH + nx;
          if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT || seen.has(nk) || GRID[ny][nx] !== '#' || owner[nk] >= 0 || landmark.some((f) => f(nx, ny))) continue;
          seen.add(nk);
          queue.push([nx, ny]);
        }
      }
      const set = new Set(tiles.map(([a, c]) => c * WIDTH + a));
      const base = y >= 22 ? 4 : 10;
      fading.push({
        inBlock: (a, c) => set.has(c * WIDTH + a),
        tiles,
        roof: base + STOREY * (3 + Math.floor(hash(x, y) * 3)),
        floor: base,
        wall: 'ochre',
        roofMat: ROOF_MATS[Math.floor(hash(x, y, 71) * ROOF_MATS.length)],
        seed: x * 31 + y,
      });
    }
  }

  // Background city outside the playable map: 2×2-tile blocks of varied heights.
  const styles: HouseStyle[] = ['blue', 'ochre', 'sandstone', 'pink', 'white'];
  for (let y = -PAD.north; y < 29; y += 2) {
    for (let x = -PAD.west; x < WIDTH + PAD.east; x += 2) {
      if (x >= 0 && x < WIDTH && y >= 0) continue;
      const style = styles[Math.floor(hash(x, y, 3) * styles.length)];
      const tiles: [number, number][] = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
      background.push({
        inBlock: (a, c) => a >= x && a <= x + 1 && c >= y && c <= y + 1,
        tiles,
        roof: (y >= 22 ? 6 : 10) + STOREY * (2 + Math.floor(hash(x, y, 7) * 4)),
        wall: STYLE_WALL[style],
        trim: STYLE_TRIM[style],
        roofMat: ROOF_MATS[Math.floor(hash(x, y, 71) * ROOF_MATS.length)],
        seed: x * 13 + y * 7,
      });
    }
  }

  ROOFS.clear();
  CELL_TOPS.fill(0);
  for (const blk of [...fading, ...background]) for (const [x, y] of blk.tiles) ROOFS.set(roofKey(x, y), blk.roof);

  // Phase 2: build.
  const occluders = fading.map(occluderFrom);
  const filler = new Builder();
  for (const blk of background) buildBlock(blk, filler);
  const fillerMeshes = filler.meshes((k) => BM[k as BMKey], TILE_SIZES);

  return { occluders, fillerMeshes, houses };
}
