import * as THREE from 'three';
import { TILE_METRES as TS, canStep } from '../banarasMap';
import { BM } from './materials';
import { buildTerrain, buildWater, surfaceHeight } from './terrain';
import { buildCity, type Occluder } from './buildings';
import { buildLandmarks } from './landmarks';
import { buildProps } from './props';

/** Dusk sky as an environment map: violet overhead, orange glow low in the west. */
function duskEnvironment(renderer: THREE.WebGLRenderer) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, '#22204e');
  v.addColorStop(0.4, '#6a5196');
  v.addColorStop(0.5, '#f09858');
  v.addColorStop(0.53, '#4a3424');
  v.addColorStop(1, '#1a1410');
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 128);
  const sun = g.createRadialGradient(192, 60, 2, 192, 60, 80);
  sun.addColorStop(0, 'rgba(255,180,100,0.95)');
  sun.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  return env;
}

export function buildBanaras(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.background = new THREE.Color(0x1d1a40);
  // Orthographic camera sits 320 m back: haze starts just behind the player and thickens with distance.
  scene.fog = new THREE.Fog(0x3a2e5c, 330, 470);
  scene.environment = duskEnvironment(renderer);
  scene.environmentIntensity = 0.5;

  scene.add(new THREE.HemisphereLight(0x4a5cc8, 0x221820, 0.75));
  const sun = new THREE.DirectionalLight(0xff9a50, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 320 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  // Cool moonlight from the north-east, so shadows read blue against the warm fire.
  const moon = new THREE.DirectionalLight(0x8090ff, 0.55);
  moon.position.set(60, 120, -80);
  scene.add(moon);

  const terrain = buildTerrain(BM as unknown as Record<string, THREE.Material>);
  scene.add(...terrain.meshes, ...buildWater(BM.river, BM.pool));
  const city = buildCity();
  scene.add(...city.fillerMeshes);
  const landmarks = buildLandmarks(terrain.arcade);
  scene.add(...landmarks.floors);
  const occluders: Occluder[] = [...city.occluders, ...landmarks.occluders];
  for (const o of occluders) scene.add(o.object);
  const props = buildProps(scene);

  /** Can the player stand at this world position, coming from `from`? */
  const canMove = (fx: number, fz: number, tx: number, tz: number) => {
    const a = [Math.floor(fx / TS), Math.floor(fz / TS)];
    const b = [Math.floor(tx / TS), Math.floor(tz / TS)];
    if (a[0] === b[0] && a[1] === b[1]) return true;
    return canStep(a[0], a[1], b[0], b[1]);
  };

  const shrinePos = new THREE.Vector3(7.5 * TS, 4.6, 6.5 * TS);
  return { sun, occluders, props, surfaceHeight, canMove, shrinePos };
}
