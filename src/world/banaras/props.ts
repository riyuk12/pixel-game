import * as THREE from 'three';
import { GRID, WIDTH, HEIGHT, TILE_METRES as TS, POIS } from '../banarasMap';
import { BM, hanging } from './materials';
import { hash } from './geo';
import { groundHeight } from './terrain';
import { chhatri } from './landmarks';

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => {
  const r = new THREE.Mesh(g, m);
  r.castShadow = cast;
  r.receiveShadow = true;
  return r;
};
const at = (tx: number, ty: number) => new THREE.Vector3(tx * TS, groundHeight(Math.floor(tx), Math.floor(ty)) ?? 10, ty * TS);
/** Rotation that turns local +z to face the given direction. */
const faceDir = (dx: number, dz: number) => Math.atan2(dx, dz);

// ---------------------------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------------------------

export type Flame = { light: THREE.PointLight; base: number; seed: number; on: number; target: number };

function flameLight(flames: Flame[], color: number, intensity: number, distance: number, on = 1) {
  const light = new THREE.PointLight(color, intensity * on, distance, 2);
  flames.push({ light, base: intensity, seed: Math.random() * 100, on, target: on });
  return light;
}

// ---------------------------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------------------------

const SPICE = [0xd9381e, 0xe8a520, 0x6e8a2a, 0xc2571a, 0x7a2e1a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));

/** Bazaar stall facing +z: counter, goods, hanging cloth and an awning. */
function bazaarStall(kind: number) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8).translate(0, 0.45, 0.45), BM.wood));
  for (const x of [-0.85, 0.85]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6).translate(x, 1.3, 0.85), BM.wood));
  const awning = mesh(new THREE.PlaneGeometry(2.0, 1.4).rotateX(-Math.PI / 2 + 0.35).translate(0, 2.55, 0.5), [BM.clothSaffron, BM.clothMagenta, BM.clothTeal, BM.bandhani][kind % 4]);
  g.add(awning);
  if (kind % 3 === 0) {
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.ConeGeometry(0.2, 0.28, 7).translate(-0.6 + i * 0.4, 1.04, 0.45), SPICE[(i + kind) % SPICE.length]));
  } else if (kind % 3 === 1) {
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.SphereGeometry(0.14 + (i % 2) * 0.05, 8, 6).translate(-0.7 + i * 0.35, 1.05, 0.45), BM.brass));
  } else {
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.PlaneGeometry(0.5, 1.6).translate(-0.6 + i * 0.6, 1.4, 0.1), i % 2 ? BM.brocade : BM.bandhani));
  }
  return g;
}

/** Garland seller's heap on the Flower Stairs. */
function flowerStall() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.75, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 0.8).translate(0, 0, 0.2), BM.marigoldHeap));
  g.add(mesh(new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0.55, 0, -0.35), BM.rose));
  for (let i = 0; i < 5; i++) g.add(mesh(new THREE.TorusGeometry(0.22, 0.05, 5, 10).rotateX(Math.PI / 2).translate(-0.6 + i * 0.3, 0.45, 0.85), BM.marigold));
  g.add(mesh(new THREE.PlaneGeometry(1.8, 1.2).rotateX(-Math.PI / 2 + 0.3).translate(0, 2.2, 0.2), BM.clothSaffron));
  for (const x of [-0.8, 0.8]) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2).translate(x, 1.1, 0.75), BM.wood));
  return g;
}

/** Handloom with silk on the warp. */
function loom() {
  const g = new THREE.Group();
  for (const x of [-0.8, 0.8]) for (const z of [-0.6, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1).translate(x, 0.8, z), BM.wood));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1).translate(0, 1.6, -0.6), BM.wood));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1).translate(0, 1.6, 0.6), BM.wood));
  g.add(mesh(new THREE.PlaneGeometry(1.5, 1.2).rotateX(-Math.PI / 2 + 0.25).translate(0, 0.9, 0), BM.brocade));
  return g;
}

function shrine(lamps: Flame[], h = 1.6) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1).translate(0, 0.25, 0), BM.trim));
  g.add(mesh(new THREE.BoxGeometry(0.8, h * 0.5, 0.8).translate(0, 0.5 + h * 0.25, 0), BM.clothSaffron));
  g.add(mesh(new THREE.ConeGeometry(0.55, h * 0.6, 4).rotateY(Math.PI / 4).translate(0, 0.5 + h * 0.5 + h * 0.3, 0), BM.carved));
  const flame = mesh(new THREE.ConeGeometry(0.06, 0.16, 5).translate(0, 0.62, 0.6), BM.flame, false);
  g.add(flame);
  const l = flameLight(lamps, 0xffa040, 4, 6);
  l.position.set(0, 1, 0.8);
  g.add(l);
  return g;
}

function well() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.9, 14, 1, true).translate(0, 0.45, 0), BM.trim));
  g.add(mesh(new THREE.CircleGeometry(0.95, 14).rotateX(-Math.PI / 2).translate(0, 0.4, 0), BM.pool));
  for (const x of [-1.05, 1.05]) g.add(mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18).translate(x, 1.1, 0), BM.wood));
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16).translate(0, 2.2, 0), BM.wood));
  g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.4, 0), BM.brass));
  return g;
}

function nandi() {
  const g = chhatri(2.2);
  const stone = new THREE.MeshStandardMaterial({ color: 0x2b2624, roughness: 0.5 });
  const bull = new THREE.Group();
  bull.add(mesh(new THREE.BoxGeometry(0.7, 0.55, 1.3).translate(0, 0.45, 0), stone));
  bull.add(mesh(new THREE.BoxGeometry(0.4, 0.4, 0.45).translate(0, 0.8, 0.75), stone));
  bull.add(mesh(new THREE.SphereGeometry(0.22, 8, 6).translate(0, 0.85, -0.1), stone));
  bull.rotation.y = Math.PI; // faces the temple
  bull.position.y = 0.1;
  g.add(bull);
  return g;
}

function banyan() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.6, 9, 7).translate(Math.cos(a) * 0.6, 4.5, Math.sin(a) * 0.6), BM.bark));
  }
  const canopy: [number, number, number, number][] = [[0, 12, 0, 5], [4, 11, 3, 4], [-2, 12.5, 4, 4], [4, 12, -2, 3.5], [7, 11, 6, 3.2], [1, 13.5, 1, 3.5]];
  for (const [x, y, z, r] of canopy) g.add(mesh(new THREE.SphereGeometry(r, 10, 8).scale(1, 0.55, 1).translate(x, y, z), BM.foliage));
  // Aerial roots hanging down — some all the way into the stepwell.
  for (let i = 0; i < 26; i++) {
    const x = (hash(i, 1) - 0.3) * 11;
    const z = (hash(i, 2) - 0.3) * 11;
    const len = 4 + hash(i, 3) * 6;
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.08, len, 4).translate(x, 11 - len / 2, z), BM.bark));
  }
  return g;
}

function peepal() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 12).translate(0, 0.25, 0), BM.trim)); // chabutra
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.55, 5, 7).translate(0, 2.5, 0), BM.bark));
  for (const [x, y, z, r] of [[0, 6.5, 0, 3], [1.8, 5.8, 1, 2], [-1.6, 6, -0.8, 2.2]]) g.add(mesh(new THREE.SphereGeometry(r, 9, 7).scale(1, 0.7, 1).translate(x, y, z), BM.foliage));
  return g;
}

function boat(length = 5.5, canopy = false) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-length / 2, 0);
  s.quadraticCurveTo(-length / 2 + 0.6, 0.75, 0, 0.8);
  s.quadraticCurveTo(length / 2 - 0.6, 0.75, length / 2, 0);
  s.quadraticCurveTo(length / 2 - 0.6, -0.75, 0, -0.8);
  s.quadraticCurveTo(-length / 2 + 0.6, -0.75, -length / 2, 0);
  const hull = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.15, 0);
  g.add(mesh(hull, BM.wood));
  for (const x of [-1, 0.2, 1.3]) g.add(mesh(new THREE.BoxGeometry(0.25, 0.08, 1.3).translate(x, 0.38, 0), BM.wood));
  if (canopy) g.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0.4, 0), BM.bandhani));
  return g;
}

function umbrella(cloth: THREE.Material) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6).translate(0, 1.3, 0), BM.wood));
  g.add(mesh(new THREE.ConeGeometry(1.6, 0.7, 12, 1, true).translate(0, 2.7, 0), cloth));
  return g;
}

function aartiPlatformLamp(lamps: Flame[]) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8).translate(0, 0.45, 0), BM.brass));
  const l = flameLight(lamps, 0xff9030, 18, 14);
  l.position.set(0, 2.6, 0);
  g.add(l);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Diyas: hundreds of tiny flames, one instanced mesh.
// ---------------------------------------------------------------------------------------------

export class Diyas {
  readonly flames: THREE.InstancedMesh;
  readonly bowls: THREE.InstancedMesh;
  private base: THREE.Matrix4[] = [];
  private floating: number[] = [];

  constructor(points: { p: THREE.Vector3; float?: boolean }[]) {
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xff9a28, emissiveIntensity: 5 });
    this.flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.28, 5).translate(0, 0.2, 0), flameMat, points.length);
    this.bowls = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.07, 0.08, 7).translate(0, 0.04, 0), BM.clay, points.length);
    const m = new THREE.Matrix4();
    points.forEach(({ p, float }, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      this.base.push(m.clone());
      this.flames.setMatrixAt(i, m);
      this.bowls.setMatrixAt(i, m);
      if (float) this.floating.push(i);
    });
    this.flames.castShadow = false;
    this.bowls.castShadow = false;
  }

  /** Floating diyas bob on the river. */
  update(t: number) {
    const m = new THREE.Matrix4();
    for (const i of this.floating) {
      m.copy(this.base[i]);
      m.elements[13] += Math.sin(t * 1.3 + i) * 0.03;
      m.elements[12] += Math.sin(t * 0.2 + i * 0.7) * 0.4;
      this.flames.setMatrixAt(i, m);
      this.bowls.setMatrixAt(i, m);
    }
    this.flames.instanceMatrix.needsUpdate = true;
    this.bowls.instanceMatrix.needsUpdate = true;
    (this.flames.material as THREE.MeshStandardMaterial).emissiveIntensity = 6 + Math.sin(t * 9) * 0.5 + Math.sin(t * 23) * 0.4;
  }
}

// ---------------------------------------------------------------------------------------------
// Everything placed on the map
// ---------------------------------------------------------------------------------------------

export function buildProps(scene: THREE.Scene) {
  const lamps: Flame[] = [];
  const PROP_SCALE = 1.3;
  const add = (o: THREE.Object3D, p: THREE.Vector3, rotY = 0) => {
    o.position.copy(p);
    o.rotation.y = rotY;
    o.scale.multiplyScalar(PROP_SCALE);
    scene.add(o);
    return o;
  };
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const walk = (x: number, y: number) => '.:^=P_A123g'.includes(GRID[y]?.[x] ?? '#');

  // Stalls and looms face whichever neighbour is open.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const t = GRID[y][x];
      if (t !== 'm') continue;
      const open = N4.find(([dx, dy]) => walk(x + dx, y + dy));
      const rot = open ? faceDir(open[0], open[1]) : 0;
      const p = at(x + 0.5, y + 0.5);
      if (y >= 22) add(flowerStall(), p, faceDir(x === 21 ? 1 : -1, 0));
      else if (x >= 45) add(loom(), p, 0);
      else add(bazaarStall(Math.floor(hash(x, y) * 12)), p, rot);
    }
  }

  // Shrines, the well, Nandi, chhatris, washing slabs, the island shrine.
  let islandLamp: Flame | undefined;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (GRID[y][x] !== 'S') continue;
      const p = at(x + 0.5, y + 0.5);
      if (y === 37) add(mesh(new THREE.BoxGeometry(1.3, 0.35, 0.9).rotateX(-0.25).translate(0, 0.2, 0), BM.trim), p);
      else if (y === 34) add(chhatri(2), p);
      else if (x === 14 && y === 20) add(well(), p);
      else if (x === 24 && y === 3) add(nandi(), p);
      else if (x === 7 && y === 6) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.BoxGeometry(1.6, 0.4, 1.2).translate(0, 0.2, 0), BM.trim));
        const tiny = shrine(lamps, 1.8);
        tiny.position.y = 0.4;
        g.add(tiny);
        islandLamp = lamps[lamps.length - 1];
        islandLamp.on = islandLamp.target = 0.08; // the dark lamp the story is about
        const big = flameLight(lamps, 0xffb050, 26, 18, 0);
        big.position.set(0, 3, 0);
        g.add(big);
        add(g, new THREE.Vector3(p.x, 4.6, p.z));
      } else {
        const open = N4.find(([dx, dy]) => walk(x + dx, y + dy));
        add(shrine(lamps), p, open ? faceDir(open[0], open[1]) : 0);
      }
    }
  }
  const shrineLight = lamps.find((l) => l.base === 26)!;

  add(banyan(), new THREE.Vector3(3 * TS, 10, 3 * TS));
  add(peepal(), at(20.5, 17.5));

  // Boats on the river: moored ones bob, two more row slowly along the bank.
  const boats: { obj: THREE.Object3D; speed: number }[] = [];
  for (const poi of POIS.filter((p) => p.kind === 'boat')) {
    const b = boat(6.5 + hash(poi.at[0]) * 2, hash(poi.at[1]) > 0.6);
    b.scale.setScalar(1.25);
    b.position.set(poi.at[0] * TS, 0.12, poi.at[1] * TS + 1);
    b.rotation.y = (hash(poi.at[0], 4) - 0.5) * 0.3;
    scene.add(b);
    boats.push({ obj: b, speed: 0 });
  }
  for (const [x, z, speed] of [[-20, 92, 1.1], [120, 100, -0.8]] as const) {
    const b = boat(7.5, true);
    b.scale.setScalar(1.25);
    b.position.set(x, 0.12, z);
    scene.add(b);
    boats.push({ obj: b, speed });
  }

  // Bamboo umbrellas on the ghats.
  const cloths = [BM.clothWhite, BM.clothSaffron, BM.clothWhite, BM.clothTeal];
  [[17.5, 31.5], [20, 30.2], [29.5, 31.2], [32.5, 30.5], [40.5, 35.2], [44.5, 34.2], [48.5, 35.5], [4, 30.5], [10.5, 31.2]].forEach(([x, y], i) => add(umbrella(cloths[i % 4]), at(x, y)));

  // Aarti fires on the five platforms.
  for (const x of [19, 22, 25, 28, 31]) add(aartiPlatformLamp(lamps), at(x, 37.2));

  // Laundry across Dhobi Ghat, kites in their gali, dyed cloth over the Dyers' Gali.
  const laundry = [BM.bandhani, BM.clothWhite, BM.clothSaffron, BM.clothTeal, BM.clothMagenta, BM.clothIndigo];
  for (let i = 0; i < 9; i++) {
    const p = at(1.5 + i * 1.3, 34.6);
    add(mesh(new THREE.PlaneGeometry(1.1, 2.2, 1, 6).translate(0, 1.5, 0), hanging(laundry[i % laundry.length], 0.22, 2.6, 2.2)), p);
  }
  for (let i = 0; i < 6; i++) {
    const kite = mesh(new THREE.PlaneGeometry(0.55, 0.55).rotateZ(Math.PI / 4), [BM.clothMagenta, BM.clothSaffron, BM.clothTeal][i % 3]);
    add(kite, new THREE.Vector3((2.3 + i * 0.6) * TS, 13.6 + hash(i) * 0.6, 16.5 * TS));
  }
  for (let i = 0; i < 5; i++) {
    const strip = mesh(new THREE.PlaneGeometry(0.9, 3.2, 1, 8).translate(0, -1.6, 0), hanging([BM.clothIndigo, BM.bandhani, BM.clothSaffron, BM.brocade, BM.clothTeal][i], 0.35, 0, 3.2));
    strip.rotation.y = Math.PI / 2;
    add(strip, new THREE.Vector3((44.4 + i * 1.1) * TS, 17, 20.5 * TS));
  }

  // Lamps around the city (point lights placed by hand at the places that matter).
  const lightAt = (tx: number, ty: number, dy: number, intensity: number, dist: number, color = 0xffa040) => {
    const l = flameLight(lamps, color, intensity, dist);
    l.position.copy(at(tx, ty)).add(new THREE.Vector3(0, dy, 0));
    scene.add(l);
  };
  lightAt(21.5, 19.5, 1.5, 10, 9); // chai stove
  lightAt(24.5, 7, 3.2, 9, 10);
  lightAt(24.5, 11.5, 3.2, 9, 10);
  lightAt(24.5, 14.5, 3.2, 8, 10); // bazaar
  lightAt(34, 10, 3, 12, 12);
  lightAt(38.5, 10.5, 3, 10, 12); // natya courtyard
  lightAt(4.5, 8.5, 2.5, 22, 16);
  lightAt(10.5, 4.5, 2.5, 22, 16);
  lightAt(4.5, 4.0, 2.0, 18, 14);
  lightAt(10.0, 8.6, 2.0, 18, 14);
  lightAt(7.5, 7.0, 4.5, 9, 12, 0xffc070); // stepwell, glow rising off the water
  lightAt(6.5, 1.5, 2.5, 8, 10); // gallery
  lightAt(24.5, 4, 3, 12, 14); // temple chowk
  lightAt(24.5, 26, 2.5, 8, 10); // flower stairs
  lightAt(44, 35, 1.5, 8, 9); // sadhus' fire
  lightAt(38.5, 18.5, 2, 8, 9); // sweet-shop kadhai
  lightAt(14, 19, 2.5, 6, 8); // well
  lightAt(47.5, 13, 3, 7, 10); // weavers
  lightAt(13.5, 6, 1.0, 10, 8, 0xffb060); // light pouring through the Lamp Gali jali

  // Diyas: stepwell tiers and street ring, aarti platform edges, ghat steps, floating on the river.
  const pts: { p: THREE.Vector3; float?: boolean }[] = [];
  for (let y = 1; y <= 11; y++) {
    for (let x = 1; x <= 12; x++) {
      const t = GRID[y][x];
      if (!'123:g'.includes(t)) continue;
      const h = groundHeight(x, y)!;
      for (let k = 0; k < 4; k++) {
        const u = 0.15 + hash(x, y, k) * 0.7;
        const v = 0.15 + hash(y, x, k) * 0.7;
        pts.push({ p: new THREE.Vector3((x + u) * TS, h + 0.02, (y + v) * TS) });
      }
    }
  }
  for (const x of [18, 21, 24, 27, 30]) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      pts.push({ p: new THREE.Vector3((x + 1) * TS + Math.cos(a) * 1.7, groundHeight(x, 37)! + 0.02, 37 * TS + Math.sin(a) * 1.7) });
    }
  }
  for (let x = 16; x < 34; x += 0.45) for (const y of [33.95, 34.95]) pts.push({ p: at(x, y).add(new THREE.Vector3(0, 0.02, 0)) });
  for (let i = 0; i < 90; i++) {
    pts.push({ p: new THREE.Vector3((10 + hash(i, 7) * 30) * TS, 0.04, (39.3 + hash(i, 8) * 3.5) * TS), float: true });
  }
  const diyas = new Diyas(pts);
  scene.add(diyas.flames, diyas.bowls);

  // A cow takes up half the East Gali.
  const cow = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.9 });
  cow.add(mesh(new THREE.BoxGeometry(0.7, 0.8, 1.7).translate(0, 1.1, 0), hide));
  cow.add(mesh(new THREE.BoxGeometry(0.4, 0.45, 0.55).translate(0, 1.35, 1.05), hide));
  for (const [x, z] of [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]]) cow.add(mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14).translate(x, 0.38, z), hide));
  cow.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 4, 8).rotateX(Math.PI / 2).translate(0, 1.15, 0.85), BM.marigold));
  add(cow, at(42.9, 14.5));

  return { lamps, diyas, islandLamp: islandLamp!, shrineLight, boats };
}
