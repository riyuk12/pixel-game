import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { M, mesh, type Lantern } from './kit';

/** KayKit props we don't want in a peaceful town (and the mage's pointed European hat). */
const HIDDEN = ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', 'Mage_Hat'];

export class Character {
  readonly root = new THREE.Group();
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;

  constructor(private model: THREE.Object3D, clips: THREE.AnimationClip[], recolour: THREE.Texture, height: number) {
    model.traverse((o) => {
      if (HIDDEN.includes(o.name)) o.visible = false;
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.map = recolour;
        mat.roughness = 0.85;
        mat.metalness = 0;
        mat.needsUpdate = true;
      }
    });
    // Measure only visible parts: hidden weapons would otherwise inflate the bounds.
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    model.traverse((o) => {
      let visible = true;
      o.traverseAncestors((a) => (visible &&= a.visible));
      if ((o as THREE.Mesh).isMesh && o.visible && visible) bounds.expandByObject(o);
    });
    model.scale.setScalar(height / bounds.getSize(new THREE.Vector3()).y);
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  bone(name: string) {
    return this.model.getObjectByName(name);
  }

  play(name: string, { fade = 0.2, once = false } = {}) {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;
    next.reset();
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    next.play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  get playing() {
    return this.current?.getClip().name;
  }

  /** Smoothly turns to face a direction on the ground plane. */
  face(dir: THREE.Vector3, dt: number, speed = 10) {
    if (dir.lengthSq() < 1e-6) return;
    const target = Math.atan2(dir.x, dir.z);
    let delta = target - this.root.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.root.rotation.y += delta * Math.min(1, dt * speed);
  }

  update(dt: number) {
    this.mixer.update(dt);
  }
}

export type Model = 'Rogue_Hooded' | 'Mage';

const gltfs = new Map<string, Promise<GLTF>>();
const skins = new Map<string, Promise<THREE.Texture>>();

function skinTexture(url: string) {
  let p = skins.get(url);
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(url).then((t) => {
      t.flipY = false; // glTF UV convention
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      return t;
    });
    skins.set(url, p);
  }
  return p;
}

/**
 * A new animated character. `skin` picks a costume texture: 'default' is the model's own
 * recolour, anything else is public/textures/char_<skin>.png (see art-src/process.mjs).
 */
export async function spawnCharacter(model: Model, skin = 'default', height = 1.9) {
  let g = gltfs.get(model);
  if (!g) gltfs.set(model, (g = new GLTFLoader().loadAsync(`/models/${model}.glb`)));
  const [gltf, tex] = await Promise.all([g, skinTexture(skin === 'default' ? `/textures/${model}_recolour.png` : `/textures/char_${skin}.png`)]);
  const scene = SkeletonUtils.clone(gltf.scene);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = (m.material as THREE.Material).clone();
  });
  return new Character(scene, gltf.animations, tex, height);
}

export const loadCharacter = (model: Model, height = 1.9) => spawnCharacter(model, 'default', height);

/** Wraps a turban around the head bone, replacing the mage's European hat. */
export function addTurban(c: Character, colour = 0x7a1f2a) {
  const head = c.bone('head');
  if (!head) return;
  const cloth = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
  const t = new THREE.Group();
  const crown = mesh(new THREE.SphereGeometry(0.44, 12, 8), cloth);
  crown.scale.set(1.0, 0.62, 1.0);
  crown.position.y = 0.8;
  t.add(crown);
  const wrap = mesh(new THREE.TorusGeometry(0.42, 0.11, 6, 14), cloth);
  wrap.rotation.x = Math.PI / 2;
  wrap.position.y = 0.7;
  t.add(wrap);
  const jewel = mesh(new THREE.SphereGeometry(0.07, 6, 4), M.brass);
  jewel.position.set(0, 0.76, 0.5);
  t.add(jewel);
  head.add(t);
}

/** A small brass oil lamp held in the right hand; joins the lantern list so it lights with the town. */
export function addHandLamp(c: Character, lanterns: Lantern[]) {
  const hand = c.bone('handslot.r');
  if (!hand) return;
  const lamp = new THREE.Group();
  const bowl = mesh(new THREE.SphereGeometry(0.14, 8, 6), M.brass);
  bowl.scale.set(1.3, 0.55, 1);
  lamp.add(bowl);
  const spout = mesh(new THREE.ConeGeometry(0.05, 0.22, 6), M.brass);
  spout.rotation.z = -Math.PI / 2.4;
  spout.position.set(0.17, 0.04, 0);
  lamp.add(spout);
  const flameMat = (M.glass as THREE.MeshStandardMaterial).clone();
  const flame = mesh(new THREE.ConeGeometry(0.04, 0.12, 5), flameMat, { cast: false });
  flame.position.set(0.25, 0.14, 0);
  lamp.add(flame);
  const light = new THREE.PointLight(0xffa04a, 0, 5, 2);
  light.position.set(0.25, 0.25, 0);
  lamp.add(light);
  lamp.position.y = 0.1;
  hand.add(lamp);
  lanterns.push({ light, glass: flameMat, lit: 0, target: 0, seed: Math.random() * 100 });
}
