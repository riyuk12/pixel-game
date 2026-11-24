import * as THREE from 'three';
import { WIDTH, HEIGHT, TILE_METRES as TS } from '../banarasMap';
import { CELL_TOPS, type Occluder } from './buildings';
import type { PixelRenderer } from '../../render/pixelRenderer';
import { CUT_CELLS } from './materials';

const HOLD = 0.6; // seconds a cut stays after it stops blocking (no flicker)
/** The patch of ground around the player that must stay visible: across, along the view, and up. */
const CLEAR_ACROSS = [-3, -2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25, 3];
const CLEAR_ALONG = [-1.5, 0, 1.5];
const CLEAR_UP = [0.3, 1.2, 2.2];

/**
 * Keeps the player visible.
 *  - Houses and walled blocks: sight lines are traced from the player's body to the camera across
 *    the map grid; only the 2 m cells taller than the sight line are cut (CUT_CELLS texture).
 *  - Landmark pieces (palace parts, temples, arches, arcade): cut as one piece when a ray hits.
 * Every cut holds for a moment before restoring.
 */
export class Occlusion {
  private ray = new THREE.Raycaster();
  private pieces: { o: Occluder; box: THREE.Box3; hold: number; casts: boolean }[];
  private cellHold = new Float32Array(WIDTH * HEIGHT);
  private cellValue = new Float32Array(WIDTH * HEIGHT);
  private hit = new Uint8Array(WIDTH * HEIGHT);
  private back = new THREE.Vector3();
  private side = new THREE.Vector3();
  private origin = new THREE.Vector3();

  constructor(private view: PixelRenderer, occluders: Occluder[]) {
    this.pieces = occluders.filter((o) => !o.cells).map((o) => ({ o, box: new THREE.Box3().setFromObject(o.object), hold: 0, casts: true }));
  }

  private along = new THREE.Vector3();

  /** Origins of the sight lines: the character and a patch of ground around them. */
  private samples(player: THREE.Vector3, visit: (origin: THREE.Vector3) => void, wide = true) {
    this.along.set(-this.back.x, 0, -this.back.z).normalize(); // away from the camera, on the ground
    for (const s of wide ? CLEAR_ACROSS : [-0.6, 0, 0.6]) {
      for (const a of wide ? CLEAR_ALONG : [0]) {
        for (const h of CLEAR_UP) {
          this.origin.copy(player).addScaledVector(this.side, s).addScaledVector(this.along, a);
          this.origin.y += h;
          visit(this.origin);
        }
      }
    }
  }

  /** Mark every cell whose building rises above a sight line from the player to the camera. */
  private traceCells(player: THREE.Vector3) {
    this.hit.fill(0);
    const flat = Math.hypot(this.back.x, this.back.z);
    const ux = this.back.x / flat;
    const uz = this.back.z / flat;
    const slope = this.back.y / flat;
    this.samples(player, (o) => {
      // Only start from open ground: a start point inside a building would cut the building
      // the player is standing in front of.
      const sx = Math.floor(o.x / TS);
      const sy = Math.floor(o.z / TS);
      if (sx >= 0 && sy >= 0 && sx < WIDTH && sy < HEIGHT && CELL_TOPS[sy * WIDTH + sx] > o.y) return;
      for (let d = 0.5; d < 110; d += 0.5) {
        const y = o.y + slope * d;
        if (y > 70) break;
        const tx = Math.floor((o.x + ux * d) / TS);
        const ty = Math.floor((o.z + uz * d) / TS);
        if (tx < 0 || ty < 0 || tx >= WIDTH || ty >= HEIGHT) continue;
        const i = ty * WIDTH + tx;
        if (CELL_TOPS[i] > y) this.hit[i] = 1;
      }
    });
  }

  update(player: THREE.Vector3, dt: number) {
    const cam = this.view.camera;
    this.back.set(0, 0, 1).applyQuaternion(cam.quaternion); // orthographic: rays are parallel
    this.side.set(1, 0, 0).applyQuaternion(cam.quaternion);

    // Houses: per cell.
    this.traceCells(player);
    let changed = false;
    for (let i = 0; i < this.hit.length; i++) {
      this.cellHold[i] = this.hit[i] ? HOLD : Math.max(0, this.cellHold[i] - dt);
      const target = this.cellHold[i] > 0 ? 1 : 0;
      const v = THREE.MathUtils.clamp(this.cellValue[i] + (target ? dt : -dt) * 4, 0, 1);
      if (v !== this.cellValue[i]) {
        this.cellValue[i] = v;
        CUT_CELLS.data[i] = Math.round(v * 255);
        changed = true;
      }
    }
    if (changed) CUT_CELLS.tex.needsUpdate = true;

    // Landmark pieces: whole piece.
    this.ray.far = 400;
    for (const p of this.pieces) {
      let blocks = false;
      this.samples(player, (o) => {
        if (blocks) return;
        this.ray.set(o, this.back);
        blocks = this.ray.ray.intersectsBox(p.box) && this.ray.intersectObject(p.o.object, true).length > 0;
      }, false);
      p.hold = blocks ? HOLD : Math.max(0, p.hold - dt);
      p.o.fade = THREE.MathUtils.clamp(p.o.fade + (p.hold > 0 ? dt : -dt) * 4, 0, 1);
      for (const f of p.o.fades) f.value = p.o.fade;
      const casts = p.o.fade < 0.5;
      if (casts !== p.casts) {
        p.casts = casts;
        p.o.object.traverse((m) => ((m as THREE.Mesh).isMesh ? ((m as THREE.Mesh).castShadow = casts) : undefined));
      }
    }
  }
}
