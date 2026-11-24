import * as THREE from 'three';
import { GRID, WIDTH, HEIGHT, TILE_METRES as TS, isWalkable } from '../banarasMap';
import { archWall, onionDome, worldUV } from '../kit';
import { BM, fadeable } from './materials';
import { Builder, hash } from './geo';
import type { Occluder } from './buildings';
import type { ArcadeEdge } from './terrain';

const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
  const r = new THREE.Mesh(g, m);
  r.castShadow = r.receiveShadow = true;
  return r;
};

/**
 * Gives every mesh under `group` a cutaway material sharing ONE switch, so the whole building
 * dissolves together; walls below `stubY` (knee height above its floor) stay as a floor plan.
 */
export function asOccluder(group: THREE.Object3D, stubY: number): Occluder {
  const on = { value: 0 };
  const stub = { value: stubY };
  const cache = new Map<THREE.Material, THREE.Material>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    let f = cache.get(mat);
    if (!f) cache.set(mat, (f = fadeable(mat, on, stub)));
    m.material = f;
  });
  return { object: group, fades: [on], fade: 0 };
}

/** Curvilinear Nagara spire with a square plan, flat-faceted, carved texture. Base centred at origin. */
function spire(half: number, height: number, mat: THREE.Material) {
  const profile = [[1, 0], [1, 0.08], [0.97, 0.25], [0.91, 0.45], [0.8, 0.63], [0.63, 0.8], [0.42, 0.92], [0.26, 1]];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r * half * Math.SQRT2, y * height));
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts, 4, Math.PI / 4);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return mesh(worldUV(g, 3), mat);
}

/** A full shikhara temple: plinth, sanctum, clustered spires, amalaka and brass kalash, pillared porch. */
const GLOW = new THREE.MeshStandardMaterial({ color: 0xffd890, emissive: 0xffa030, emissiveIntensity: 2.4 });

function temple(half: number, height: number, porchDepth: number, glowing = false) {
  const g = new THREE.Group();
  const stone = BM.carved;
  const plinth = mesh(new THREE.BoxGeometry(half * 2 + 1.2, 1, half * 2 + 1.2).translate(0, 0.5, 0), BM.trim);
  g.add(plinth);
  const sanctumH = height * 0.22;
  g.add(mesh(worldUV(new THREE.BoxGeometry(half * 2, sanctumH, half * 2).translate(0, 1 + sanctumH / 2, 0), 3), stone));
  const main = spire(half * 0.92, height * 0.78, stone);
  main.position.y = 1 + sanctumH;
  g.add(main);
  // Smaller spires clustered against each face and at the corners.
  for (const [x, z, s] of [[1, 0, 0.62], [-1, 0, 0.62], [0, 1, 0.62], [0, -1, 0.62], [1, 1, 0.42], [-1, 1, 0.42], [1, -1, 0.42], [-1, -1, 0.42]]) {
    const sub = spire(half * 0.42, height * 0.78 * s, stone);
    sub.position.set(x * half * 0.78, 1 + sanctumH, z * half * 0.78);
    g.add(sub);
  }
  const top = 1 + sanctumH + height * 0.78;
  if (glowing) {
    // Bands of gold light climbing the spire.
    for (const k of [0.18, 0.4, 0.6, 0.78]) {
      const r = half * 0.92 * Math.SQRT2 * (1 - 0.62 * k * k) + 0.12;
      const band = mesh(new THREE.CylinderGeometry(r, r, 0.35, 4, 1, true).rotateY(Math.PI / 4), GLOW);
      band.position.y = 1 + sanctumH + height * 0.78 * k;
      g.add(band);
    }
  }
  const amalaka = mesh(new THREE.CylinderGeometry(half * 0.42, half * 0.42, half * 0.22, 18), BM.trim);
  amalaka.position.y = top + half * 0.1;
  amalaka.scale.set(1, 1, 1);
  g.add(amalaka);
  const kalash = mesh(new THREE.SphereGeometry(half * 0.16, 10, 8), glowing ? GLOW : BM.brass);
  kalash.position.y = top + half * 0.36;
  g.add(kalash);
  const tip = mesh(new THREE.ConeGeometry(half * 0.06, half * 0.5, 6), BM.brass);
  tip.position.y = top + half * 0.7;
  g.add(tip);
  const flag = mesh(new THREE.PlaneGeometry(half * 0.5, half * 0.3).translate(half * 0.25, 0, 0), BM.clothSaffron);
  flag.position.y = top + half * 0.85;
  g.add(flag);
  // Pillared porch (mandapa) facing +z.
  const pz = half + porchDepth / 2;
  for (const x of [-half * 0.8, half * 0.8]) {
    for (const z of [pz - porchDepth / 2 + 0.4, pz + porchDepth / 2 - 0.4]) {
      const p = mesh(new THREE.CylinderGeometry(0.22, 0.26, 3, 8).translate(0, 2.5, 0), BM.trim);
      p.position.set(x, 0, z);
      g.add(p);
    }
  }
  g.add(mesh(worldUV(new THREE.BoxGeometry(half * 2, 0.5, porchDepth).translate(0, 4.25, pz), 2), stone));
  const porchRoof = mesh(new THREE.ConeGeometry(half * 1.2, 2.2, 4).rotateY(Math.PI / 4).translate(0, 5.6, pz), stone);
  porchRoof.scale.set(1, 1, porchDepth / (half * 2));
  porchRoof.position.z = pz - pz * (porchDepth / (half * 2));
  g.add(porchRoof);
  g.add(mesh(new THREE.BoxGeometry(half * 2, 1, porchDepth).translate(0, 0.5, pz), BM.trim));
  return g;
}

/** Small open pavilion with an onion dome. */
export function chhatri(size: number) {
  const g = new THREE.Group();
  const h = size * 1.1;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.08, h, 6), BM.trim);
    p.position.set((x * size) / 2.4, h / 2, (z * size) / 2.4);
    g.add(p);
  }
  g.add(mesh(new THREE.BoxGeometry(size, size * 0.12, size).translate(0, h + size * 0.06, 0), BM.trim));
  const dome = onionDome(size * 0.45, size * 0.75, BM.whitewash);
  dome.position.y = h + size * 0.12;
  g.add(dome);
  return g;
}

/**
 * Raja's palace, built as separate pieces so the cutaway only removes the pieces in front of
 * the player: west wing, east wing, the upper tiers (with bridge, domes, chhatris) and the two
 * tunnel mouths. Floors under the wings are separate, never cut.
 */
function palace() {
  const [zN, zS] = [22 * TS, 32 * TS];
  const tiles = { carved: 3, sandstone: 3, trim: 2, terracotta: 1.5 };
  const westB = new Builder();
  const eastB = new Builder();
  const upperB = new Builder();
  const side = (x: number) => (x < 43 * TS ? westB : eastB);
  westB.set('carved').box(36 * TS, -1.4, zN, 42 * TS, 15, zS);
  eastB.set('carved').box(44 * TS, -1.4, zN, 52 * TS, 15, zS);
  upperB.set('sandstone').box(42 * TS, 14.5, zN, 44 * TS, 15, zS, true); // bridge over the tunnel, open underneath
  upperB.set('sandstone').box(36 * TS + 1.5, 15, zN, 52 * TS - 1.5, 20, zS - 2);
  upperB.set('carved').box(36 * TS + 3.5, 20, zN, 52 * TS - 3.5, 23.5, zS - 4.5);
  // Rows of balconies and cornices across the river face.
  for (const [y, z, x0, x1] of [[8, zS, 36 * TS, 52 * TS], [11.5, zS, 36 * TS, 52 * TS], [16.5, zS - 2, 36 * TS + 1.5, 52 * TS - 1.5], [21, zS - 4.5, 36 * TS + 3.5, 52 * TS - 3.5]]) {
    const lower = y < 14;
    if (lower) {
      westB.set('trim').box(x0 - 0.15, y + 2.4, z, 42 * TS, y + 2.65, z + 0.35);
      eastB.set('trim').box(44 * TS, y + 2.4, z, x1 + 0.15, y + 2.65, z + 0.35);
    } else upperB.set('trim').box(x0 - 0.15, y + 2.4, z, x1 + 0.15, y + 2.65, z + 0.35);
    for (let x = x0 + 1.2; x + 1.6 < x1; x += 3.2) {
      if (x > 42 * TS - 1.8 && x < 44 * TS + 0.2 && lower) continue; // keep the tunnel mouth clear
      const b = lower ? side(x) : upperB;
      const r = hash(x, y);
      b.set('trim').box(x, y, z, x + 1.6, y + 0.25, z + 0.8);
      b.set(r < 0.5 ? 'decWinArch' : 'decJharokha').wall(x + 0.1, z + 0.82, x + 1.5, z + 0.82, y + 0.25, y + 1.9, 0, 1, true);
      b.set('terracotta').box(x - 0.15, y + 1.9, z, x + 1.75, y + 2.15, z + 1.0);
    }
  }
  const group = (b: Builder) => {
    const g = new THREE.Group();
    g.add(...b.meshes((k) => BM[k as keyof typeof BM], tiles));
    return g;
  };
  const west = group(westB);
  const east = group(eastB);
  const upper = group(upperB);
  const dome = onionDome(3.2, 4.6, BM.whitewash);
  dome.position.set(44 * TS - 2, 23.5, zS - 12);
  upper.add(dome);
  for (const [x, z] of [[36 * TS + 4.5, zS - 5.5], [52 * TS - 4.5, zS - 5.5], [36 * TS + 4.5, zN + 1.5], [52 * TS - 4.5, zN + 1.5], [40 * TS, zS - 5.5], [48 * TS, zS - 5.5]]) {
    const c = chhatri(2.2);
    c.position.set(x, 23.5, z);
    upper.add(c);
  }
  for (const [x, g] of [[36 * TS + 1.2, west], [52 * TS - 1.2, east]] as const) {
    const c = chhatri(1.6);
    c.position.set(x, 20, zS - 3);
    g.add(c);
  }
  // Tunnel mouths, each its own piece.
  const south = archWall(4, 10.4, 1.2, 3.4, 5.5, BM.carved, 3);
  south.position.set(43 * TS, 4.1, zS + 0.6);
  const north = archWall(4, 4.5, 1.0, 3.4, 2.1, BM.carved, 3);
  north.position.set(43 * TS, 10, zN - 0.5);
  // Floors inside the wings, seen when a wing is cut away (not part of any cut piece).
  const floor = new Builder();
  for (const [x0, x1] of [[36 * TS, 42 * TS], [44 * TS, 52 * TS]]) {
    floor.set('arcadeFloor').top(x0, zN, x1, 29 * TS, 10.05);
    floor.set('arcadeFloor').top(x0, 29 * TS, x1, zS, 5.0);
  }
  return {
    pieces: [
      asOccluder(west, 5.4),
      asOccluder(east, 5.4),
      asOccluder(upper, 5.0), // includes the bridge over the tunnel, so it must go entirely
      asOccluder(south, 5.0),
      asOccluder(north, 10.9),
    ],
    floors: floor.meshes((k) => BM[k as keyof typeof BM]),
  };
}

/** Pointed archways in the city where a lane passes through a building. */
function cityArches() {
  const g = new THREE.Group();
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (GRID[y][x] !== 'A') continue;
      const ew = isWalkable(x - 1, y) && isWalkable(x + 1, y);
      const a = archWall(TS, 5.2, TS, 1.5, 2.1, BM.sandstone, 2.5);
      a.position.set(x * TS + 1, 10, y * TS + 1);
      if (ew) a.rotation.y = Math.PI / 2;
      g.add(a);
    }
  }
  return g;
}

/** Arcade under the stepwell gallery, split into the four sides so each can fade on its own. */
function galleryArcade(edges: ArcadeEdge[]) {
  const sides = new Map<string, THREE.Group>();
  for (const e of edges) {
    const side = e.y >= 11 ? 'south' : e.y <= 1 ? 'north' : 'west';
    if (!sides.has(side)) sides.set(side, new THREE.Group());
    const a = archWall(TS, 3.6, 0.45, 1.45, 1.75, BM.carved, 2.5);
    const cx = e.x * TS + 1 + e.dx * 0.78;
    const cz = e.y * TS + 1 + e.dy * 0.78;
    a.position.set(cx, 10, cz);
    if (e.dx) a.rotation.y = Math.PI / 2;
    const rail = mesh(new THREE.BoxGeometry(e.dx ? 0.22 : TS, 0.6, e.dx ? TS : 0.22).translate(0, 0.3, 0), BM.trim);
    rail.position.set(cx + e.dx * 0.12, 14, cz + e.dy * 0.12);
    sides.get(side)!.add(a, rail);
  }
  return [...sides.values()];
}

export function buildLandmarks(arcadeEdges: ArcadeEdge[]) {
  const occluders: Occluder[] = [];
  // The Old Temple towers over the whole city.
  const old = temple(6.5, 54, 4, true);
  old.position.set(24.5 * TS, 10, -7);
  occluders.push(asOccluder(old, 10.9));

  // Ghat temple: a carved bastion rising off the ghat with a temple on top.
  const ghat = new THREE.Group();
  ghat.add(mesh(worldUV(new THREE.BoxGeometry(5 * TS, 11.4, 7 * TS).translate(0, 4.3, 0), 3), BM.carved));
  const gt = temple(3, 15, 2.4);
  gt.position.set(0, 10, -1.5);
  ghat.add(gt);
  ghat.position.set(31.5 * TS, 0, 25.5 * TS);
  occluders.push(asOccluder(ghat, 6.9));

  const raja = palace();
  occluders.push(...raja.pieces);
  occluders.push(asOccluder(cityArches(), 10.9));
  for (const side of galleryArcade(arcadeEdges)) occluders.push(asOccluder(side, 10.9));
  return { occluders, floors: raja.floors };
}

export { HEIGHT };
