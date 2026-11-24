import * as THREE from 'three';
import { texture } from '../kit';
import { WIDTH, HEIGHT } from '../banarasMap';

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...p });

const normalLoader = new THREE.TextureLoader();
/** Colour map plus the relief normal map derived from it (art-src/process.mjs). */
function tx(name: string, relief = 1) {
  const n = normalLoader.load(`/textures/${name}_n.png`);
  n.wrapS = n.wrapT = THREE.RepeatWrapping;
  n.magFilter = THREE.NearestFilter;
  n.minFilter = THREE.NearestMipmapNearestFilter;
  n.colorSpace = THREE.NoColorSpace;
  return { map: texture(name), normalMap: n, normalScale: new THREE.Vector2(relief, relief) };
}

/** Material keys whose texture is stretched once over each quad rather than tiled at world scale. */
export const DECALS = new Set(['door', 'decWinShutters', 'decWinArch', 'decDoorBlue', 'decDoorGreen', 'decShop', 'decMural', 'decNiche', 'decJharokha']);

/** Every material in the Banaras slice. Textures are Gemini-generated (art-src/prompts.json). */
export const BM = {
  // Ground
  paving: std({ ...tx('tex_paving'), color: 0xf2e2c6 }),
  ghat: std({ ...tx('tex_paving'), color: 0xf6dfb8 }),
  courtStone: std({ ...tx('tex_paving'), color: 0xc8ae86 }),
  wet: std({ ...tx('tex_paving'), color: 0x76705f, roughness: 0.3 }),
  riser: std({ ...tx('tex_sandstone_gold'), color: 0xf0dcb8 }),
  wetRiser: std({ ...tx('tex_sandstone_gold'), color: 0x7d705a, roughness: 0.35 }),
  arcadeFloor: std({ ...tx('tex_paving'), color: 0x7e6a50 }),
  // Walls by house style
  blue: std({ ...tx('tex_plaster_blue') }),
  ochre: std({ ...tx('tex_plaster_ochre') }),
  sandstone: std({ ...tx('tex_sandstone_gold') }),
  pink: std({ ...tx('tex_plaster_pink') }),
  white: std({ ...tx('tex_plaster_white') }),
  // Trim and details
  roof: std({ ...tx('tex_roof'), color: 0xe8c79c }),
  roofLime: std({ ...tx('tex_roof'), color: 0xf4ead8 }),
  roofGrey: std({ ...tx('tex_roof'), color: 0xb9b2aa }),
  roofRose: std({ ...tx('tex_roof'), color: 0xe2a690 }),
  roofTile: std({ ...tx('tex_terracotta_tiles') }),
  trimWhite: std({ ...tx('tex_plaster_white'), color: 0xf4eee4 }),
  jaliStone: std({ ...tx('tex_jali'), color: 0xd9b98a }),
  interior: std({ color: 0x4a3a35 }), // inside walls, seen only where a neighbouring cell is cut away
  trim: std({ ...tx('tex_sandstone_gold'), color: 0xf5e2bc }),
  carved: std({ ...tx('tex_carved_relief') }),
  door: std({ ...tx('tex_door') }),
  jali: std({ ...tx('tex_jali'), emissiveMap: texture('tex_jali'), emissive: 0xffffff, emissiveIntensity: 0.9 }),
  jaliBright: std({ ...tx('tex_jali'), emissiveMap: texture('tex_jali'), emissive: 0xffc070, emissiveIntensity: 2.4 }),
  shutter: std({ color: 0x3f6b6a }),
  dark: std({ color: 0x1a120e, roughness: 1 }),
  wood: std({ color: 0x5b3b22 }),
  tiles: std({ ...tx('tex_tiles'), roughness: 0.4 }),
  terracotta: std({ ...tx('tex_terracotta_tiles') }),
  brocade: std({ ...tx('tex_brocade'), side: THREE.DoubleSide, roughness: 0.6 }),
  bandhani: std({ ...tx('tex_bandhani'), side: THREE.DoubleSide }),
  bark: std({ ...tx('tex_bark') }),
  foliage: std({ ...tx('tex_foliage') }),
  marigoldHeap: std({ ...tx('tex_marigold'), emissive: 0x3a1600, emissiveIntensity: 0.5 }),
  // Facade decals (whole image per quad)
  decWinShutters: std({ ...tx('dec_window_shutters') }),
  decWinArch: std({ ...tx('dec_window_arch'), emissiveMap: texture('dec_window_arch'), emissive: 0xffd9a0, emissiveIntensity: 0.7 }),
  decDoorBlue: std({ ...tx('dec_door_blue') }),
  decDoorGreen: std({ ...tx('dec_door_green') }),
  decShop: std({ ...tx('dec_shopfront'), emissiveMap: texture('dec_shopfront'), emissive: 0xffc890, emissiveIntensity: 0.35 }),
  decMural: std({ ...tx('dec_mural') }),
  decNiche: std({ ...tx('dec_shrine_niche'), emissiveMap: texture('dec_shrine_niche'), emissive: 0xffb070, emissiveIntensity: 0.5 }),
  decJharokha: std({ ...tx('dec_jharokha') }),
  whitewash: std({ color: 0xf2e8d6 }),
  brass: std({ color: 0xd9a441, metalness: 0.85, roughness: 0.35 }),
  clothSaffron: std({ color: 0xf08a1c, side: THREE.DoubleSide }),
  clothMagenta: std({ color: 0xc0306a, side: THREE.DoubleSide }),
  clothTeal: std({ color: 0x1f8a86, side: THREE.DoubleSide }),
  clothIndigo: std({ color: 0x2c3c8c, side: THREE.DoubleSide }),
  clothWhite: std({ color: 0xf0eadc, side: THREE.DoubleSide }),
  // Water
  river: new THREE.MeshStandardMaterial({ color: 0x2a4a63, roughness: 0.08, metalness: 0.25 }),
  pool: new THREE.MeshStandardMaterial({ color: 0x06171a, roughness: 0.04, metalness: 0.3 }),
  // Living things
  leaf: std({ color: 0x3c5e2c }),
  marigold: std({ color: 0xf29a17, emissive: 0x401800, emissiveIntensity: 0.4 }),
  rose: std({ color: 0xb8192c }),
  flame: std({ color: 0xffb040, emissive: 0xff9020, emissiveIntensity: 4 }),
  clay: std({ color: 0xa65a38 }),
};

export type BMKey = keyof typeof BM;

const BAYER = 'float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.)';

/** Shader patches stack per material (wind + fade on the same cloth). */
type Patch = [key: string, apply: (shader: THREE.WebGLProgramParametersWithUniforms) => void];
const PATCHES = new WeakMap<THREE.Material, Patch[]>();

function addPatch(m: THREE.Material, patch: Patch) {
  const list = [...(PATCHES.get(m) ?? []), patch];
  PATCHES.set(m, list);
  m.onBeforeCompile = (shader) => list.forEach(([, apply]) => apply(shader));
  m.customProgramCacheKey = () => list.map(([k]) => k).join('+');
}

/** Shared clock for every animated shader (seconds). */
export const SHADER_TIME = { value: 0 };

/**
 * Makes cloth move in the wind. With `pinLen` > 0 the cloth hangs from local height `pinY`
 * (it is still at the pin and swings more the further below it a vertex is); otherwise it flutters evenly.
 */
export function windy<T extends THREE.Material>(m: T, amp: number, pinY = 0, pinLen = 0) {
  const pin = pinLen > 0 ? `clamp((${pinY.toFixed(3)} - transformed.y) / ${pinLen.toFixed(3)}, 0.0, 1.0)` : '1.0';
  addPatch(m, [
    `wind${amp}_${pinY}_${pinLen}`,
    (shader) => {
      shader.uniforms.uTime = SHADER_TIME;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          float pin = ${pin};
          float ph = uTime * 2.4 + wp.x * 0.45 + wp.z * 0.31;
          float gust = 0.55 + 0.45 * sin(uTime * 0.37 + wp.x * 0.05 + wp.z * 0.03);
          transformed.x += sin(ph) * ${amp.toFixed(3)} * pin * gust;
          transformed.z += sin(ph * 1.37 + 1.7) * ${(amp * 0.7).toFixed(3)} * pin * gust;
          transformed.y += sin(ph * 2.3) * ${(amp * 0.25).toFixed(3)} * pin;
        }`,
      );
    },
  ]);
  return m;
}

/** A pinned, swaying copy of a cloth material. */
export const hanging = (base: THREE.Material, amp: number, pinY: number, pinLen: number) => windy(base.clone(), amp, pinY, pinLen);

/**
 * Cutaway: a building that stands between the player and the camera is cut AS ONE OBJECT —
 * everything above its own knee-high stub line dissolves together (ordered dither), so no
 * window frames or balconies are left floating. Buildings that don't block stay whole. Big
 * landmarks are split into pieces so only the pieces in front of the player go.
 */
const DITHER = (k: string) => `{
          vec2 bp = mod(floor(gl_FragCoord.xy), 4.0);
          float bm[16] = ${BAYER};
          if ((bm[int(bp.x) + int(bp.y) * 4] + 0.5) / 16.0 < ${k}) discard;
        }`;

/** `on` (0..1) is the building's own switch; `stub` the world height below which its walls stay. */
export function cutPatch(on: { value: number }, stub: { value: number }) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uCutOn = on;
    shader.uniforms.uCutStub = stub;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying float vCutY;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCutY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform float uCutOn;
      uniform float uCutStub;
      varying float vCutY;
      void main() {
        if (uCutOn > 0.0 && vCutY > uCutStub) ${DITHER('uCutOn')}`,
    );
  };
}

/**
 * Per-cell cutaway for houses: every map cell (2 m tile) has a cut value in this texture, and
 * each vertex knows its owning cell (attribute aCutTile), so only the cells that block the view
 * dissolve — each with all of its own windows, balconies and roof furniture.
 */
export const CUT_CELLS = (() => {
  const size = { w: WIDTH, h: HEIGHT };
  const data = new Uint8Array(size.w * size.h);
  const tex = new THREE.DataTexture(data, size.w, size.h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return { data, tex, size: { value: new THREE.Vector2(size.w, size.h) }, map: { value: tex } };
})();

/** Cell-cut patch; `stub` (world y) keeps knee-high walls standing. Omit stub for the shadow pass. */
export function cellPatch(stub?: { value: number }) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uCutCells = CUT_CELLS.map;
    shader.uniforms.uCutSize = CUT_CELLS.size;
    if (stub) shader.uniforms.uCutStub = stub;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute vec2 aCutTile;\nvarying vec2 vCutTile;\nvarying float vCutY;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCutTile = aCutTile;\nvCutY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform sampler2D uCutCells;
      uniform vec2 uCutSize;
      ${stub ? 'uniform float uCutStub;' : ''}
      varying vec2 vCutTile;
      varying float vCutY;
      void main() {
        {
          float k = texture2D(uCutCells, (vCutTile + 0.5) / uCutSize).r;
          if (k > 0.0${stub ? ' && vCutY > uCutStub' : ''}) ${DITHER('k')}
        }`,
    );
  };
}

/** One shared shadow material for every cell-cut building: cut cells cast no shadow. */
export const CELL_SHADOW = (() => {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = cellPatch();
  m.customProgramCacheKey = () => 'shadow-cells';
  return m;
})();

/** A clone of `base` for a cell-cut building whose walls stand to `stub` (world y) when cut. */
export function cellCut<T extends THREE.Material>(base: T, stub: { value: number }) {
  const m = base.clone() as T;
  for (const p of PATCHES.get(base) ?? []) addPatch(m, p);
  m.userData.cutaway = true;
  addPatch(m, ['cells', cellPatch(stub)]);
  const normal = new THREE.MeshNormalMaterial();
  normal.onBeforeCompile = cellPatch(stub);
  normal.customProgramCacheKey = () => 'normal-cells';
  m.userData.normal = normal;
  return m;
}

/** A clone of `base` that takes part in the cutaway of one building. Keeps any wind on the base. */
export function fadeable<T extends THREE.Material>(base: T, on: { value: number }, stub: { value: number }) {
  const m = base.clone() as T;
  for (const p of PATCHES.get(base) ?? []) addPatch(m, p);
  m.userData.fade = on;
  m.userData.cutaway = true;
  addPatch(m, ['cut', cutPatch(on, stub)]);
  // Companion normals material with the same switch, so the outline pass sees the same cut.
  const normal = new THREE.MeshNormalMaterial();
  normal.onBeforeCompile = cutPatch(on, stub);
  normal.customProgramCacheKey = () => 'normal-cut';
  m.userData.normal = normal;
  return m;
}

// Every awning, sari and flag ripples a little.
for (const k of ['clothSaffron', 'clothMagenta', 'clothTeal', 'clothIndigo', 'clothWhite', 'bandhani', 'brocade'] as const) windy(BM[k], 0.06);

// ---------------------------------------------------------------------------------------------
// Cel shading: every lit material becomes a toon material with a soft four-band light ramp.
// ---------------------------------------------------------------------------------------------

/** Light ramp: [where the band starts on the N·L ramp (0..1), brightness]. Edges blend over ±BLEND. */
export const TOON_BANDS: [number, number][] = [[0, 0.2], [0.5, 0.52], [0.64, 0.82], [0.84, 1]];
const BLEND = 0.035;

function toonRamp() {
  const n = 256;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    let v = TOON_BANDS[0][1];
    for (let b = 1; b < TOON_BANDS.length; b++) {
      const [start, value] = TOON_BANDS[b];
      const t = THREE.MathUtils.smoothstep(x, start - BLEND, start + BLEND);
      v = v + (value - v) * t;
    }
    data.set([v * 255, v * 255, v * 255, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, n, 1);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
const RAMP = toonRamp();

/**
 * Swaps every MeshStandardMaterial under `root` for a MeshToonMaterial with the same maps and
 * colours (plus any wind / fade patches). Code that later animates the old material's
 * emissiveIntensity keeps working: the property is forwarded to the toon copy.
 */
export function toonify(root: THREE.Object3D) {
  const cache = new Map<THREE.Material, THREE.Material>();
  const swap = (m: THREE.Material) => {
    const s = m as THREE.MeshStandardMaterial;
    if (!s.isMeshStandardMaterial) return m;
    let t = cache.get(m) as THREE.MeshToonMaterial | undefined;
    if (!t) {
      t = new THREE.MeshToonMaterial({
        color: s.color.clone().multiplyScalar(s.metalness > 0.5 ? 1.3 : 1),
        map: s.map,
        gradientMap: RAMP,
        normalMap: s.normalMap,
        normalScale: s.normalScale.clone().multiplyScalar(0.6),
        emissive: s.emissive,
        emissiveMap: s.emissiveMap,
        emissiveIntensity: s.emissiveIntensity,
        side: s.side,
        transparent: s.transparent,
        opacity: s.opacity,
        alphaTest: s.alphaTest,
        fog: s.fog,
      });
      t.userData = s.userData;
      for (const p of PATCHES.get(s) ?? []) addPatch(t, p);
      const toon = t;
      Object.defineProperty(s, 'emissiveIntensity', { configurable: true, get: () => toon.emissiveIntensity, set: (v: number) => (toon.emissiveIntensity = v) });
      cache.set(m, t);
    }
    return t;
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}
