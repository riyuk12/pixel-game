import * as THREE from 'three';
import { TILE_METRES as TS } from '../banarasMap';
import { spawnCharacter, addTurban, type Character, type Model } from '../characters';
import { BM } from './materials';
import { surfaceHeight } from './terrain';

/** Who stands where. Positions are map tiles; facing is the direction they look (S = towards the river/camera). */
type Spec = { at: [number, number]; model: Model; skin: string; anim: string; face: 'S' | 'N' | 'E' | 'W' | number; prop?: 'aarti' | 'staff' | 'turban'; spin?: boolean };

const FACE = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
const SEAT = 'Sit_Floor_Idle';

const CROWD: Spec[] = [
  // Aarti priests on the five platforms.
  ...[19, 22, 25, 28, 31].map((x): Spec => ({ at: [x, 36.9], model: 'Mage', skin: 'priest', anim: 'Spellcasting', face: 'S', prop: 'aarti' })),
  // Devotees seated on the steps and the landing, watching the river.
  ...([[17, 34.4], [18.6, 35.4], [20.2, 34.5], [23, 34.4], [26.6, 34.5], [29.6, 35.4], [31.2, 34.4], [33, 35.3], [21.6, 32.6], [27.8, 32.6], [24.6, 31.4], [19, 31.6]] as const).map(
    ([x, y], i): Spec => ({ at: [x, y], model: i % 3 === 0 ? 'Rogue_Hooded' : 'Mage', skin: ['pilgrim', 'local', 'seller', 'localGreen', 'weaver', 'pilgrim'][i % 6], anim: SEAT, face: 'S' }),
  ),
  { at: [30.5, 30.4], model: 'Mage', skin: 'pilgrim', anim: 'Idle', face: 'S' },
  { at: [17.8, 30.2], model: 'Rogue_Hooded', skin: 'local', anim: 'Idle', face: 'S' },
  // Dhobis beating laundry on the slabs.
  { at: [2.5, 36.6], model: 'Rogue_Hooded', skin: 'localGreen', anim: '1H_Melee_Attack_Chop', face: 'S' },
  { at: [8.5, 36.6], model: 'Rogue_Hooded', skin: 'local', anim: '1H_Melee_Attack_Chop', face: 'S' },
  // Sadhus on Raja's Ghat.
  { at: [43.4, 34.4], model: 'Mage', skin: 'sadhu', anim: SEAT, face: 'S', prop: 'staff' },
  { at: [45.4, 35.2], model: 'Mage', skin: 'sadhu', anim: SEAT, face: 'S' },
  // Garland sellers on the Flower Stairs.
  { at: [22.2, 24.4], model: 'Mage', skin: 'seller', anim: SEAT, face: 'E' },
  { at: [26.8, 25.6], model: 'Mage', skin: 'seller', anim: SEAT, face: 'W' },
  { at: [23.8, 23.2], model: 'Mage', skin: 'pilgrim', anim: 'Walking_A', face: 'N' },
  // Chai Chowk.
  { at: [21.5, 19.0], model: 'Rogue_Hooded', skin: 'local', anim: 'Use_Item', face: 'S' },
  { at: [22.6, 19.9], model: 'Mage', skin: 'pilgrim', anim: 'Idle', face: 'W' },
  { at: [26.5, 18.5], model: 'Mage', skin: 'weaver', anim: SEAT, face: 'S' },
  // Shoppers in the bazaar.
  { at: [23.4, 8.5], model: 'Mage', skin: 'seller', anim: 'Idle', face: 'W' },
  { at: [25.6, 10.2], model: 'Rogue_Hooded', skin: 'localGreen', anim: 'Interact', face: 'E' },
  { at: [24.4, 12.6], model: 'Mage', skin: 'pilgrim', anim: 'Walking_A', face: 'N' },
  { at: [23.5, 13.8], model: 'Mage', skin: 'weaver', anim: 'Idle', face: 'W' },
  { at: [25.4, 6.5], model: 'Rogue_Hooded', skin: 'local', anim: 'Idle', face: 'E' },
  // The Natya Haveli: dancer, musicians, audience.
  { at: [35.9, 8.9], model: 'Mage', skin: 'dancer', anim: 'Spellcasting', face: 'S', spin: true },
  { at: [34.2, 9.6], model: 'Rogue_Hooded', skin: 'local', anim: SEAT, face: 'E' },
  { at: [37.8, 9.6], model: 'Mage', skin: 'priest', anim: SEAT, face: 'W' },
  ...([[33.2, 11.6], [34.6, 12.2], [36.2, 12.3], [37.8, 12.2], [39.2, 11.6]] as const).map(
    ([x, y], i): Spec => ({ at: [x, y], model: i % 2 ? 'Rogue_Hooded' : 'Mage', skin: ['pilgrim', 'localGreen', 'seller', 'local', 'weaver'][i], anim: SEAT, face: 'N' }),
  ),
  // Worshippers on the stepwell tiers, facing the pool.
  { at: [5.5, 4.4], model: 'Mage', skin: 'pilgrim', anim: SEAT, face: 'S' },
  { at: [8.6, 4.4], model: 'Mage', skin: 'seller', anim: SEAT, face: 'S' },
  { at: [4.4, 6.6], model: 'Mage', skin: 'weaver', anim: SEAT, face: 'E' },
  { at: [10.6, 5.6], model: 'Rogue_Hooded', skin: 'local', anim: SEAT, face: 'W' },
  { at: [6.4, 8.6], model: 'Mage', skin: 'pilgrim', anim: SEAT, face: 'N' },
  { at: [3.6, 9.4], model: 'Mage', skin: 'priest', anim: SEAT, face: 'N' },
  { at: [11.4, 7.5], model: 'Mage', skin: 'pilgrim', anim: SEAT, face: 'W' },
  { at: [4.5, 1.5], model: 'Mage', skin: 'pilgrim', anim: 'Spellcast_Raise', face: 'S' },
  { at: [9.0, 1.5], model: 'Mage', skin: 'priest', anim: 'Spellcast_Raise', face: 'S' },
  // Temple Chowk pilgrims.
  { at: [22.5, 3.6], model: 'Mage', skin: 'pilgrim', anim: 'Idle', face: 'N' },
  { at: [26.6, 3.4], model: 'Mage', skin: 'seller', anim: 'Interact', face: 'N' },
  { at: [20.0, 2.6], model: 'Rogue_Hooded', skin: 'localGreen', anim: SEAT, face: 'E' },
  // Lane life.
  { at: [3.0, 16.5], model: 'Rogue_Hooded', skin: 'localGreen', anim: 'Cheer', face: 'S' },
  { at: [36.5, 15.5], model: 'Rogue_Hooded', skin: 'local', anim: '1H_Melee_Attack_Chop', face: 'N' },
  { at: [46.0, 20.4], model: 'Mage', skin: 'weaver', anim: 'Interact', face: 'N' },
  { at: [38.6, 18.5], model: 'Rogue_Hooded', skin: 'local', anim: 'Use_Item', face: 'N' },
  { at: [13.4, 19.8], model: 'Mage', skin: 'seller', anim: 'Idle', face: 'E' },
  { at: [46.2, 12.9], model: 'Mage', skin: 'weaver', anim: 'Sit_Chair_Idle', face: 'N' },
  { at: [48.2, 12.9], model: 'Mage', skin: 'weaver', anim: 'Sit_Chair_Idle', face: 'N' },
];

/** Tiered brass aarti lamp blazing with small flames. */
function aartiLamp() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5).translate(0, -0.1, 0), BM.brass));
  [0.22, 0.17, 0.12, 0.07].forEach((r, i) => {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 0.04, 10).translate(0, 0.18 + i * 0.13, 0), BM.brass));
    for (let k = 0; k < 6 - i; k++) {
      const a = (k / (6 - i)) * Math.PI * 2;
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5).translate(Math.cos(a) * r, 0.27 + i * 0.13, Math.sin(a) * r), BM.flame));
    }
  });
  return g;
}

export type CrowdMember = { c: Character; spin: boolean };

/** People walking back and forth along routes (map tiles). */
const ROUTES: { model: Model; skin: string; path: [number, number][]; speed: number }[] = [
  { model: 'Mage', skin: 'pilgrim', path: [[16, 35.3], [33, 35.3]], speed: 1.1 },
  { model: 'Rogue_Hooded', skin: 'local', path: [[33.5, 33.6], [17, 33.6]], speed: 1.3 },
  { model: 'Mage', skin: 'seller', path: [[23.6, 28.6], [23.6, 22.4], [24.5, 19]], speed: 1.0 },
  { model: 'Mage', skin: 'weaver', path: [[25.4, 21], [25.4, 28.6]], speed: 0.9 },
  { model: 'Rogue_Hooded', skin: 'localGreen', path: [[24, 5.5], [24, 15.5]], speed: 1.2 },
  { model: 'Mage', skin: 'pilgrim', path: [[24.9, 15.2], [24.9, 6]], speed: 1.0 },
  { model: 'Mage', skin: 'sadhu', path: [[43.5, 4.5], [43.5, 20.5]], speed: 0.8 },
  { model: 'Rogue_Hooded', skin: 'local', path: [[31, 18.5], [41, 18.5]], speed: 1.2 },
  { model: 'Mage', skin: 'priest', path: [[18, 3.2], [30.5, 3.2]], speed: 0.9 },
  { model: 'Mage', skin: 'seller', path: [[36.5, 36.2], [50.5, 36.2]], speed: 1.0 },
  { model: 'Rogue_Hooded', skin: 'localGreen', path: [[1.5, 35.4], [12.5, 35.4]], speed: 1.1 },
  { model: 'Mage', skin: 'weaver', path: [[6.5, 21], [6.5, 13.5], [12, 13.5]], speed: 0.9 },
];

export type Walker = { c: Character; path: THREE.Vector3[]; i: number; dir: number; speed: number };

export async function buildWalkers(scene: THREE.Scene) {
  return Promise.all(
    ROUTES.map(async (r) => {
      const c = await spawnCharacter(r.model, r.skin, r.model === 'Mage' ? 2.05 : 2.1);
      const path = r.path.map(([x, y]) => new THREE.Vector3(x * TS, 0, y * TS));
      const start = Math.floor(Math.random() * path.length);
      c.root.position.copy(path[start]).setY(surfaceHeight(path[start].x, path[start].z));
      if (r.model === 'Mage') addTurban(c, r.skin === 'priest' ? 0x6a1622 : r.skin === 'sadhu' ? 0xb85a12 : 0xe8dcc4);
      c.play('Walking_A', { fade: 0 });
      c.update(Math.random() * 2);
      scene.add(c.root);
      return { c, path, i: (start + 1) % path.length, dir: 1, speed: r.speed } satisfies Walker;
    }),
  );
}

const step = new THREE.Vector3();
export function updateWalkers(walkers: Walker[], dt: number) {
  for (const w of walkers) {
    const pos = w.c.root.position;
    step.subVectors(w.path[w.i], pos).setY(0);
    const dist = step.length();
    if (dist < 0.15) {
      if (w.i + w.dir < 0 || w.i + w.dir >= w.path.length) w.dir = -w.dir;
      w.i += w.dir;
    } else {
      step.multiplyScalar(Math.min(dist, w.speed * dt) / dist);
      pos.add(step);
      w.c.face(step, dt, 8);
    }
    pos.y = surfaceHeight(pos.x, pos.z);
    w.c.update(dt);
  }
}

export async function buildCrowd(scene: THREE.Scene) {
  const members = await Promise.all(
    CROWD.map(async (s) => {
      const c = await spawnCharacter(s.model, s.skin, s.model === 'Mage' ? 2.05 : 2.1);
      const x = s.at[0] * TS;
      const z = s.at[1] * TS;
      c.root.position.set(x, surfaceHeight(x, z), z);
      c.root.rotation.y = typeof s.face === 'number' ? s.face : FACE[s.face];
      c.play(s.anim, { fade: 0 });
      c.update(Math.random() * 4); // desynchronise the loops
      if (s.model === 'Mage' && s.skin !== 'dancer') addTurban(c, s.skin === 'priest' ? 0x6a1622 : s.skin === 'sadhu' ? 0xb85a12 : 0xe8dcc4);
      if (s.prop === 'aarti') c.bone('handslot.r')?.add(aartiLamp());
      if (s.prop === 'staff') c.bone('handslot.r')?.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), BM.wood));
      scene.add(c.root);
      return { c, spin: !!s.spin } satisfies CrowdMember;
    }),
  );
  return members;
}
