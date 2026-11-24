import * as THREE from 'three';
import { TILE_METRES as TS } from '../banarasMap';
import { SHADER_TIME } from './materials';

/**
 * The fantasy layer: sky backdrop, rising sky lanterns, drifting motes, incense smoke, river
 * glints and glowing lotuses, the shrine's pillar of light, and birds. Effects are tagged
 * userData.fx so the outline pass leaves them out of its normal buffer.
 */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------------------------
// Sky backdrop: a screen-filling plane parked at the far end of the camera, scrolling with yaw.
// ---------------------------------------------------------------------------------------------

function skyBackdrop(camera: THREE.OrthographicCamera) {
  const panorama = new THREE.TextureLoader().load('/textures/sky_panorama.png');
  panorama.colorSpace = THREE.SRGBColorSpace;
  panorama.wrapS = THREE.RepeatWrapping;
  panorama.magFilter = THREE.NearestFilter;
  const mat = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: { uTime: SHADER_TIME, uYaw: { value: 0 }, uPano: { value: panorama }, uAspect: { value: 1.7 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uYaw;
      uniform float uAspect;
      uniform sampler2D uPano;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main() {
        float v = vUv.y;
        vec3 top = vec3(0.07, 0.06, 0.2);
        vec3 mid = vec3(0.32, 0.2, 0.46);
        vec3 low = vec3(0.86, 0.46, 0.38);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.45, v));
        c = mix(c, top, smoothstep(0.45, 1.0, v));
        // Stars, twinkling, only high up.
        vec2 cell = floor(vec2(vUv.x * uAspect + uYaw * 0.8, v) * vec2(180.0, 100.0));
        float s = hash(cell);
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
        c += vec3(1.0, 0.95, 0.85) * step(0.985, s) * tw * smoothstep(0.45, 0.8, v);
        // Mythic skyline band (Gemini panorama), scrolling as the camera turns.
        float u = vUv.x * uAspect / 4.0 + uYaw / 6.2831853; // band is half the screen tall; strip is 8:1
        float pv = (v - 0.18) / 0.5;
        if (pv > 0.0 && pv < 1.0) {
          vec4 p = texture2D(uPano, vec2(u, pv));
          float fadeTop = smoothstep(1.0, 0.7, pv);
          c = mix(c, p.rgb, fadeTop * 0.92);
        }
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  plane.frustumCulled = false;
  plane.renderOrder = -10;
  plane.position.z = -880;
  camera.add(plane);
  return {
    plane,
    update(yaw: number) {
      plane.scale.set((camera.right - camera.left) / 2 + 1, (camera.top - camera.bottom) / 2 + 1, 1);
      mat.uniforms.uYaw.value = yaw;
      mat.uniforms.uAspect.value = (camera.right - camera.left) / (camera.top - camera.bottom);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Points-based effects (motes and smoke) drawn as tiny pixel squares.
// ---------------------------------------------------------------------------------------------

function points(count: number, fill: (i: number, center: number[], seed: number[]) => void, frag: string, vert: string, blending: THREE.Blending) {
  const center = new Float32Array(count * 3);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const c: number[] = [];
    const s: number[] = [];
    fill(i, c, s);
    center.set(c, i * 3);
    seed.set(s, i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(center, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: SHADER_TIME, uZoom: { value: 17 } },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

/** Firefly-like motes of gold and teal drifting in the sacred places. */
function motes() {
  const clusters: [number, number, number, number, number, number][] = [
    // x0, x1, z0, z1 (metres), y0, y1
    [3, 25, 3, 23, 6, 16], // Courtyard of Lamps
    [64, 80, 16, 24, 11, 15], // Natya courtyard
    [34, 62, 3, 10, 11, 22], // Temple Chowk
    [28, 50, 14, 16, 11, 14], // Lamp Gali
    [30, 66, 62, 82, 1.5, 7], // over the aarti
  ];
  const per = 90;
  return points(
    clusters.length * per,
    (i, c, s) => {
      const [x0, x1, z0, z1, y0, y1] = clusters[Math.floor(i / per)];
      c.push(rand(x0, x1), rand(y0, y1), rand(z0, z1));
      s.push(Math.random(), Math.random());
    },
    /* glsl */ `
      varying float vGlow;
      varying vec3 vCol;
      void main() {
        if (vGlow < 0.05) discard;
        gl_FragColor = vec4(vCol * vGlow * 2.6, 1.0);
      }`,
    /* glsl */ `
      uniform float uTime;
      attribute vec2 aSeed;
      varying float vGlow;
      varying vec3 vCol;
      void main() {
        float t = uTime * (0.25 + aSeed.x * 0.3) + aSeed.y * 30.0;
        vec3 p = position + vec3(sin(t) * 1.4, sin(t * 0.7 + aSeed.x * 6.0) * 0.9, cos(t * 0.8) * 1.4);
        vGlow = pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed.y * 2.0) + aSeed.x * 50.0), 3.0);
        vCol = mix(vec3(1.0, 0.75, 0.3), vec3(0.4, 1.0, 0.9), step(0.7, aSeed.x));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 2.0;
      }`,
    THREE.AdditiveBlending,
  );
}

/** Incense and fire smoke curling up from the aarti, the chai stove, the kadhai, temple and stepwell. */
function smoke() {
  const emitters: [number, number, number, number][] = [
    // x, y, z, height (metres)
    ...[19, 22, 25, 28, 31].map((x): [number, number, number, number] => [(x + 1) * TS, 4.6, 74, 12]),
    [43, 11.5, 39, 7],
    [77, 11.5, 37, 7],
    [49, 12, 8, 10],
    [15, 6.5, 13, 14],
    [88, 6, 70, 7],
  ];
  const per = 46;
  return points(
    emitters.length * per,
    (i, c, s) => {
      const [x, y, z, h] = emitters[Math.floor(i / per)];
      c.push(x, y, z);
      s.push(Math.random(), h);
    },
    /* glsl */ `
      varying float vAlpha;
      void main() { gl_FragColor = vec4(vec3(0.78, 0.66, 0.58), vAlpha); }`,
    /* glsl */ `
      uniform float uTime;
      attribute vec2 aSeed;
      varying float vAlpha;
      void main() {
        float life = fract(uTime * 0.09 + aSeed.x);
        float a = aSeed.x * 40.0 + life * 3.0;
        vec3 p = position + vec3(sin(a) * life * 1.6 + life * life * 3.0, life * aSeed.y, cos(a * 0.8) * life * 1.4);
        vAlpha = (1.0 - life) * smoothstep(0.0, 0.08, life) * 0.42;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 2.0 + life * 7.0;
      }`,
    THREE.NormalBlending,
  );
}

// ---------------------------------------------------------------------------------------------
// Instanced effects updated on the CPU.
// ---------------------------------------------------------------------------------------------

type Lantern = { x: number; z: number; y0: number; speed: number; phase: number };

export function buildMagic(scene: THREE.Scene, camera: THREE.OrthographicCamera, shrinePos: THREE.Vector3) {
  scene.add(camera);
  const sky = skyBackdrop(camera);

  // Sky lanterns released from the ghats, rising into the night.
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff8a20, emissiveIntensity: 3.2 });
  const LANTERNS = 240;
  const lanterns = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.55, 0.4), lanternMat, LANTERNS);
  const lanternData: Lantern[] = Array.from({ length: LANTERNS }, () => ({
    x: rand(-30, 140),
    z: rand(30, 150),
    y0: rand(0, 1),
    speed: rand(0.008, 0.016),
    phase: rand(0, 100),
  }));
  lanterns.frustumCulled = false;

  // Sun glints and glowing lotuses on the river.
  const GLINTS = 260;
  const glints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe6b0 }), GLINTS);
  const glintPos = Array.from({ length: GLINTS }, () => [rand(-20, 130), rand(79, 140), rand(0, 100)]);
  const LOTUS = 70;
  const lotusMat = new THREE.MeshStandardMaterial({ color: 0xff9ad0, emissive: 0xff5aa8, emissiveIntensity: 1.6 });
  const lotus = new THREE.InstancedMesh(new THREE.ConeGeometry(0.32, 0.28, 6).rotateX(Math.PI), lotusMat, LOTUS);
  const lotusPos = Array.from({ length: LOTUS }, () => [rand(10, 90), rand(80, 100), rand(0, 100)]);
  for (let i = 0; i < LOTUS; i++) lotus.setColorAt(i, new THREE.Color(Math.random() < 0.3 ? 0x7ae8ff : 0xffffff));

  // The pillar of light that rises from the island shrine once it is lit.
  const pillarMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: SHADER_TIME, uOn: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOn; varying vec2 vUv;
      void main(){
        float fade = (1.0 - vUv.y) * (0.6 + 0.4 * sin(vUv.y * 30.0 - uTime * 4.0));
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.4) * fade * uOn * 1.4, 1.0);
      }`,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 160, 16, 1, true).translate(0, 80, 0), pillarMat);
  pillar.position.copy(shrinePos);

  const moteCloud = motes();
  const smokeCloud = smoke();
  // Effects are drawn in colour only: the outline pass skips them when rendering normals.
  for (const o of [lanterns, glints, lotus, pillar, moteCloud, smokeCloud, sky.plane]) o.userData.fx = true;
  scene.add(lanterns, glints, lotus, pillar, moteCloud, smokeCloud);

  // Pigeons wheeling over the ghats and the temple.
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.15, -0.5, 0.12, -0.1, 0, 0, -0.15, 0, 0, 0.15, 0.5, 0.12, -0.1, 0, 0, -0.15], 3));
  birdGeo.computeVertexNormals();
  const flocks = [
    { c: new THREE.Vector3(50, 16, 66), r: 14, n: 16, speed: 0.35 },
    { c: new THREE.Vector3(49, 40, 2), r: 10, n: 12, speed: -0.45 },
    { c: new THREE.Vector3(90, 30, 52), r: 12, n: 10, speed: 0.3 },
  ];
  const BIRDS = flocks.reduce((a, f) => a + f.n, 0);
  const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshStandardMaterial({ color: 0x3a3440, side: THREE.DoubleSide }), BIRDS);
  birds.frustumCulled = false;
  scene.add(birds);
  const birdSeeds = Array.from({ length: BIRDS }, () => [Math.random() * Math.PI * 2, rand(-2, 2), rand(-1.5, 1.5), rand(0.8, 1.3)]);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let shrineOn = 0;
  let shrineTarget = 0;

  return {
    lightShrine() {
      shrineTarget = 1;
    },
    update(t: number, dt: number, yaw: number) {
      sky.update(yaw);
      for (let i = 0; i < LANTERNS; i++) {
        const L = lanternData[i];
        const life = (L.y0 + t * L.speed) % 1;
        m.makeTranslation(L.x + Math.sin(t * 0.3 + L.phase) * 2, life * 130 - 4, L.z + Math.cos(t * 0.23 + L.phase) * 2);
        lanterns.setMatrixAt(i, m);
      }
      lanterns.instanceMatrix.needsUpdate = true;
      lanternMat.emissiveIntensity = 3 + Math.sin(t * 7) * 0.25;

      for (let i = 0; i < GLINTS; i++) {
        const [x, z, s] = glintPos[i];
        const k = Math.max(0, Math.sin(t * 2.2 + s));
        m.compose(v.set(x + Math.sin(t * 0.4 + s) * 0.6, 0.06, z), q.identity(), sc.set(k * k, 1, 1));
        glints.setMatrixAt(i, m);
      }
      glints.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < LOTUS; i++) {
        const [x, z, s] = lotusPos[i];
        m.compose(v.set(x + Math.sin(t * 0.07 + s) * 4, 0.1 + Math.sin(t * 1.3 + s) * 0.05, z + Math.cos(t * 0.05 + s) * 2), q.setFromEuler(e.set(0, t * 0.1 + s, 0)), sc.set(1, 1, 1));
        lotus.setMatrixAt(i, m);
      }
      lotus.instanceMatrix.needsUpdate = true;

      let k = 0;
      for (const f of flocks) {
        for (let i = 0; i < f.n; i++, k++) {
          const [a0, dr, dy, sp] = birdSeeds[k];
          const a = a0 + t * f.speed * sp;
          const r = f.r + dr;
          v.set(f.c.x + Math.cos(a) * r, f.c.y + dy + Math.sin(t * 0.8 + a0) * 1.2, f.c.z + Math.sin(a) * r);
          q.setFromEuler(e.set(0, -a + (f.speed > 0 ? 0 : Math.PI), 0));
          m.compose(v, q, sc.set(1.4, 1 + Math.sin(t * 14 + a0 * 5) * 0.9, 1.4));
          birds.setMatrixAt(k, m);
        }
      }
      birds.instanceMatrix.needsUpdate = true;

      shrineOn += (shrineTarget - shrineOn) * Math.min(1, dt * 0.8);
      pillarMat.uniforms.uOn.value = shrineOn;
    },
  };
}
