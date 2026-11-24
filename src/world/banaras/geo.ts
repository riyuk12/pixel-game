import * as THREE from 'three';
import { worldUV } from '../kit';

/**
 * Collects flat quads (and boxes made of them) for one material, then bakes them into a single
 * BufferGeometry with world-scale UVs. Used to build terrain and buildings with few draw calls.
 */
export class QuadSet {
  private p: number[] = [];
  private n: number[] = [];
  /** Explicit UVs, used by decal sets (whole image stretched over each quad). */
  private uv: number[] = [];
  /** Map cell that owns each vertex (for the per-cell cutaway), read live from the builder. */
  private cell: number[] = [];

  constructor(private ownerOf: () => [number, number] | null = () => null) {}

  get empty() {
    return this.p.length === 0;
  }

  private tri(a: number[], b: number[], c: number[], nx: number, ny: number, nz: number) {
    this.p.push(...a, ...b, ...c);
    const owner = this.ownerOf();
    if (owner) for (let i = 0; i < 3; i++) this.cell.push(owner[0], owner[1]);
    for (let i = 0; i < 3; i++) this.n.push(nx, ny, nz);
  }

  /** Horizontal quad facing up (or down with `down`). */
  top(x0: number, z0: number, x1: number, z1: number, y: number, down = false) {
    const a = [x0, y, z0];
    const b = [x0, y, z1];
    const c = [x1, y, z1];
    const d = [x1, y, z0];
    if (down) {
      this.tri(a, c, b, 0, -1, 0);
      this.tri(a, d, c, 0, -1, 0);
    } else {
      this.tri(a, b, c, 0, 1, 0);
      this.tri(a, c, d, 0, 1, 0);
    }
  }

  /** Vertical quad from (x0,z0)→(x1,z1), y0→y1, facing the horizontal normal (nx, nz). */
  wall(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, nx: number, nz: number, decal = false) {
    if (y1 - y0 < 1e-4) return;
    let a = [x0, y0, z0];
    let b = [x1, y0, z1];
    let c = [x1, y1, z1];
    let d = [x0, y1, z0];
    // Flip winding if it would face away from the requested normal.
    const tnx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const tnz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (tnx * nx + tnz * nz < 0) [a, b, c, d] = [b, a, d, c];
    this.tri(a, b, c, nx, 0, nz);
    this.tri(a, c, d, nx, 0, nz);
    if (decal) {
      // u runs left→right as seen from outside (right = (nz, 0, -nx)), v bottom→top.
      const proj = (q: number[]) => q[0] * nz - q[2] * nx;
      const us = [a, b, c, d].map(proj);
      const u0 = Math.min(...us);
      const span = Math.max(...us) - u0 || 1;
      const uvOf = (q: number[]) => [(proj(q) - u0) / span, (q[1] - y0) / (y1 - y0)];
      for (const q of [a, b, c, a, c, d]) this.uv.push(...uvOf(q));
    }
  }

  /** Axis-aligned box; `bottom` adds the underside. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, bottom = false) {
    this.top(x0, z0, x1, z1, y1);
    if (bottom) this.top(x0, z0, x1, z1, y0, true);
    this.wall(x1, z0, x1, z1, y0, y1, 1, 0);
    this.wall(x0, z0, x0, z1, y0, y1, -1, 0);
    this.wall(x0, z1, x1, z1, y0, y1, 0, 1);
    this.wall(x0, z0, x1, z0, y0, y1, 0, -1);
  }

  geometry(tile: number) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    if (this.cell.length === this.p.length / 3 * 2) g.setAttribute('aCutTile', new THREE.Float32BufferAttribute(this.cell, 2));
    if (this.uv.length) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      return g;
    }
    return worldUV(g, tile);
  }
}

/** One QuadSet per material key, baked into meshes at the end. */
export class Builder {
  private sets = new Map<string, QuadSet>();
  /** Map cell that geometry emitted from now on belongs to (per-cell cutaway). */
  owner: [number, number] | null = null;

  set(key: string) {
    let s = this.sets.get(key);
    if (!s) this.sets.set(key, (s = new QuadSet(() => this.owner)));
    return s;
  }

  meshes(
    materials: Record<string, THREE.Material> | ((key: string) => THREE.Material),
    tiles: Record<string, number> = {},
    { cast = true, receive = true } = {},
  ) {
    const out: THREE.Mesh[] = [];
    const pick = typeof materials === 'function' ? materials : (k: string) => materials[k];
    for (const [key, set] of this.sets) {
      if (set.empty) continue;
      const m = new THREE.Mesh(set.geometry(tiles[key] ?? 3), pick(key));
      m.castShadow = cast;
      m.receiveShadow = receive;
      m.name = key;
      out.push(m);
    }
    return out;
  }
}

/** Tags every mesh under `obj` as belonging to map cell (x, y) for the per-cell cutaway. */
export function ownCell(obj: THREE.Object3D, x: number, y: number) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const n = m.geometry.attributes.position.count;
    m.geometry.setAttribute('aCutTile', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0).map((_, i) => (i % 2 ? y : x)), 2));
  });
  return obj;
}

/** Small deterministic hash → [0, 1). */
export function hash(...n: number[]) {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
