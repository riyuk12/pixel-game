import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from './outlinePass';

/** Low-res line count the game aims for; the real value is picked so it scales by a whole number. */
export const TARGET_LINES = 360;

/**
 * Ordered (Bayer) dithering + gentle colour quantisation, applied after tone mapping.
 * Keeps the lighting smooth but gives gradients the stepped, dithered look of pixel art.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    levels: { value: 40.0 },
    saturation: { value: 1.18 },
    shadowTint: { value: new THREE.Color(0.0, 0.035, 0.09) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float levels;
    uniform float saturation;
    uniform vec3 shadowTint;
    varying vec2 vUv;

    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      int i = x + y * 4;
      float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
      return m[i] / 16.0 - 0.5;
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, saturation);
      c += shadowTint * (1.0 - smoothstep(0.0, 0.35, l)); // cool, teal-indigo shadows
      c += vec3(0.05, 0.022, -0.02) * smoothstep(0.55, 1.0, l); // warm gold highlights
      c += bayer4(floor(vUv * resolution)) / levels;
      c = floor(c * levels + 0.5) / levels;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
};

/**
 * Tilt-shift: a sharp band through the middle of the screen (where the player is) and a gentle
 * blur growing towards the top and bottom, so the city reads like a miniature diorama.
 */
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    focus: { value: 0.5 }, // screen height of the sharp band's centre (0 bottom .. 1 top)
    band: { value: 0.18 }, // half-height of the fully sharp band
    maxBlur: { value: 1.8 }, // blur radius at the screen edges, in low-res pixels
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float focus;
    uniform float band;
    uniform float maxBlur;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - focus) - band) / (0.5 - band);
      float r = maxBlur * smoothstep(0.0, 1.0, d);
      if (r < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec2 px = r / resolution;
      // Centre + two rings of 8 taps (inner at half radius) so stronger blur stays smooth.
      vec2 dirs[8] = vec2[8](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
                             vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707));
      vec4 c = texture2D(tDiffuse, vUv) * 0.2;
      for (int i = 0; i < 8; i++) {
        c += texture2D(tDiffuse, vUv + px * dirs[i]) * 0.05;
        c += texture2D(tDiffuse, vUv + px * 0.5 * dirs[i].yx) * 0.05;
      }
      gl_FragColor = c;
    }
  `,
};

const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Snaps a point to a grid laid out in a rotated frame (a camera's or a light's).
 * Returns the sub-step remainder along right/up in grid steps, for smooth sub-pixel scrolling.
 */
export function snapInFrame(point: THREE.Vector3, quat: THREE.Quaternion, step: number, out: THREE.Vector3) {
  _r.set(1, 0, 0).applyQuaternion(quat);
  _u.set(0, 1, 0).applyQuaternion(quat);
  _b.set(0, 0, 1).applyQuaternion(quat);
  const r = point.dot(_r);
  const u = point.dot(_u);
  const b = point.dot(_b);
  const rs = Math.round(r / step) * step;
  const us = Math.round(u / step) * step;
  out.copy(_r).multiplyScalar(rs).addScaledVector(_u, us).addScaledVector(_b, b);
  return { dx: (r - rs) / step, dy: (u - us) / step };
}

/** yaw/pitch in radians; zoom = low-res pixels per metre. */
export type Orbit = { yaw: number; pitch: number; zoom: number };

/**
 * The camera only rests at fixed angles and zoom levels. Continuous rotation re-rasterises
 * every slanted edge each frame (pixel runs stretch and shrink), so views are quantised:
 * yaw in 45° steps, a few pitch presets, and whole-number pixels-per-metre zoom levels.
 */
const YAW_STEP = Math.PI / 4;
const PITCHES = [25, 34, 45, 60].map((d) => THREE.MathUtils.degToRad(d));
const ZOOMS = [12, 14, 17, 20, 24, 28, 34];
const CAMERA_DISTANCE = 320; // orthographic: far enough to clear every rooftop

/**
 * Renders the scene at low resolution through an orthographic orbit camera and upscales with
 * hard pixel edges. The camera only ever moves by whole low-res pixels (in its own frame), so
 * static geometry never shimmers; the leftover fraction slides the canvas for smooth motion.
 */
export class PixelRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.OrthographicCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly gtao: GTAOPass;
  readonly outline: OutlinePass;
  private grade: ShaderPass;
  readonly tiltShift: ShaderPass;
  /** Screen pixels per low-res pixel. */
  scale = 1;
  width = 1;
  height = 1;

  readonly orbit: Orbit;
  readonly goal: Orbit;
  private readonly home: Orbit;
  private snapped = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private lastZoom = 0;

  constructor(private container: HTMLElement, private scene: THREE.Scene, orbit: Partial<Orbit> = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.imageRendering = 'pixelated';
    container.appendChild(canvas);

    this.home = { yaw: orbit.yaw ?? 0, pitch: orbit.pitch ?? THREE.MathUtils.degToRad(34), zoom: orbit.zoom ?? 17 };
    this.orbit = { ...this.home };
    this.goal = { ...this.home };
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 900);

    this.composer = new EffectComposer(this.renderer);
    this.outline = new OutlinePass(scene, this.camera);
    this.composer.addPass(this.outline);
    this.gtao = new GTAOPass(scene, this.camera, 1, 1);
    this.gtao.setGBuffer(this.outline.depthTexture, this.outline.normalTexture); // share depth + normals (and the cutaway)
    this.gtao.blendIntensity = 0.7;
    this.gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.4, thickness: 1.5, scale: 1.2, samples: 16 });
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.4, 0.82);
    this.composer.addPass(this.bloom);
    this.tiltShift = new ShaderPass(TiltShiftShader);
    this.composer.addPass(this.tiltShift);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Turn one 45° step (dir = +1 or −1). */
  turn(dir: number) {
    this.goal.yaw = Math.round(this.goal.yaw / YAW_STEP + dir) * YAW_STEP;
  }

  /** Tilt to the next steeper (+1) or flatter (−1) pitch preset. */
  tilt(dir: number) {
    const i = PITCHES.reduce((best, p, k) => (Math.abs(p - this.goal.pitch) < Math.abs(PITCHES[best] - this.goal.pitch) ? k : best), 0);
    this.goal.pitch = PITCHES[THREE.MathUtils.clamp(i + dir, 0, PITCHES.length - 1)];
  }

  /** Step the zoom in (+1) or out (−1); applied instantly so pixels never resample mid-zoom. */
  zoomStep(dir: number) {
    const i = ZOOMS.reduce((best, z, k) => (Math.abs(z - this.goal.zoom) < Math.abs(ZOOMS[best] - this.goal.zoom) ? k : best), 0);
    this.goal.zoom = ZOOMS[THREE.MathUtils.clamp(i + dir, 0, ZOOMS.length - 1)];
    this.orbit.zoom = this.goal.zoom;
  }

  reset() {
    // Back to the default view by the shortest way round.
    const turn = Math.round((this.goal.yaw - this.home.yaw) / (Math.PI * 2)) * Math.PI * 2;
    Object.assign(this.goal, { ...this.home, yaw: this.home.yaw + turn });
  }

  /** Ground direction that "up" on screen walks towards. */
  get screenForward() {
    return new THREE.Vector3(-Math.sin(this.orbit.yaw), 0, -Math.cos(this.orbit.yaw));
  }

  get screenRight() {
    return new THREE.Vector3(Math.cos(this.orbit.yaw), 0, -Math.sin(this.orbit.yaw));
  }

  resize() {
    this.scale = Math.max(1, Math.round(window.innerHeight / TARGET_LINES));
    this.width = Math.ceil(window.innerWidth / this.scale);
    this.height = Math.ceil(window.innerHeight / this.scale);
    // One spare pixel on every side so the sub-pixel slide never reveals the canvas edge.
    const w = this.width + 2;
    const h = this.height + 2;
    this.renderer.setSize(w, h, false);
    const canvas = this.renderer.domElement;
    canvas.style.width = `${w * this.scale}px`;
    canvas.style.height = `${h * this.scale}px`;
    canvas.style.left = `${-this.scale}px`;
    canvas.style.top = `${-this.scale}px`;
    this.composer.setSize(w, h);
    this.grade.uniforms.resolution.value.set(w, h);
    this.tiltShift.uniforms.resolution.value.set(w, h);
    this.lastZoom = 0;
  }

  private updateFrustum() {
    const w = this.width + 2;
    const h = this.height + 2;
    const z = this.orbit.zoom;
    Object.assign(this.camera, { left: -w / 2 / z, right: w / 2 / z, top: h / 2 / z, bottom: -h / 2 / z });
    this.camera.updateProjectionMatrix();
    this.lastZoom = z;
  }

  /** Ease the orbit toward its goal, aim at `target`, and snap the camera to whole pixels. */
  follow(target: THREE.Vector3, dt: number) {
    // Quick snap between the fixed views (about a fifth of a second), then rest exactly on them.
    const k = Math.min(1, dt * 16);
    const settle = (a: number, b: number) => (Math.abs(b - a) < 0.004 ? b : a + (b - a) * k);
    this.orbit.yaw = settle(this.orbit.yaw, this.goal.yaw);
    this.orbit.pitch = settle(this.orbit.pitch, this.goal.pitch);
    this.orbit.zoom = this.goal.zoom;
    if (this.orbit.zoom !== this.lastZoom) this.updateFrustum();

    const { yaw, pitch } = this.orbit;
    this.desired.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      target.y + Math.sin(pitch) * CAMERA_DISTANCE,
      target.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
    );
    this.camera.position.copy(this.desired);
    this.camera.lookAt(target);
    const { dx, dy } = snapInFrame(this.desired, this.camera.quaternion, 1 / this.orbit.zoom, this.snapped);
    this.camera.position.copy(this.snapped);
    this.renderer.domElement.style.transform = `translate(${(-dx * this.scale).toFixed(2)}px, ${(dy * this.scale).toFixed(2)}px)`;
  }

  render() {
    this.composer.render();
  }
}
